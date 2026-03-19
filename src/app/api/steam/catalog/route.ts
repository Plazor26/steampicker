// src/app/api/steam/catalog/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Returns personalized candidates when ?tags= is provided.
 * Fetches SteamSpy tag lists SERVER-SIDE (SteamSpy has no CORS).
 * Each candidate includes `matchedTags` so the prescreener can score
 * without making any external requests.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qCC = searchParams.get("cc")?.toUpperCase();
    const ipCC = req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-forwarded-country") ||
      req.headers.get("cf-ipcountry") || undefined;
    const cc = (qCC || ipCC || "US").toUpperCase();
    const userTags = searchParams.get("tags")?.split(",").filter(Boolean) || [];

    const seen = new Set<number>();
    const gameData = new Map<number, {
      name: string;
      header: string;
      discount_pct: number;
      price_cents: number | null;
      currencyCode?: string;
      matchedTags: string[];
      reviewScore: number;
    }>();

    // ── 1. Steam featured (regional prices) ──
    const [catRes, featRes] = await Promise.allSettled([
      fetch(`https://store.steampowered.com/api/featuredcategories/?l=en&cc=${encodeURIComponent(cc)}`, { next: { revalidate: 300 } }),
      fetch(`https://store.steampowered.com/api/featured/?l=en&cc=${encodeURIComponent(cc)}`, { next: { revalidate: 300 } }),
    ]);

    function ingestSteam(items: any[]) {
      for (const it of items) {
        const appid = it?.id ?? it?.appid;
        if (!appid || seen.has(appid)) continue;
        seen.add(appid);
        gameData.set(appid, {
          name: it?.name ?? "Unknown",
          header: it?.header_image ?? it?.large_capsule_image ?? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
          discount_pct: it?.discount_percent ?? 0,
          price_cents: typeof it?.final_price === "number" ? it.final_price : null,
          currencyCode: it?.currency ?? undefined,
          matchedTags: [],
          reviewScore: 0.5,
        });
      }
    }

    if (catRes.status === "fulfilled" && catRes.value.ok) {
      try {
        const j = await catRes.value.json();
        for (const b of [j?.top_sellers?.items, j?.specials?.items, j?.trending_new_releases?.items, j?.popular_new_releases?.items, j?.new_releases?.items])
          if (Array.isArray(b)) ingestSteam(b);
      } catch {}
    }
    if (featRes.status === "fulfilled" && featRes.value.ok) {
      try {
        const j = await featRes.value.json();
        for (const b of [j?.large_capsules, j?.featured_win, j?.featured_mac, j?.featured_linux])
          if (Array.isArray(b)) ingestSteam(b);
      } catch {}
    }

    // ── 2. SteamSpy tag lists (personalized candidates) ──
    if (userTags.length > 0) {
      const tagFetches = userTags.slice(0, 10).map(async (tag) => {
        try {
          const r = await fetch(`https://steamspy.com/api.php?request=tag&tag=${encodeURIComponent(tag)}`, {
            next: { revalidate: 3600 },
          });
          if (!r.ok) return;
          const games = await r.json();
          if (!games || typeof games !== "object") return;

          // Sort by reviews, take top 200 per tag
          const entries: [string, any][] = Object.entries(games);
          entries.sort((a, b) => ((b[1].positive ?? 0) + (b[1].negative ?? 0)) - ((a[1].positive ?? 0) + (a[1].negative ?? 0)));

          for (const [id, g] of entries.slice(0, 200)) {
            const appid = parseInt(id);
            if (isNaN(appid) || !g?.name) continue;
            const pos = g.positive ?? 0;
            const neg = g.negative ?? 0;
            const total = pos + neg;
            if (total < 50) continue;
            const ratio = total > 0 ? pos / total : 0;
            if (ratio < 0.6) continue;

            const existing = gameData.get(appid);
            if (existing) {
              // Game already in pool — add this tag to its matches
              existing.matchedTags.push(tag);
              existing.reviewScore = Math.max(existing.reviewScore, ratio);
            } else {
              gameData.set(appid, {
                name: g.name,
                header: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
                discount_pct: typeof g.discount === "string" ? parseInt(g.discount) : g.discount ?? 0,
                price_cents: null, // SteamSpy = USD, don't show
                matchedTags: [tag],
                reviewScore: ratio,
              });
            }
          }
        } catch {}
      });
      await Promise.all(tagFetches);
    }

    const candidates = [...gameData.entries()].map(([appid, d]) => ({ appid, ...d }));
    console.log("[CATALOG] cc:", cc, "tags:", userTags.length, "candidates:", candidates.length);

    return NextResponse.json({ ok: true, cc, candidates }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
