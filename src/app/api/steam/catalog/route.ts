// src/app/api/steam/catalog/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/steam/catalog?cc=IN
 * Returns a small candidate set from Steam's featuredcategories (top sellers, specials, trends).
 * We keep the payload tiny for fast client-side scoring.
 */
export async function GET(req: NextRequest) {
  try {
    // Country code from query or geolocation headers (falls back to US)
    const { searchParams } = new URL(req.url);
    const qCC = searchParams.get("cc")?.toUpperCase();
    const ipCC =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-forwarded-country") ||
      req.headers.get("cf-ipcountry") ||
      undefined;
    const cc = (qCC || ipCC || "US").toUpperCase();

    const url = `https://store.steampowered.com/api/featuredcategories/?l=en&cc=${encodeURIComponent(
      cc
    )}`;
    const r = await fetch(url, { next: { revalidate: 300 } });
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: `Steam store error ${r.status}` }, { status: 502 });
    }
    const j = await r.json();

    // Buckets to sample from
    const buckets = [
      j?.top_sellers?.items ?? [],
      j?.specials?.items ?? [],
      j?.trending_new_releases?.items ?? [],
      j?.popular_new_releases?.items ?? [],
      j?.coming_soon?.items ?? [],
    ];

    // Flatten and de-dup by id (appid)
    const seen = new Set<number>();
    const out: any[] = [];
    for (const arr of buckets) {
      for (const it of arr) {
        const appid = typeof it?.id === "number" ? it.id : undefined;
        if (!appid || seen.has(appid)) continue;
        seen.add(appid);

        out.push({
          appid,
          name: it?.name ?? "Unknown",
          header: it?.header_image ?? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
          discount_pct: it?.discount_percent ?? 0,
          price_cents:
            typeof it?.final_price === "number" ? it.final_price : null,
          original_price_cents:
            typeof it?.original_price === "number" ? it.original_price : null,
        });
      }
    }

    return NextResponse.json({ ok: true, cc, candidates: out.slice(0, 400) }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
