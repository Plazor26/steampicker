import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/steam/enrich
 * Body: { appids: number[] }
 * Returns: { ok: true, items: { [appid:number]: { genres:string[], categories:string[], price_cents:number|null, discount_pct:number, released_year:number|null } } }
 *
 * Uses Steam's public appdetails endpoint. We keep it simple (one app per request)
 * but do lightweight concurrency to avoid serial slowness. Results are cacheable.
 */

type Enriched = {
  genres: string[];
  categories: string[];
  price_cents: number | null;
  discount_pct: number;
  released_year: number | null;
};

export async function POST(req: NextRequest) {
  let body: { appids?: number[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const appids = (body.appids || []).filter((n) => Number.isFinite(n));
  if (!appids.length) {
    return NextResponse.json({ ok: false, error: "No appids given" }, { status: 400 });
  }

  // Simple concurrency limiter
  const MAX_CONCURRENCY = 6;
  const queue = [...new Set(appids)];
  const results: Record<number, Enriched> = {};

  async function fetchOne(appid: number): Promise<void> {
    // Keep fields minimal to avoid giant payloads
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=categories,genres,release_date,price_overview`;
    try {
      const r = await fetch(url, {
        // Steam public, let CDN cache it
        next: { revalidate: 3600 },
        headers: { "accept": "application/json" },
      });
      if (!r.ok) return;

      const j = await r.json();
      const entry = j?.[String(appid)];
      if (!entry?.success) {
        results[appid] = {
          genres: [],
          categories: [],
          price_cents: null,
          discount_pct: 0,
          released_year: null,
        };
        return;
      }
      const data = entry.data || {};

      const genres = Array.isArray(data.genres)
        ? data.genres.map((x: any) => String(x?.description || "").trim()).filter(Boolean)
        : [];
      const categories = Array.isArray(data.categories)
        ? data.categories.map((x: any) => String(x?.description || "").trim()).filter(Boolean)
        : [];

      let year: number | null = null;
      try {
        const raw = String(data?.release_date?.date || "");
        // Take the last token that looks like a year
        const token = raw.split(/[\s,]+/).pop() || "";
        year = /^\d{4}$/.test(token) ? Number(token) : null;
      } catch {
        year = null;
      }

      const pov = data?.price_overview;
      const price_cents = Number.isFinite(pov?.final) ? Number(pov.final) : null;
      const discount_pct = Number.isFinite(pov?.discount_percent) ? Number(pov.discount_percent) : 0;

      results[appid] = {
        genres,
        categories,
        price_cents,
        discount_pct,
        released_year: year,
      };
    } catch {
      // network errors etc
      results[appid] = {
        genres: [],
        categories: [],
        price_cents: null,
        discount_pct: 0,
        released_year: null,
      };
    }
  }

  // Run the queue with concurrency
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift()!;
      await fetchOne(id);
    }
  });

  await Promise.all(workers);

  return NextResponse.json(
    { ok: true, items: results },
    {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=600",
      },
    }
  );
}
