// src/app/api/steam/value/[steamId]/route.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Uses SteamSpy API for price data instead of Steam's appdetails endpoint.
 * Benefits:
 *   - No rate limiting / 403 issues (SteamSpy is a public API)
 *   - Returns `initialprice` (base price, non-sale) directly
 *   - One request per game (lightweight)
 * SteamSpy prices are always in USD cents.
 */

const CONCURRENCY = 10;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ steamId: string }> }
) {
  const { steamId } = await ctx.params;

  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid steamId (expected 17-digit SteamID64)" },
      { status: 400 }
    );
  }

  // Pull owned games
  const baseUrl = req.nextUrl.origin;
  const profRes = await fetch(`${baseUrl}/api/steam/profile/${steamId}`, { cache: "no-store" });
  if (!profRes.ok) {
    return NextResponse.json({ ok: false, error: `Profile fetch ${profRes.status}` }, { status: 502 });
  }
  const prof = await profRes.json();
  const all = prof?.library?.allGames ?? [];
  if (!Array.isArray(all) || !all.length) {
    return NextResponse.json({ ok: true, value: 0, currencyCode: "USD", currency: "$", cc: "US" }, { status: 200 });
  }

  // Fetch price from SteamSpy (always USD)
  async function fetchPrice(appid: number): Promise<number | null> {
    try {
      const r = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`, {
        next: { revalidate: 86400 }, // cache 24h — prices don't change often
      });
      if (!r.ok) return null;
      const j = await r.json();
      // initialprice = base price (non-sale) in USD cents
      // price = current price (may be discounted)
      const base = typeof j?.initialprice === "string" ? parseInt(j.initialprice, 10)
        : typeof j?.initialprice === "number" ? j.initialprice : null;
      if (base != null && !isNaN(base) && base > 0) return base;
      // Fallback to current price
      const current = typeof j?.price === "string" ? parseInt(j.price, 10)
        : typeof j?.price === "number" ? j.price : null;
      return current != null && !isNaN(current) && current > 0 ? current : null;
    } catch {
      return null;
    }
  }

  // Concurrency pool
  const appids: number[] = all.map((g: any) => g.appid).filter((n: any) => typeof n === "number");
  let idx = 0;
  const results: (number | null)[] = new Array(appids.length).fill(null);

  async function worker() {
    while (idx < appids.length) {
      const i = idx++;
      results[i] = await fetchPrice(appids[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, appids.length) }, () => worker())
  );

  const counted = results.filter(r => r != null).length;
  const totalCents = results.reduce<number>((sum, r) => sum + (r || 0), 0);
  const value = totalCents / 100;

  // SteamSpy returns USD. Attempt currency conversion using a free API.
  const { searchParams } = new URL(req.url);
  const qCC = searchParams.get("cc")?.toUpperCase();
  const ipCC =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-forwarded-country") ||
    req.headers.get("cf-ipcountry") ||
    undefined;
  const cc = (qCC || ipCC || "US").toUpperCase();

  // Map country code to currency code
  const CC_TO_CURRENCY: Record<string, string> = {
    US: "USD", GB: "GBP", IN: "INR", JP: "JPY", CN: "CNY", KR: "KRW",
    BR: "BRL", RU: "RUB", AU: "AUD", CA: "CAD", MX: "MXN", TR: "TRY",
    PL: "PLN", UA: "UAH", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
    PH: "PHP", SG: "SGD", TH: "THB", VN: "VND", MY: "MYR", ID: "IDR",
    ZA: "ZAR", NZ: "NZD", NO: "NOK", SE: "SEK", DK: "DKK", CH: "CHF",
    HK: "HKD", TW: "TWD", SA: "SAR", AE: "AED", IL: "ILS", EG: "EGP",
    KZ: "KZT", QA: "QAR", KW: "KWD", UY: "UYU", CR: "CRC",
    // Eurozone
    DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
    AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", SK: "EUR",
    SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", LU: "EUR", MT: "EUR", CY: "EUR",
  };

  const targetCurrency = CC_TO_CURRENCY[cc] || "USD";
  let convertedValue = value;
  let usedCurrency = "USD";

  if (targetCurrency !== "USD") {
    try {
      // Free currency conversion API (no key required)
      const rateRes = await fetch(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`,
        { next: { revalidate: 86400 } }
      );
      if (rateRes.ok) {
        const rateData = await rateRes.json();
        const rate = rateData?.usd?.[targetCurrency.toLowerCase()];
        if (typeof rate === "number" && rate > 0) {
          convertedValue = value * rate;
          usedCurrency = targetCurrency;
        }
      }
    } catch {}
  }

  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: usedCurrency,
    maximumFractionDigits: usedCurrency === "JPY" || usedCurrency === "KRW" ? 0 : 2,
  }).format(convertedValue);

  return NextResponse.json(
    {
      ok: true,
      cc,
      currency: formatted,
      currencyCode: usedCurrency,
      value: convertedValue,
      valueUSD: value,
      counted,
      owned: appids.length,
    },
    { status: 200, headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" } }
  );
}
