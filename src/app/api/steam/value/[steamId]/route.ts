// src/app/api/steam/value/[steamId]/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Library value calculator using Steam's regional pricing.
 *
 * Conservative rate limiting to avoid 403s:
 * - Concurrency: 2 requests at a time
 * - 300ms delay between batches
 * - In-memory cache persists across requests (24h TTL)
 * - If we hit a 403, we stop and return partial results
 */

const CONCURRENCY = 1;       // one at a time
const BATCH_DELAY = 1200;    // 1.2s between requests — stays under Steam's rate limit

// In-memory cache — survives across requests in dev & prod
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

  console.log("[VALUE] cc:", cc);

  const profRes = await fetch(`${req.nextUrl.origin}/api/steam/profile/${steamId}`, { cache: "no-store" });
  if (!profRes.ok) return NextResponse.json({ ok: false, error: `Profile ${profRes.status}` }, { status: 502 });
  const prof = await profRes.json();
  const all: any[] = prof?.library?.allGames ?? [];
  if (!all.length) return NextResponse.json({ ok: true, value: 0, currency: "—", currencyCode: "USD", cc }, { status: 200 });

  const appids: number[] = all.map((g: any) => g.appid).filter((n: any) => typeof n === "number");

  type P = { cents: number; curr: string } | null;
  let blocked = false;
  let consecutiveFails = 0;

  async function fetchPrice(appid: number): Promise<P> {
    // Always check cache first, even if Steam is blocked
    const key = `${appid}:${cc}`;
    const c = cache.get(key);
    if (c && Date.now() - c.ts < CACHE_TTL) return { cents: c.cents, curr: c.curr };

    // Only skip network if blocked
    if (blocked) return null;

    try {
      const r = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=price_overview&cc=${cc}`,
        { next: { revalidate: 86400 } }
      );
      if (r.status === 403 || !r.ok) { consecutiveFails++; if (consecutiveFails >= 2) blocked = true; return null; }
      const text = await r.text();
      if (text.startsWith("<")) { consecutiveFails++; if (consecutiveFails >= 2) blocked = true; return null; }
      consecutiveFails = 0;
      const pov = JSON.parse(text)?.[String(appid)]?.data?.price_overview;
      if (!pov) return null; // free game
      const cents = typeof pov.initial === "number" ? pov.initial : pov.final;
      const curr = pov.currency;
      if (typeof cents !== "number" || typeof curr !== "string") return null;
      cache.set(key, { cents, curr, ts: Date.now() });
      return { cents, curr };
    } catch { return null; }
  }

  // Count how many are already cached
  const cachedCount = appids.filter(id => {
    const c = cache.get(`${id}:${cc}`);
    return c && Date.now() - c.ts < CACHE_TTL;
  }).length;

  console.log("[VALUE] Cached:", cachedCount, "/", appids.length, "Need to fetch:", appids.length - cachedCount);

  // Process one at a time with delays between uncached fetches
  const results: P[] = new Array(appids.length).fill(null);
  for (let i = 0; i < appids.length; i++) {
    const id = appids[i];
    const wasCached = cache.has(`${id}:${cc}`) && Date.now() - cache.get(`${id}:${cc}`)!.ts < CACHE_TTL;
    results[i] = await fetchPrice(id);
    // Delay after uncached fetches to avoid rate limiting
    if (!wasCached && !blocked && i < appids.length - 1) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const counted = results.filter(r => r != null).length;
  const isPartial = counted < appids.length * 0.9; // partial if <90% priced
  const currencyCode = results.find(r => r?.curr)?.curr || null;

  // If we got zero results or no currency, don't return fake data
  if (counted === 0 || !currencyCode) {
    console.log("[VALUE] FAILED: counted:", counted, "blocked:", blocked);
    return NextResponse.json({
      ok: true, cc, currency: null, currencyCode: null, value: null,
      counted, owned: appids.length, partial: true,
    }, { status: 200 });
  }

  const totalCents = results.reduce<number>((s, r) => s + (r?.cents || 0), 0);
  const value = totalCents / 100;

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(value);
  } catch {
    formatted = `${currencyCode} ${value.toFixed(2)}`;
  }

  console.log("[VALUE] Result:", currencyCode, value, "counted:", counted, "/", appids.length, isPartial ? "(partial)" : "(complete)");

  return NextResponse.json({
    ok: true, cc, currency: formatted, currencyCode, value,
    counted, owned: appids.length, partial: isPartial,
  }, {
    status: 200,
    headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
