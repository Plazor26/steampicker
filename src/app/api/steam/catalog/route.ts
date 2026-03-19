// src/app/api/steam/catalog/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Recommendation catalog v3 — uses Steam's own "More Like This" algorithm.
 *
 * Instead of our broken tag-matching, we use Steam's collaborative filtering:
 * For each of the user's anchor games, fetch Steam's "More Like This" games.
 * These are games that ACTUAL PLAYERS of that game also play/buy.
 *
 * This is the same algorithm that powers the "More Like This" section
 * on every Steam store page — proven, accurate, battle-tested by Valve.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qCC = searchParams.get("cc")?.toUpperCase();
    const ipCC = req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-forwarded-country") ||
      req.headers.get("cf-ipcountry") || undefined;
    const cc = (qCC || ipCC || "US").toUpperCase();

    // Anchor appids: the user's top games to find similars for
    const anchorIds = searchParams.get("anchors")?.split(",").filter(Boolean).map(Number) || [];

    const seen = new Set<number>();
    const gameData = new Map<number, {
      name: string;
      header: string;
      discount_pct: number;
      price_cents: number | null;
      currencyCode?: string;
      similarTo: string[]; // names of anchor games this is similar to
      steamSimilarCount: number; // how many anchor games consider this "similar"
      reviewScore: number;
    }>();

    // ── 1. For each anchor game, fetch Steam's "More Like This" ──
    if (anchorIds.length > 0) {
      const anchorNames = new Map<number, string>();

      const fetches = anchorIds.slice(0, 10).map(async (anchorId) => {
        try {
          const r = await fetch(`https://store.steampowered.com/recommended/morelike/app/${anchorId}/`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Cookie": "birthtime=0;wants_mature_content=1;lastagecheckage=1-0-1990",
            },
            cache: "no-store",
          });
          if (!r.ok) { console.log(`[CATALOG] MoreLikeThis ${anchorId}: HTTP ${r.status}`); return; }
          const html = await r.text();
          if (html.includes("Access Denied")) { console.log(`[CATALOG] MoreLikeThis ${anchorId}: Access Denied`); return; }

          // Get anchor game name from the page or SteamSpy
          let anchorName = `Game ${anchorId}`;
          try {
            const spy = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${anchorId}`);
            if (spy.ok) { const sj = await spy.json(); anchorName = sj.name || anchorName; }
          } catch {}
          anchorNames.set(anchorId, anchorName);

          // Extract similar game appids
          const appids = [...html.matchAll(/data-ds-appid="(\d+)"/g)]
            .map(m => parseInt(m[1]))
            .filter(id => !isNaN(id) && id !== anchorId);

          console.log(`[CATALOG] Anchor ${anchorName} (${anchorId}): ${appids.length} similar games`);

          for (const appid of appids) {
            const existing = gameData.get(appid);
            if (existing) {
              existing.similarTo.push(anchorName);
              existing.steamSimilarCount++;
            } else {
              gameData.set(appid, {
                name: `App ${appid}`,
                header: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
                discount_pct: 0,
                price_cents: null,
                similarTo: [anchorName],
                steamSimilarCount: 1,
                reviewScore: 0.5,
              });
            }
          }
        } catch {}
      });

      await Promise.all(fetches);

      // Enrich with names and review data from SteamSpy
      const toEnrich = [...gameData.keys()];
      let enrichedCount = 0;
      let enrichFailCount = 0;
      const BATCH = 50;
      for (let i = 0; i < Math.min(toEnrich.length, 500); i += BATCH) {
        const batch = toEnrich.slice(i, i + BATCH);
        await Promise.all(batch.map(async (appid) => {
          try {
            const r = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`);
            if (!r.ok) return;
            const j = await r.json();
            const g = gameData.get(appid);
            if (!g || !j.name) return;
            g.name = j.name;
            const pos = j.positive ?? 0;
            const neg = j.negative ?? 0;
            const total = pos + neg;
            g.reviewScore = total > 0 ? pos / total : 0.5;
            g.discount_pct = typeof j.discount === "string" ? parseInt(j.discount) : j.discount ?? 0;
            enrichedCount++;
          } catch { enrichFailCount++; }
        }));
      }
      console.log(`[CATALOG] SteamSpy enrichment: ${enrichedCount} ok, ${enrichFailCount} failed, ${toEnrich.length - enrichedCount - enrichFailCount} skipped`);

      // Fill missing names from Steam's appdetails (batch of 100)
      const stillMissing = [...gameData.entries()].filter(([, g]) => g.name.startsWith("App "));
      if (stillMissing.length > 0) {
        console.log(`[CATALOG] ${stillMissing.length} games missing names, trying Steam API...`);
        for (let i = 0; i < stillMissing.length; i += 100) {
          const batch = stillMissing.slice(i, i + 100).map(([id]) => id);
          try {
            const r = await fetch(
              `https://store.steampowered.com/api/appdetails?appids=${batch.join(",")}&filters=basic&cc=${cc}`,
              { cache: "no-store" }
            );
            if (!r.ok) continue;
            const text = await r.text();
            if (text.startsWith("<")) continue;
            const j = JSON.parse(text);
            let fixed = 0;
            for (const id of batch) {
              const d = j?.[String(id)]?.data;
              if (!d?.name) continue;
              const g = gameData.get(id);
              if (!g) continue;
              // Filter non-games
              if (d.type && d.type !== "game" && d.type !== "dlc") {
                gameData.delete(id);
                continue;
              }
              g.name = d.name;
              g.header = d.header_image || g.header;
              fixed++;
            }
            console.log(`[CATALOG] Steam API fixed ${fixed} names`);
          } catch {}
        }
        const remaining = [...gameData.values()].filter(g => g.name.startsWith("App ")).length;
        if (remaining > 0) console.log(`[CATALOG] ${remaining} games still unnamed after Steam API`);
      }
    }

    // ── 2. Also add Steam featured/specials (with regional prices) ──
    const [catRes, featRes] = await Promise.allSettled([
      fetch(`https://store.steampowered.com/api/featuredcategories/?l=en&cc=${encodeURIComponent(cc)}`, { next: { revalidate: 300 } }),
      fetch(`https://store.steampowered.com/api/featured/?l=en&cc=${encodeURIComponent(cc)}`, { next: { revalidate: 300 } }),
    ]);

    function ingestFeatured(items: any[]) {
      for (const it of items) {
        const appid = it?.id ?? it?.appid;
        if (!appid) continue;
        const existing = gameData.get(appid);
        if (existing) {
          // Update with regional price data
          existing.price_cents = typeof it?.final_price === "number" ? it.final_price : existing.price_cents;
          existing.currencyCode = it?.currency ?? existing.currencyCode;
          existing.discount_pct = it?.discount_percent ?? existing.discount_pct;
          if (!existing.name || existing.name.startsWith("App ")) existing.name = it?.name ?? existing.name;
        } else {
          gameData.set(appid, {
            name: it?.name ?? "Unknown",
            header: it?.header_image ?? it?.large_capsule_image ?? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
            discount_pct: it?.discount_percent ?? 0,
            price_cents: typeof it?.final_price === "number" ? it.final_price : null,
            currencyCode: it?.currency ?? undefined,
            similarTo: [],
            steamSimilarCount: 0,
            reviewScore: 0.5,
          });
        }
      }
    }

    if (catRes.status === "fulfilled" && catRes.value.ok) {
      try {
        const j = await catRes.value.json();
        for (const b of [j?.specials?.items, j?.top_sellers?.items, j?.new_releases?.items])
          if (Array.isArray(b)) ingestFeatured(b);
      } catch {}
    }
    if (featRes.status === "fulfilled" && featRes.value.ok) {
      try {
        const j = await featRes.value.json();
        for (const b of [j?.large_capsules, j?.featured_win])
          if (Array.isArray(b)) ingestFeatured(b);
      } catch {}
    }

    const candidates = [...gameData.entries()].map(([appid, d]) => ({ appid, ...d }));
    const anchorCount = anchorIds.length;
    console.log("[CATALOG] cc:", cc, "anchors:", anchorCount, "candidates:", candidates.length,
      "with similar:", candidates.filter(c => c.steamSimilarCount > 0).length);

    return NextResponse.json({ ok: true, cc, candidates, anchorCount }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
