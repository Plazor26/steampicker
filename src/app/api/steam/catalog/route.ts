// src/app/api/steam/catalog/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Catalog API v2 — personalized candidate pool.
 *
 * When ?tags= is provided, fetches games from SteamSpy by tag.
 * SteamSpy's tag endpoint returns games with ownership, reviews, and price data.
 * This gives PERSONALIZED candidate pools: a Souls-like player gets Souls-like games,
 * not the same featured games as everyone else.
 *
 * Also fetches Steam's featured/specials as a baseline.
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
    const out: any[] = [];

    function addGame(appid: number, data: any) {
      if (seen.has(appid)) return;
      seen.add(appid);
      out.push(data);
    }

    // ── 1. Steam featured/specials (baseline pool) ──
    const [catRes, featRes] = await Promise.allSettled([
      fetch(`https://store.steampowered.com/api/featuredcategories/?l=en&cc=${encodeURIComponent(cc)}`, { next: { revalidate: 300 } }),
      fetch(`https://store.steampowered.com/api/featured/?l=en&cc=${encodeURIComponent(cc)}`, { next: { revalidate: 300 } }),
    ]);

    if (catRes.status === "fulfilled" && catRes.value.ok) {
      try {
        const j = await catRes.value.json();
        for (const bucket of [j?.top_sellers?.items, j?.specials?.items, j?.trending_new_releases?.items, j?.popular_new_releases?.items, j?.new_releases?.items]) {
          if (!Array.isArray(bucket)) continue;
          for (const it of bucket) {
            const appid = it?.id ?? it?.appid;
            if (!appid) continue;
            addGame(appid, {
              appid, name: it?.name ?? "Unknown",
              header: it?.header_image ?? it?.large_capsule_image ?? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
              discount_pct: it?.discount_percent ?? 0,
              price_cents: typeof it?.final_price === "number" ? it.final_price : null,
              currencyCode: it?.currency ?? undefined,
            });
          }
        }
      } catch {}
    }

    if (featRes.status === "fulfilled" && featRes.value.ok) {
      try {
        const j = await featRes.value.json();
        for (const bucket of [j?.large_capsules, j?.featured_win, j?.featured_mac, j?.featured_linux]) {
          if (!Array.isArray(bucket)) continue;
          for (const it of bucket) {
            const appid = it?.id ?? it?.appid;
            if (!appid) continue;
            addGame(appid, {
              appid, name: it?.name ?? "Unknown",
              header: it?.header_image ?? it?.large_capsule_image ?? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
              discount_pct: it?.discount_percent ?? 0,
              price_cents: typeof it?.final_price === "number" ? it.final_price : null,
              currencyCode: it?.currency ?? undefined,
            });
          }
        }
      } catch {}
    }

    // ── 2. SteamSpy tag-based candidates (personalized) ──
    if (userTags.length > 0) {
      const tagFetches = userTags.slice(0, 8).map(async (tag) => {
        try {
          const r = await fetch(`https://steamspy.com/api.php?request=tag&tag=${encodeURIComponent(tag)}`, {
            next: { revalidate: 3600 },
          });
          if (!r.ok) return;
          const games = await r.json();
          if (!games || typeof games !== "object") return;

          // SteamSpy returns: { "appid": { appid, name, positive, negative, owners, price, ... } }
          for (const [id, g] of Object.entries(games) as [string, any][]) {
            const appid = parseInt(id);
            if (isNaN(appid) || !g?.name) continue;

            // Quality filter: skip games with bad reviews or very few reviews
            const pos = g.positive ?? 0;
            const neg = g.negative ?? 0;
            const total = pos + neg;
            if (total < 50) continue; // too few reviews to trust
            const ratio = total > 0 ? pos / total : 0;
            if (ratio < 0.6) continue; // below 60% positive = skip

            // Parse price
            const price = typeof g.price === "string" ? parseInt(g.price) : typeof g.price === "number" ? g.price : null;

            addGame(appid, {
              appid,
              name: g.name,
              header: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
              discount_pct: typeof g.discount === "string" ? parseInt(g.discount) : g.discount ?? 0,
              price_cents: price, // SteamSpy price is USD cents
              currencyCode: undefined, // SteamSpy is always USD
              // Extra SteamSpy data for scoring
              spy_positive: pos,
              spy_negative: neg,
              spy_owners: g.owners,
            });
          }
        } catch {}
      });

      await Promise.all(tagFetches);
    }

    // ── 3. SteamSpy trending (top games by recent playtime) ──
    try {
      const r = await fetch("https://steamspy.com/api.php?request=top100in2weeks", { next: { revalidate: 3600 } });
      if (r.ok) {
        const games = await r.json();
        for (const [id, g] of Object.entries(games) as [string, any][]) {
          const appid = parseInt(id);
          if (isNaN(appid) || !g?.name) continue;
          const price = typeof g.price === "string" ? parseInt(g.price) : typeof g.price === "number" ? g.price : null;
          addGame(appid, {
            appid, name: g.name,
            header: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
            discount_pct: typeof g.discount === "string" ? parseInt(g.discount) : g.discount ?? 0,
            price_cents: price,
            currencyCode: undefined,
            spy_positive: g.positive ?? 0,
            spy_negative: g.negative ?? 0,
          });
        }
      }
    } catch {}

    if (!out.length) {
      return NextResponse.json({ ok: false, error: "No catalog data" }, { status: 502 });
    }

    console.log("[CATALOG] cc:", cc, "tags:", userTags.join(",") || "none", "candidates:", out.length);

    return NextResponse.json({ ok: true, cc, candidates: out }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
