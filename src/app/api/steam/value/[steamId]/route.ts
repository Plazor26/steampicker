// src/app/api/steam/value/[steamId]/route.ts
import { NextResponse, type NextRequest } from "next/server";

// Small concurrency to be gentle on the store API
const CONCURRENCY = 8;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ steamId: string }> } // Next 15
) {
  const { steamId } = await ctx.params;

  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid steamId (expected 17-digit SteamID64)" },
      { status: 400 }
    );
  }

  // Region (country code) priority: query ?cc=XX -> geo headers -> default IN (for you)
  const { searchParams } = new URL(req.url);
  const qCC = searchParams.get("cc")?.toUpperCase();
  const ipCC =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-forwarded-country") ||
    req.headers.get("cf-ipcountry") ||
    undefined;
  const cc = (qCC || ipCC || "IN").toUpperCase();

  // Pull owned games (profile API already maps and caches)
  const baseUrl = `${req.nextUrl.origin}`;
  const profRes = await fetch(`${baseUrl}/api/steam/profile/${steamId}`, { cache: "no-store" });
  if (!profRes.ok) {
    return NextResponse.json({ ok: false, error: `Profile fetch ${profRes.status}` }, { status: 502 });
  }
  const prof = await profRes.json();
  const all = prof?.library?.allGames ?? [];
  if (!Array.isArray(all) || !all.length) {
    return NextResponse.json({ ok: true, value: 0, currency: "INR", currencyCode: "INR", cc }, { status: 200 });
  }

  // Currency symbol map (minimal)
  const symbolFor = (code: string) =>
    ({ INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥" } as Record<string, string>)[code] || code;

  // Fetch price_overview per app via appdetails
  async function fetchPrice(appid: number) {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=price_overview&cc=${encodeURIComponent(
      cc
    )}`;
    try {
      const r = await fetch(url, { next: { revalidate: 300 } });
      if (!r.ok) return null;
      const j = await r.json();
      const entry = j?.[String(appid)];
      if (!entry?.success) return null;
      const pov = entry?.data?.price_overview;
      if (!pov) return null;
      const final = typeof pov.final === "number" ? pov.final : null; // minor units
      const currencyCode = typeof pov.currency === "string" ? pov.currency : null;
      return { cents: final, currencyCode };
    } catch {
      return null;
    }
  }

  // Concurrency pool
  const appids: number[] = all.map((g: any) => g.appid).filter((n: any) => typeof n === "number");
  let i = 0;
  const results: { cents: number | null; currencyCode: string | null }[] = [];
  async function worker() {
    while (i < appids.length) {
      const idx = i++;
      const res = await fetchPrice(appids[idx]);
      results[idx] = res ?? { cents: null, currencyCode: null };
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, appids.length) }, () => worker());
  await Promise.all(workers);

  // Sum in native currency (assumes store gives consistent currency for region)
  const filtered = results.filter(Boolean) as { cents: number | null; currencyCode: string | null }[];
  const currencyCode =
    filtered.find((r) => r.currencyCode)?.currencyCode || (cc === "IN" ? "INR" : "USD");
  const totalCents = filtered.reduce((sum, r) => sum + (r.cents || 0), 0);
  const value = totalCents / 100;

  return NextResponse.json(
    {
      ok: true,
      cc,
      currency: symbolFor(currencyCode),
      currencyCode,
      value,
      counted: filtered.length,
      owned: appids.length,
    },
    { status: 200, headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" } }
  );
}
