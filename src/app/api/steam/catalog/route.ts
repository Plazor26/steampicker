// src/app/api/steam/catalog/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Catalog API — returns candidate games for the recommendation engine.
 *
 * Two modes:
 * 1. Default: fetches Steam's featured/specials (generic, same for everyone)
 * 2. With ?tags=Action,RPG,Souls-like: fetches games matching user's top tags
 *    from Steam's search API, giving PERSONALIZED candidate pools.
 *
 * The tag-based search uses Steam tag IDs (fetched from tagdata endpoint)
 * and returns games sorted by review score.
 */

// Steam tag name -> ID mapping (cached in memory)
let tagIdMap: Record<string, number> | null = null;
let tagIdMapTs = 0;

async function getTagIds(): Promise<Record<string, number>> {
  if (tagIdMap && Date.now() - tagIdMapTs < 24 * 60 * 60 * 1000) return tagIdMap;
  try {
    const r = await fetch("https://store.steampowered.com/tagdata/populartags/english", {
      next: { revalidate: 86400 },
    });
    if (!r.ok) return tagIdMap || {};
    const arr: { tagid: number; name: string }[] = await r.json();
    tagIdMap = {};
    for (const t of arr) tagIdMap[t.name] = t.tagid;
    tagIdMapTs = Date.now();
    return tagIdMap;
  } catch { return tagIdMap || {}; }
}

// Parse appids from Steam search HTML results
function parseSearchHTML(html: string): number[] {
  const matches = [...html.matchAll(/data-ds-appid="(\d+)"/g)];
  return matches.map(m => parseInt(m[1])).filter(n => !isNaN(n));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qCC = searchParams.get("cc")?.toUpperCase();
    const ipCC =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-forwarded-country") ||
      req.headers.get("cf-ipcountry") || undefined;
    const cc = (qCC || ipCC || "US").toUpperCase();
    const userTags = searchParams.get("tags")?.split(",").filter(Boolean) || [];

    const seen = new Set<number>();
    const out: any[] = [];

    function ingest(items: any[]) {
      for (const it of items) {
        const appid = typeof it?.id === "number" ? it.id : typeof it?.appid === "number" ? it.appid : undefined;
        if (!appid || seen.has(appid)) continue;
        seen.add(appid);
        out.push({
          appid,
          name: it?.name ?? "Unknown",
          header: it?.header_image ?? it?.large_capsule_image ??
            `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
          discount_pct: it?.discount_percent ?? 0,
          price_cents: typeof it?.final_price === "number" ? it.final_price : null,
          original_price_cents: typeof it?.original_price === "number" ? it.original_price : null,
          currencyCode: it?.currency ?? undefined,
        });
      }
    }

    function ingestAppids(appids: number[]) {
      for (const appid of appids) {
        if (seen.has(appid)) continue;
        seen.add(appid);
        out.push({
          appid,
          name: `App ${appid}`, // will be enriched later by prescreener
          header: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
          discount_pct: 0,
          price_cents: null,
          original_price_cents: null,
          currencyCode: undefined,
        });
      }
    }

    // ── 1. Always fetch featured/specials (base pool) ──
    const [catRes, featRes] = await Promise.allSettled([
      fetch(`https://store.steampowered.com/api/featuredcategories/?l=en&cc=${encodeURIComponent(cc)}`, { next: { revalidate: 300 } }),
      fetch(`https://store.steampowered.com/api/featured/?l=en&cc=${encodeURIComponent(cc)}`, { next: { revalidate: 300 } }),
    ]);

    if (catRes.status === "fulfilled" && catRes.value.ok) {
      const j = await catRes.value.json();
      for (const bucket of [
        j?.top_sellers?.items, j?.specials?.items,
        j?.trending_new_releases?.items, j?.popular_new_releases?.items,
        j?.new_releases?.items, j?.coming_soon?.items,
      ]) if (Array.isArray(bucket)) ingest(bucket);
    }

    if (featRes.status === "fulfilled" && featRes.value.ok) {
      const j = await featRes.value.json();
      for (const bucket of [
        j?.large_capsules, j?.featured_win, j?.featured_mac, j?.featured_linux,
      ]) if (Array.isArray(bucket)) ingest(bucket);
    }

    // ── 2. Tag-based personalized search (if tags provided) ──
    if (userTags.length > 0) {
      const tagIds = await getTagIds();

      // Take top 6 tags, search for games matching each
      const topTags = userTags.slice(0, 6);
      const searchPromises = topTags.map(async (tagName) => {
        const tagId = tagIds[tagName];
        if (!tagId) return;
        try {
          // Fetch on-sale games matching this tag, sorted by reviews
          const url = `https://store.steampowered.com/search/results/?tags=${tagId}&sort_by=Reviews_DESC&start=0&count=50&cc=${encodeURIComponent(cc)}&l=en&json=1&infinite=1&specials=1`;
          const r = await fetch(url, {
            headers: { "X-Requested-With": "XMLHttpRequest" },
            next: { revalidate: 3600 },
          });
          if (!r.ok) return;
          const j = await r.json();
          const appids = parseSearchHTML(j.results_html || "");
          ingestAppids(appids);
        } catch {}

        // Also fetch top-rated (not just on sale) for this tag
        try {
          const url2 = `https://store.steampowered.com/search/results/?tags=${tagId}&sort_by=Reviews_DESC&start=0&count=30&cc=${encodeURIComponent(cc)}&l=en&json=1&infinite=1`;
          const r2 = await fetch(url2, {
            headers: { "X-Requested-With": "XMLHttpRequest" },
            next: { revalidate: 3600 },
          });
          if (!r2.ok) return;
          const j2 = await r2.json();
          const appids2 = parseSearchHTML(j2.results_html || "");
          ingestAppids(appids2);
        } catch {}
      });

      await Promise.all(searchPromises);
    }

    if (!out.length) {
      return NextResponse.json({ ok: false, error: "No catalog data from Steam" }, { status: 502 });
    }

    console.log("[CATALOG] cc:", cc, "tags:", userTags.join(",") || "none", "total candidates:", out.length);

    return NextResponse.json({ ok: true, cc, candidates: out.slice(0, 800) }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
