import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/steam/enrich
 * Body: { appids: number[] }
 * Returns: { ok: true, items: { [appid]: { tags, genres, ... } } }
 *
 * Uses SteamSpy API for community tags + Steam appdetails for genres/categories.
 * SteamSpy is prioritized because it doesn't rate-limit like Steam's CDN.
 */

type Enriched = {
  tags: string[];         // Community tags from SteamSpy (e.g., "Souls-like", "Open World")
  genres: string[];       // Steam official genres (e.g., "Action", "RPG")
  categories: string[];   // Steam categories (e.g., "Multi-player", "Controller support")
  price_cents: number | null;
  initialprice_cents: number | null;
  discount_pct: number;
  released_year: number | null;
  review_count: number | null;
  metacritic_score: number | null;
};

const MAX_CONCURRENCY = 8;

export async function POST(req: NextRequest) {
  let body: { appids?: number[] } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const appids = [...new Set((body.appids || []).filter((n) => Number.isFinite(n)))];
  if (!appids.length) {
    return NextResponse.json({ ok: false, error: "No appids given" }, { status: 400 });
  }

  const results: Record<number, Enriched> = {};

  async function fetchSteamSpy(appid: number): Promise<{
    tags: string[]; price: number | null; initialprice: number | null; discount: number;
  }> {
    try {
      const r = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`, {
        next: { revalidate: 86400 },
      });
      if (!r.ok) return { tags: [], price: null, initialprice: null, discount: 0 };
      const j = await r.json();

      // Tags: { "Open World": 12801, "RPG": 10801, ... } - sorted by votes
      const tagObj = j?.tags || {};
      const tags = Object.entries(tagObj)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([name]) => name);

      const price = typeof j?.price === "string" ? parseInt(j.price, 10)
        : typeof j?.price === "number" ? j.price : null;
      const initialprice = typeof j?.initialprice === "string" ? parseInt(j.initialprice, 10)
        : typeof j?.initialprice === "number" ? j.initialprice : null;
      const discount = typeof j?.discount === "string" ? parseInt(j.discount, 10)
        : typeof j?.discount === "number" ? j.discount : 0;

      return { tags, price, initialprice, discount };
    } catch {
      return { tags: [], price: null, initialprice: null, discount: 0 };
    }
  }

  async function fetchSteamDetails(appid: number): Promise<{
    genres: string[]; categories: string[];
    released_year: number | null; review_count: number | null; metacritic_score: number | null;
  }> {
    try {
      const r = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=categories,genres,release_date,metacritic,recommendations`,
        { next: { revalidate: 3600 }, headers: { accept: "application/json" } }
      );
      if (!r.ok) return { genres: [], categories: [], released_year: null, review_count: null, metacritic_score: null };

      const text = await r.text();
      if (text.startsWith("<")) return { genres: [], categories: [], released_year: null, review_count: null, metacritic_score: null };

      const j = JSON.parse(text);
      const entry = j?.[String(appid)];
      if (!entry?.success) return { genres: [], categories: [], released_year: null, review_count: null, metacritic_score: null };

      const data = entry.data || {};
      const genres = Array.isArray(data.genres)
        ? data.genres.map((x: any) => String(x?.description || "").trim()).filter(Boolean) : [];
      const categories = Array.isArray(data.categories)
        ? data.categories.map((x: any) => String(x?.description || "").trim()).filter(Boolean) : [];

      let year: number | null = null;
      try {
        const raw = String(data?.release_date?.date || "");
        const token = raw.split(/[\s,]+/).pop() || "";
        year = /^\d{4}$/.test(token) ? Number(token) : null;
      } catch { year = null; }

      return {
        genres, categories, released_year: year,
        review_count: Number.isFinite(data?.recommendations?.total) ? Number(data.recommendations.total) : null,
        metacritic_score: Number.isFinite(data?.metacritic?.score) ? Number(data.metacritic.score) : null,
      };
    } catch {
      return { genres: [], categories: [], released_year: null, review_count: null, metacritic_score: null };
    }
  }

  /** Scrape user-defined tags from the Steam store page (fallback when SteamSpy has none) */
  async function fetchStorePageTags(appid: number): Promise<string[]> {
    try {
      const r = await fetch(`https://store.steampowered.com/app/${appid}/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cookie": "birthtime=0;wants_mature_content=1;lastagecheckage=1-0-1990",
        },
        next: { revalidate: 86400 },
      });
      if (!r.ok) return [];
      const html = await r.text();
      if (html.includes("Access Denied")) return [];
      const matches = [...html.matchAll(/class="app_tag"[^>]*>\s*([^<]+?)\s*</g)];
      return matches.map(m => m[1].trim()).filter(t => t.length > 1 && t !== "+");
    } catch { return []; }
  }

  async function enrichOne(appid: number) {
    // Fetch SteamSpy and Steam details in parallel
    const [spy, steam] = await Promise.all([
      fetchSteamSpy(appid),
      fetchSteamDetails(appid),
    ]);

    // If SteamSpy has no tags, scrape from store page
    let tags = spy.tags;
    if (tags.length === 0) {
      tags = await fetchStorePageTags(appid);
    }

    results[appid] = {
      tags,
      genres: steam.genres,
      categories: steam.categories,
      price_cents: spy.price,
      initialprice_cents: spy.initialprice,
      discount_pct: spy.discount,
      released_year: steam.released_year,
      review_count: steam.review_count,
      metacritic_score: steam.metacritic_score,
    };
  }

  // Run with concurrency
  const queue = [...appids];
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift()!;
      await enrichOne(id);
    }
  });
  await Promise.all(workers);

  return NextResponse.json(
    { ok: true, items: results },
    { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=600" } }
  );
}
