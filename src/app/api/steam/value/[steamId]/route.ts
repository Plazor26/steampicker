// src/app/api/steam/value/[steamId]/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Library value calculator.
 *
 * Strategy: Use Steam's appdetails API with regional ?cc= to get ACTUAL
 * regional prices (not USD converted). Steam has regional pricing —
 * a $60 USD game might be ₹499 INR on the Indian store.
 *
 * Rate limiting: concurrency of 3, 150ms delay between batches, 24h cache.
 * Falls back to SteamSpy USD prices if Steam 403s.
 */

const STEAM_CONCURRENCY = 3;
const BATCH_DELAY_MS = 200;

// In-memory price cache (survives across requests in dev mode)
const priceCache = new Map<string, { cents: number; currencyCode: string; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ steamId: string }> }
) {
  const { steamId } = await ctx.params;
  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return NextResponse.json({ ok: false, error: "Invalid steamId" }, { status: 400 });
  }

  // Determine country code
  const { searchParams } = new URL(req.url);
  const qCC = searchParams.get("cc")?.toUpperCase();
  const ipCC = req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-forwarded-country") ||
    req.headers.get("cf-ipcountry") || undefined;
  const cc = (qCC || ipCC || "US").toUpperCase();

  console.log("[VALUE] cc:", cc, "qCC:", qCC, "ipCC:", ipCC);

  // Pull owned games
  const profRes = await fetch(`${req.nextUrl.origin}/api/steam/profile/${steamId}`, { cache: "no-store" });
  if (!profRes.ok) {
    return NextResponse.json({ ok: false, error: `Profile fetch ${profRes.status}` }, { status: 502 });
  }
  const prof = await profRes.json();
  const all: any[] = prof?.library?.allGames ?? [];
  if (!all.length) {
    return NextResponse.json({ ok: true, value: 0, currency: "$0", currencyCode: "USD", cc }, { status: 200 });
  }

  const appids: number[] = all.map((g: any) => g.appid).filter((n: any) => typeof n === "number");

  // Try Steam's appdetails with regional pricing first
  type PriceResult = { cents: number; currencyCode: string } | null;
  let steam403 = false;

  async function fetchSteamPrice(appid: number): Promise<PriceResult> {
    if (steam403) return null;
    const cacheKey = `${appid}:${cc}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return { cents: cached.cents, currencyCode: cached.currencyCode };
    }
    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=price_overview&cc=${cc}`;
      const r = await fetch(url, { next: { revalidate: 86400 } });
      if (r.status === 403) { steam403 = true; return null; }
      if (!r.ok) return null;
      const text = await r.text();
      if (text.startsWith("<")) { steam403 = true; return null; }
      const j = JSON.parse(text);
      const pov = j?.[String(appid)]?.data?.price_overview;
      if (!pov) return null;
      const cents = typeof pov.initial === "number" ? pov.initial : typeof pov.final === "number" ? pov.final : null;
      const curr = typeof pov.currency === "string" ? pov.currency : null;
      if (cents == null || !curr) return null;
      priceCache.set(cacheKey, { cents, currencyCode: curr, ts: Date.now() });
      return { cents, currencyCode: curr };
    } catch { return null; }
  }

  // Process in small batches with delays
  const results: PriceResult[] = new Array(appids.length).fill(null);

  for (let batch = 0; batch < appids.length && !steam403; batch += STEAM_CONCURRENCY) {
    const chunk = appids.slice(batch, batch + STEAM_CONCURRENCY);
    const promises = chunk.map((appid, i) =>
      fetchSteamPrice(appid).then(r => { results[batch + i] = r; })
    );
    await Promise.all(promises);
    if (batch + STEAM_CONCURRENCY < appids.length && !steam403) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  let steamCount = results.filter(r => r != null).length;
  let usedSource: "steam" | "steamspy" = "steam";

  // If Steam blocked us or returned very few results, fall back to SteamSpy
  if (steam403 || steamCount < appids.length * 0.3) {
    console.log("[VALUE] Steam blocked or low results (", steamCount, "/", appids.length, "), falling back to SteamSpy");
    usedSource = "steamspy";

    async function fetchSpyPrice(appid: number): Promise<number | null> {
      try {
        const r = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`, { next: { revalidate: 86400 } });
        if (!r.ok) return null;
        const j = await r.json();
        const p = typeof j?.initialprice === "string" ? parseInt(j.initialprice) : typeof j?.initialprice === "number" ? j.initialprice : null;
        return p != null && !isNaN(p) && p > 0 ? p : null;
      } catch { return null; }
    }

    // SteamSpy with higher concurrency (they're more lenient)
    let spyIdx = 0;
    const spyResults: (number | null)[] = new Array(appids.length).fill(null);
    async function spyWorker() {
      while (spyIdx < appids.length) {
        const i = spyIdx++;
        spyResults[i] = await fetchSpyPrice(appids[i]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(8, appids.length) }, () => spyWorker()));

    // Convert USD to regional currency
    const CC_TO_CURRENCY: Record<string, string> = {
      US: "USD", GB: "GBP", IN: "INR", JP: "JPY", CN: "CNY", KR: "KRW",
      BR: "BRL", RU: "RUB", AU: "AUD", CA: "CAD", MX: "MXN", TR: "TRY",
      DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
    };
    const targetCurr = CC_TO_CURRENCY[cc] || "USD";
    let rate = 1;
    if (targetCurr !== "USD") {
      try {
        const rr = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json", { next: { revalidate: 86400 } });
        if (rr.ok) { const rd = await rr.json(); rate = rd?.usd?.[targetCurr.toLowerCase()] || 1; }
      } catch {}
    }

    const spyCounted = spyResults.filter(r => r != null).length;
    const spyTotalCents = spyResults.reduce<number>((s, r) => s + (r || 0), 0);
    const spyValue = (spyTotalCents / 100) * rate;

    const formatted = new Intl.NumberFormat(undefined, { style: "currency", currency: targetCurr }).format(spyValue);
    const breakdown = appids.map((appid, i) => ({
      appid, name: all.find((g: any) => g.appid === appid)?.name ?? `App ${appid}`,
      cents: spyResults[i], usd: spyResults[i] != null ? (spyResults[i]! / 100).toFixed(2) : null,
    })).filter(g => g.cents != null && g.cents > 0);

    console.log("[VALUE] SteamSpy fallback: USD", spyTotalCents / 100, "->", targetCurr, spyValue);

    return NextResponse.json({
      ok: true, cc, currency: formatted, currencyCode: targetCurr,
      value: spyValue, source: "steamspy (USD converted)", counted: spyCounted, owned: appids.length, breakdown,
    }, { status: 200, headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" } });
  }

  // Steam regional prices — already in local currency
  const currencyCode = results.find(r => r?.currencyCode)?.currencyCode || "USD";
  const totalCents = results.reduce<number>((s, r) => s + (r?.cents || 0), 0);
  const value = totalCents / 100;

  const formatted = new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(value);
  const breakdown = appids.map((appid, i) => ({
    appid, name: all.find((g: any) => g.appid === appid)?.name ?? `App ${appid}`,
    cents: results[i]?.cents ?? null,
    local: results[i] ? (results[i]!.cents / 100).toFixed(2) : null,
  })).filter(g => g.cents != null && g.cents > 0);

  console.log("[VALUE] Steam regional:", currencyCode, value, "counted:", steamCount, "/", appids.length);

  return NextResponse.json({
    ok: true, cc, currency: formatted, currencyCode,
    value, source: "steam (regional)", counted: steamCount, owned: appids.length, breakdown,
  }, { status: 200, headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" } });
}
