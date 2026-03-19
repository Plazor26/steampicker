"use client";

/**
 * Content-based recommendation engine.
 *
 * Pipeline:
 * 1. Build a "User DNA" tag vector from owned games, weighted by log(playtime).
 * 2. Score each unowned candidate by cosine similarity to the User DNA.
 * 3. Boost by review quality, discount, and recency.
 * 4. Return top N candidates.
 */

export type GameLite = {
  appid: number;
  name: string;
  header: string;
  hours: number;
  hours2w?: number;
};

export type Enriched = {
  genres: string[];
  categories: string[];
  price_cents: number | null;
  discount_pct: number;
  released_year: number | null;
  review_count?: number | null;
  metacritic_score?: number | null;
};

export type CandidateGame = {
  appid: number;
  name: string;
  header: string;
  price_cents?: number | null;
  discount_pct?: number;
};

export type PrescreenResult = (CandidateGame & {
  score: number;
  enriched?: Enriched;
  matchReasons?: string[];
})[];

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

/**
 * Build a weighted tag vector from the user's library.
 * Weighted by log(1 + hours) so mega-played games don't dominate.
 * Recent games get a 2.5x boost as a strong active-interest signal.
 * The resulting vector is L2-normalized so cosine similarity = dot product.
 */
function buildUserDNA(
  ownedGames: GameLite[],
  enrichMap: Record<number, Enriched>
): Record<string, number> {
  const vec: Record<string, number> = {};

  for (const g of ownedGames) {
    const e = enrichMap[g.appid];
    if (!e) continue;
    const w = Math.log1p(g.hours) + (g.hours2w ? Math.log1p(g.hours2w) * 2.5 : 0);
    if (w <= 0) continue;
    for (const genre of e.genres) vec[`g:${genre}`] = (vec[`g:${genre}`] || 0) + w;
    for (const cat of e.categories) vec[`c:${cat}`] = (vec[`c:${cat}`] || 0) + w;
  }

  // L2-normalize
  const mag = Math.sqrt(Object.values(vec).reduce((s, v) => s + v * v, 0));
  if (mag > 0) for (const k of Object.keys(vec)) vec[k] /= mag;

  return vec;
}

/**
 * Score one candidate game against the user DNA using cosine similarity.
 * Returns a score in [0, 1] and the top matched genre labels.
 */
function scoreCandidate(
  candidate: CandidateGame,
  e: Enriched | undefined,
  dna: Record<string, number>,
  nowYear: number
): { score: number; matchReasons: string[] } {
  // 1. Content similarity (primary signal)
  let similarity = 0;
  const matched: string[] = [];
  if (e && Object.keys(dna).length > 0) {
    let dot = 0;
    let candidateMagSq = 0;
    for (const genre of e.genres) {
      const w = dna[`g:${genre}`] || 0;
      dot += w;
      candidateMagSq += 1;
      if (w > 0.01) matched.push(genre);
    }
    for (const cat of e.categories) {
      dot += dna[`c:${cat}`] || 0;
      candidateMagSq += 1;
    }
    const candidateMag = Math.sqrt(candidateMagSq);
    similarity = candidateMag > 0 ? Math.min(1, dot / candidateMag) : 0;
  }

  // 2. Review quality
  let qualityScore = 0.4;
  if (e?.metacritic_score != null && e.metacritic_score > 0) {
    qualityScore = e.metacritic_score / 100;
  } else if (e?.review_count != null && e.review_count > 0) {
    qualityScore = Math.min(0.85, 0.4 + 0.45 * (Math.log10(e.review_count) / 5));
  }

  // 3. Discount
  const discountScore = Math.min(1, (e?.discount_pct ?? candidate.discount_pct ?? 0) / 100);

  // 4. Recency
  let recencyScore = 0.5;
  if (e?.released_year) {
    recencyScore = 1 - Math.min(1, Math.max(0, nowYear - e.released_year) / 10);
  }

  // 5. Light price penalty
  let pricePenalty = 0;
  const priceCents = e?.price_cents ?? candidate.price_cents;
  if (priceCents != null) {
    pricePenalty = Math.min(0.15, Math.max(0, (priceCents / 100 - 30) / 200));
  }

  const score =
    0.55 * similarity +
    0.20 * qualityScore +
    0.15 * discountScore +
    0.10 * recencyScore -
    pricePenalty;

  return { score: Math.max(0, Math.min(1, score)), matchReasons: matched.slice(0, 3) };
}

/**
 * Main prescreener.
 * @param ownedGames - user's library (used ONLY to build taste profile, never returned as recs)
 * @param candidates - unowned store games to score and rank
 * @param topN - max results to return
 */
export async function prescreen(
  ownedGames: GameLite[],
  candidates: CandidateGame[],
  topN = 30
): Promise<PrescreenResult> {
  if (!ownedGames?.length || !candidates?.length) return [];

  const nowYear = new Date().getFullYear();

  // For taste profiling: use top 50 most-played + all recently-played (max 80 total)
  const sortedOwned = [...ownedGames].sort((a, b) => b.hours - a.hours);
  const recentlyPlayed = ownedGames.filter((g) => (g.hours2w ?? 0) > 0);
  const tastePool = [
    ...new Map(
      [...sortedOwned.slice(0, 50), ...recentlyPlayed].map((g) => [g.appid, g])
    ).values(),
  ].slice(0, 80);

  // Enrich taste pool and candidates in parallel
  const [ownedEnrich, candidateEnrich] = await Promise.all([
    fetchEnrich(tastePool.map((g) => g.appid)),
    fetchEnrich(candidates.map((c) => c.appid)),
  ]);

  // Build user DNA
  const dna = buildUserDNA(tastePool, ownedEnrich);

  // Filter out demos/software/very old games
  const filtered = candidates.filter((c) => {
    if (!c.name || !c.header) return false;
    const e = candidateEnrich[c.appid];
    const cats = new Set(e?.categories || []);
    if (cats.has("Demo") || cats.has("Application") || cats.has("SteamVR Tool")) return false;
    if (e?.released_year) {
      const age = nowYear - e.released_year;
      const bigSale = (e.discount_pct || 0) >= 50;
      if (age > 12 && !bigSale) return false;
    }
    return true;
  });

  // Score and sort
  const scored = filtered.map((c) => {
    const e = candidateEnrich[c.appid];
    const { score, matchReasons } = scoreCandidate(c, e, dna, nowYear);
    return { ...c, score, enriched: e, matchReasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
