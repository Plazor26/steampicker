import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/steam/value
 * Body: { appids: number[], cc: string }
 *
 * Fast library value calculator. Client sends appids directly
 * (no redundant profile re-fetch). Batches 100 appids per Steam request.
 */

const BATCH_SIZE = 100;

// In-memory cache
const cache = new Map<string, { cents: number; curr: string; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const appids: number[] = (body.appids || []).filter((n: any) => typeof n === "number");
  const cc: string = (body.cc || "US").toUpperCase();

  if (!appids.length) {
    return NextResponse.json({ ok: true, value: 0, currency: null, currencyCode: null, cc, counted: 0, owned: 0, partial: false });
  }

  type P = { cents: number; curr: string };
  const results = new Map<number, P>();
  const uncached: number[] = [];
  let skipped = 0;

  for (const id of appids) {
    const c = cache.get(`${id}:${cc}`);
    if (c && Date.now() - c.ts < CACHE_TTL) {
      if (c.curr === "SKIP") skipped++;
      else results.set(id, { cents: c.cents, curr: c.curr });
    } else {
      uncached.push(id);
    }
  }

  console.log("[VALUE] cc:", cc, "cached:", results.size, "skipped:", skipped, "need:", uncached.length);

  // Fetch uncached in batches of 100, no delay (single request per batch is fine)
  let blocked = false;
  for (let i = 0; i < uncached.length && !blocked; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    try {
      const r = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${batch.join(",")}&filters=price_overview&cc=${cc}`,
        { cache: "no-store" }
      );
      if (r.status === 403 || !r.ok) {
        for (const id of batch) cache.set(`${id}:${cc}`, { cents: 0, curr: "SKIP", ts: Date.now() });
        blocked = true;
        break;
      }
      const text = await r.text();
      if (text.startsWith("<")) {
        for (const id of batch) cache.set(`${id}:${cc}`, { cents: 0, curr: "SKIP", ts: Date.now() });
        blocked = true;
        break;
      }
      const j = JSON.parse(text);
      for (const id of batch) {
        const pov = j?.[String(id)]?.data?.price_overview;
        if (!pov) {
          cache.set(`${id}:${cc}`, { cents: 0, curr: "SKIP", ts: Date.now() });
          continue;
        }
        const cents = typeof pov.initial === "number" ? pov.initial : pov.final;
        const curr = pov.currency;
        if (typeof cents !== "number" || typeof curr !== "string") {
          cache.set(`${id}:${cc}`, { cents: 0, curr: "SKIP", ts: Date.now() });
          continue;
        }
        results.set(id, { cents, curr });
        cache.set(`${id}:${cc}`, { cents, curr, ts: Date.now() });
      }
    } catch { blocked = true; }
  }

  const counted = results.size;
  const resolved = counted + skipped;
  const isPartial = resolved < appids.length * 0.9;

  if (counted === 0) {
    console.log("[VALUE] FAILED: no prices, blocked:", blocked);
    return NextResponse.json({ ok: true, cc, currency: null, currencyCode: null, value: null, counted, owned: appids.length, partial: true });
  }

  const currencyCode = [...results.values()].find(r => r.curr)?.curr || "USD";
  let totalCents = 0;
  for (const r of results.values()) totalCents += r.cents;
  const value = totalCents / 100;

  let formatted: string;
  try {
    const locale = currencyCode === "INR" ? "en-IN" : currencyCode === "EUR" ? "de-DE" : currencyCode === "GBP" ? "en-GB" : undefined;
    formatted = new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(value);
  } catch {
    formatted = `${currencyCode} ${value.toFixed(2)}`;
  }

  console.log("[VALUE]", currencyCode, value, "counted:", counted, "/", appids.length, isPartial ? "(partial)" : "");

  return NextResponse.json({
    ok: true, cc, currency: formatted, currencyCode, value,
    counted, owned: appids.length, partial: isPartial,
  });
}
