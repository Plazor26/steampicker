"use client";

/**
 * Recommendation Engine v7 — Steam's collaborative filtering.
 *
 * Uses Steam's own "More Like This" algorithm instead of our tag matching.
 * For each of the user's top games, we fetch what Steam considers similar.
 * A game that Steam considers similar to MULTIPLE of your favorites = top rec.
 *
 * This uses the same collaborative filtering that powers Steam's store page
 * recommendations — trained on billions of player behavior data points.
 * No amount of tag matching can compete with this.
 */

export type GameLite = {
  appid: number;
  name: string;
  header: string;
  hours: number;
  hours2w?: number;
};

export type CandidateGame = {
  appid: number;
  name: string;
  header: string;
  price_cents?: number | null;
  discount_pct?: number;
  currencyCode?: string;
  similarTo?: string[];
  steamSimilarCount?: number;
  reviewScore?: number;
};

export type Enriched = {
  tags?: string[];
  genres: string[];
  categories: string[];
  price_cents: number | null;
  discount_pct: number;
  released_year: number | null;
  review_count?: number | null;
  metacritic_score?: number | null;
  initialprice_cents?: number | null;
};

export type PrescreenResult = (CandidateGame & {
  score: number;
  matchReasons?: string[];
})[];

// Non-game software — used to filter anchor games
const TOOL_TAGS = new Set([
  "Utilities", "Software", "Design & Illustration", "Photo Editing",
  "Video Production", "Audio Production", "Game Development",
  "Web Publishing", "Voice Control", "Education", "Tutorial",
]);

/* ─── Enrichment (no caching) ─── */
export async function fetchEnrich(appids: number[]): Promise<Record<number, Enriched>> {
  if (!appids.length) return {};
  const result: Record<number, Enriched> = {};
  for (let i = 0; i < appids.length; i += 40) {
    try {
      const res = await fetch("/api/steam/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appids: appids.slice(i, i + 40) }),
      });
      if (!res.ok) continue;
      const j = await res.json().catch(() => null);
      if (!j?.items) continue;
      for (const [id, data] of Object.entries(j.items)) {
        result[Number(id)] = data as Enriched;
      }
    } catch {}
  }
  return result;
}

/**
 * Pick anchor games — the user's top games to find similars for.
 * Filters out tools/non-games. Prioritizes recently played + high hours.
 */
export function pickAnchors(games: GameLite[], enrichMap: Record<number, Enriched>, max = 8): GameLite[] {
  const scored = games
    .filter(g => {
      const e = enrichMap[g.appid];
      // If recently played with >2h, ALWAYS include — it's clearly a real game
      if ((g.hours2w ?? 0) > 0 && g.hours > 2) return true;
      if (!e) return false;
      if ((e.tags || []).some(t => TOOL_TAGS.has(t))) return false;
      // Only filter by tag count if NOT recently played
      if ((e.tags || []).length + (e.genres || []).length < 2) return false;
      return true;
    })
    .map(g => {
      let weight = g.hours > 0 ? Math.sqrt(g.hours) : 0.5;
      if ((g.hours2w ?? 0) > 0) weight += 20;  // recently played = top priority
      if (g.hours > 2) weight *= 1.5;           // past refund
      if ((g.hours2w ?? 0) > 0 && g.hours > 2) weight *= 2.5; // recent + committed = strongest
      return { game: g, weight };
    })
    .sort((a, b) => b.weight - a.weight);

  // Pick top games BUT ensure genre diversity
  // Group by primary tag to ensure different tastes are represented
  const picked: GameLite[] = [];
  const tagBuckets = new Map<string, number>();

  for (const { game } of scored) {
    if (picked.length >= max) break;
    const e = enrichMap[game.appid];
    const primaryTag = (e?.tags || [])[0] || (e?.genres || [])[0] || "unknown";

    // Allow max 2 anchors per primary tag to ensure diversity
    const count = tagBuckets.get(primaryTag) || 0;
    if (count >= 2 && picked.length >= 4) continue;
    tagBuckets.set(primaryTag, count + 1);

    picked.push(game);
  }

  return picked;
}

/**
 * Score candidates based on Steam's similarity data.
 * Games similar to MORE of your anchor games = higher score.
 */
export function scoreAndRank(
  candidates: CandidateGame[],
  ownedAppids: Set<number>,
  anchorCount: number,
  topN = 30
): PrescreenResult {
  if (!candidates.length) return [];

  const scored: PrescreenResult = [];

  for (const c of candidates) {
    if (ownedAppids.has(c.appid)) continue;
    const similarCount = c.steamSimilarCount ?? 0;
    if (similarCount === 0) continue;

    // How many of your anchor games is this similar to?
    // Even 1 match is meaningful — Steam's algorithm is already curated
    const similarityScore = Math.min(1, similarCount / Math.max(anchorCount * 0.25, 1));

    // Review quality
    const review = c.reviewScore ?? 0.5;

    // Discount boost
    const discount = Math.min(1, (c.discount_pct ?? 0) / 100);

    const finalScore =
      0.65 * similarityScore +
      0.20 * review +
      0.15 * discount;

    scored.push({
      ...c,
      score: Math.max(0, Math.min(1, finalScore)),
      matchReasons: c.similarTo?.slice(0, 3).map(name => `Like ${name}`) || [],
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // Diversity: don't recommend too many games similar to the same anchor
  const selected: PrescreenResult = [];
  const reasonCounts = new Map<string, number>();

  for (const game of scored) {
    if (selected.length >= topN) break;
    // Limit per anchor game source to ensure diversity across all anchors
    const primaryReason = game.matchReasons?.[0] || "";
    const count = reasonCounts.get(primaryReason) || 0;
    if (count >= 4) continue;
    reasonCounts.set(primaryReason, count + 1);
    selected.push(game);
  }

  return selected;
}

/** Legacy compat */
export function extractTopTags() { return []; }
export function getAnchorSignatures() { return []; }
export function buildUserDNA(games: GameLite[], enrichMap: Record<number, Enriched>) {
  return { tagWeights: {}, topTags: [] as string[], synergies: [] as [string, string][] };
}
