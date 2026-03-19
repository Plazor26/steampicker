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

const CONCURRENCY = 2;
const BATCH_DELAY = 300;

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
      if (r.status === 403 || !r.ok) { blocked = true; return null; }
      const text = await r.text();
      if (text.startsWith("<")) { blocked = true; return null; }
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

  // Process in tiny batches with delays
  const results: P[] = new Array(appids.length).fill(null);
  for (let i = 0; i < appids.length; i += CONCURRENCY) {
    const batch = appids.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((id, j) => fetchPrice(id).then(r => { results[i + j] = r; })));
    // Only delay if we actually made network requests (not cached) and more to go
    if (!blocked && i + CONCURRENCY < appids.length) {
      const anyUncached = batch.some(id => !cache.has(`${id}:${cc}`) || Date.now() - cache.get(`${id}:${cc}`)!.ts >= CACHE_TTL);
      if (anyUncached) await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const counted = results.filter(r => r != null).length;
  const currencyCode = results.find(r => r?.curr)?.curr || "USD";
  const totalCents = results.reduce<number>((s, r) => s + (r?.cents || 0), 0);
  const value = totalCents / 100;

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(value);
  } catch {
    formatted = `${currencyCode} ${value.toFixed(2)}`;
  }

  const breakdown = appids.map((appid, i) => ({
    appid,
    name: all.find((g: any) => g.appid === appid)?.name ?? `App ${appid}`,
    cents: results[i]?.cents ?? null,
    local: results[i] ? (results[i]!.cents / 100).toFixed(2) : null,
  })).filter(g => g.cents != null && g.cents > 0);

  console.log("[VALUE] Result:", currencyCode, value, "counted:", counted, "/", appids.length, blocked ? "(stopped early — 403)" : "");

  return NextResponse.json({
    ok: true, cc, currency: formatted, currencyCode, value,
    counted, owned: appids.length,
    partial: blocked && counted < appids.length,
    breakdown,
  }, {
    status: 200,
    headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
