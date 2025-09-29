"use client";

/**
 * Math-based prescreener. Transparent, fast, no ML:
 *  - recent playtime and lifetime playtime
 *  - match to user's top genres/categories
 *  - discounts
 *  - mild preference for newer releases (or penalize very old)
 *  - optional price bias
 *
 * We return a ranked list; later you can pass top K to the ANN.
 */

export type GameLite = {
  appid: number;
  name: string;
  header: string;
  hours: number;    // lifetime
  hours2w?: number; // last 2 weeks
};

export type Enriched = {
  genres: string[];
  categories: string[];
  price_cents: number | null;
  discount_pct: number;
  released_year: number | null;
};

export type PrescreenInput = {
  allGames: GameLite[];
  // Derived “taste profile” from the user:
  favoriteGenres: string[];     // user top genres (by hours)
  favoriteCategories: string[]; // user top categories (by hours)
  // Global info:
  nowYear?: number;             // defaults to current year
};

export type PrescreenResult = (GameLite & {
  score: number;
  enriched?: Enriched;
})[];

/** Pull store enrich for a list of appids (batches internally) */
export async function fetchEnrich(appids: number[]): Promise<Record<number, Enriched>> {
  if (!appids.length) return {};
  const res = await fetch("/api/steam/enrich", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appids }),
  });
  if (!res.ok) return {};
  const j = await res.json().catch(() => null);
  return j?.items || {};
}

/** Build simple taste profile from user's own library if you don't have one */
export function inferTasteFromLibrary(all: GameLite[], enrichMap: Record<number, Enriched>) {
  // Count hours per tag
  const gCount: Record<string, number> = {};
  const cCount: Record<string, number> = {};
  for (const g of all) {
    const e = enrichMap[g.appid];
    if (!e) continue;
    const h = g.hours;
    for (const z of e.genres || []) gCount[z] = (gCount[z] || 0) + h;
    for (const z of e.categories || []) cCount[z] = (cCount[z] || 0) + h;
  }
  const top = (m: Record<string, number>, n = 6) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);

  return {
    favoriteGenres: top(gCount, 8),
    favoriteCategories: top(cCount, 6),
  };
}

/** Core scoring function (transparent weights; tweak freely) */
function scoreOne(
  g: GameLite,
  e: Enriched | undefined,
  taste: { favoriteGenres: string[]; favoriteCategories: string[] },
  nowYear: number
) {
  const hours = g.hours || 0;
  const h2 = g.hours2w || 0;

  // Normalize hours (soft cap)
  const hoursNorm = Math.min(1, hours / 200);  // 200h cap
  const h2Norm = Math.min(1, h2 / 20);         // 20h in 2 weeks cap

  // Tag match
  let genreMatch = 0;
  let catMatch = 0;
  if (e) {
    const gs = new Set(e.genres || []);
    const cs = new Set(e.categories || []);
    for (const z of taste.favoriteGenres) if (gs.has(z)) genreMatch += 1;
    for (const z of taste.favoriteCategories) if (cs.has(z)) catMatch += 1;
  }
  // Scale matches into [0..1]-ish
  const genreScore = Math.min(1, genreMatch / Math.max(1, taste.favoriteGenres.length));
  const catScore = Math.min(1, catMatch / Math.max(1, taste.favoriteCategories.length));

  // Discount
  const disc = Math.max(0, Math.min(100, e?.discount_pct ?? 0)) / 100;

  // Newer bias (mild): 0..1 where 1 ~ recent, 0 ~ very old
  let newness = 0.5;
  if (e?.released_year) {
    const age = Math.max(0, nowYear - e.released_year);
    newness = 1 - Math.min(1, age / 12); // 0 after ~12y
  }

  // Light penalty for high price (optional, keep tiny)
  let pricePenalty = 0;
  if (e?.price_cents != null) {
    const dollars = e.price_cents / 100;
    pricePenalty = Math.min(0.2, Math.max(0, (dollars - 40) / 200)); // +$40 adds at most 0.2 penalty
  }

  // Combine with weights (transparent)
  const score =
    0.30 * h2Norm +
    0.25 * hoursNorm +
    0.20 * genreScore +
    0.10 * catScore +
    0.12 * disc +
    0.08 * newness -
    pricePenalty;

  return Math.max(0, score);
}

/** Main prescreener */
export async function prescreen(input: PrescreenInput, topN = 60): Promise<PrescreenResult> {
  const { allGames, nowYear = new Date().getFullYear() } = input;
  if (!allGames?.length) return [];

  // Pull enrich in batches (we can enrich everything once; browser memory is fine)
  const enrichMap = await fetchEnrich(allGames.map((g) => g.appid));

  // If no taste provided, infer from library itself
  const taste =
    input.favoriteGenres?.length || input.favoriteCategories?.length
      ? { favoriteGenres: input.favoriteGenres, favoriteCategories: input.favoriteCategories }
      : inferTasteFromLibrary(allGames, enrichMap);

  // Filter quickly:
  const filtered = allGames.filter((g) => {
    const e = enrichMap[g.appid];
    // Basic sanity: must have a name and a header
    if (!g.name || !g.header) return false;
    // Deprioritize ancient titles unless recently played or on sale:
    const old =
      e?.released_year ? nowYear - e.released_year > 12 : false;
    const hasRecent = (g.hours2w || 0) > 0;
    const bigSale = (e?.discount_pct || 0) >= 40;

    if (old && !hasRecent && !bigSale) return false;

    // Skip “non-games” categories if you want (e.g., Software, Demos)
    const cats = new Set(e?.categories || []);
    if (cats.has("Demo") || cats.has("SteamVR Tool") || cats.has("Application")) return false;

    return true;
  });

  // Score
  const scored = filtered.map((g) => {
    const e = enrichMap[g.appid];
    const score = scoreOne(g, e, taste, nowYear);
    return { ...g, score, enriched: e };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Return top N
  return scored.slice(0, topN);
}
