// src/app/api/steam/value/[steamId]/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Library value calculator using Steam's regional pricing.
 *
 * Key optimization: batches up to 20 appids per request to Steam's appdetails.
 * 180 games = 9 requests instead of 180. With 2s delays = ~18s total.
 * No more rate limiting.
 */

const BATCH_SIZE = 100;   // Steam accepts up to 100 appids per request
const BATCH_DELAY = 1500; // 1.5s between batches

// In-memory cache (persists across requests)
const cache = new Map<string, { cents: number; curr: string; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ steamId: string }> }
) {
  const { steamId } = await ctx.params;
  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return NextResponse.json({ ok: false, error: "Invalid steamId" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const qCC = searchParams.get("cc")?.toUpperCase();
  const ipCC = req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-forwarded-country") ||
    req.headers.get("cf-ipcountry") || undefined;
  const cc = (qCC || ipCC || "US").toUpperCase();

  const profRes = await fetch(`${req.nextUrl.origin}/api/steam/profile/${steamId}`, { cache: "no-store" });
  if (!profRes.ok) return NextResponse.json({ ok: false, error: `Profile ${profRes.status}` }, { status: 502 });
  const prof = await profRes.json();
  const all: any[] = prof?.library?.allGames ?? [];
  if (!all.length) return NextResponse.json({ ok: true, value: 0, currency: null, currencyCode: null, cc }, { status: 200 });

  const appids: number[] = all.map((g: any) => g.appid).filter((n: any) => typeof n === "number");

  type P = { cents: number; curr: string };
  const results = new Map<number, P>();

  // Separate cached vs uncached
  const uncached: number[] = [];
  for (const id of appids) {
    const c = cache.get(`${id}:${cc}`);
    if (c && Date.now() - c.ts < CACHE_TTL) {
      results.set(id, { cents: c.cents, curr: c.curr });
    } else {
      uncached.push(id);
    }
  }

  console.log("[VALUE] cc:", cc, "cached:", results.size, "need:", uncached.length);

  // Batch fetch uncached (20 appids per request)
  let blocked = false;
  for (let i = 0; i < uncached.length && !blocked; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${batch.join(",")}&filters=price_overview&cc=${cc}`;
      const r = await fetch(url, { next: { revalidate: 86400 } });
      if (r.status === 403 || !r.ok) { blocked = true; break; }
      const text = await r.text();
      if (text.startsWith("<")) { blocked = true; break; }
      const j = JSON.parse(text);

      for (const id of batch) {
        const pov = j?.[String(id)]?.data?.price_overview;
        if (!pov) continue; // free game
        const cents = typeof pov.initial === "number" ? pov.initial : pov.final;
        const curr = pov.currency;
        if (typeof cents !== "number" || typeof curr !== "string") continue;
        results.set(id, { cents, curr });
        cache.set(`${id}:${cc}`, { cents, curr, ts: Date.now() });
      }
    } catch { blocked = true; }

    // Delay between batches (skip if last batch)
    if (i + BATCH_SIZE < uncached.length && !blocked) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const counted = results.size;
  const isPartial = counted < appids.length * 0.9;

  if (counted === 0) {
    console.log("[VALUE] FAILED: no prices, blocked:", blocked);
    return NextResponse.json({
      ok: true, cc, currency: null, currencyCode: null, value: null,
      counted, owned: appids.length, partial: true,
    }, { status: 200 });
  }

  const currencyCode = [...results.values()].find(r => r.curr)?.curr || "USD";
  let totalCents = 0;
  for (const r of results.values()) totalCents += r.cents;
  const value = totalCents / 100;

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(value);
  } catch {
    formatted = `${currencyCode} ${value.toFixed(2)}`;
  }

  console.log("[VALUE]", currencyCode, value, "counted:", counted, "/", appids.length, isPartial ? "(partial)" : "");

  return NextResponse.json({
    ok: true, cc, currency: formatted, currencyCode, value,
    counted, owned: appids.length, partial: isPartial,
  }, {
    status: 200,
    headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
