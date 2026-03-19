"use client";

/**
 * Recommendation Engine v5 — "Spotify-grade"
 *
 * Three breakthroughs over previous versions:
 *
 * 1. NEGATIVE SIGNALS — Games owned but never played (<0.5h) are ANTI-signals.
 *    Tags from unplayed games get negative weight. A candidate matching those
 *    tags gets penalized. This is how Netflix knows you DIDN'T like something.
 *
 * 2. IDF (Inverse Document Frequency) — A tag appearing on 45/50 of your games
 *    ("Action") tells us nothing. A tag appearing on 3/50 games you've sunk
 *    500h into ("Souls-like") is a goldmine signal. Rare tags weighted higher,
 *    just like how search engines weight rare keywords.
 *
 * 3. TAG SYNERGY — If your top games share "Open World" + "Story Rich" together,
 *    a candidate matching BOTH scores exponentially higher than one matching
 *    just one. This captures taste combinations, not just individual tags.
 *
 * Architecture:
 * - Catalog API (server): fetches SteamSpy tag lists, returns candidates with matchedTags
 * - This file (client): builds user DNA → scores candidates. No external fetches.
 * - All enrichment data cached in localStorage (7-day TTL).
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
  matchedTags?: string[];
  reviewScore?: number;
  currencyCode?: string;
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

// Useless for taste profiling — too broad or meta
const IGNORE_TAGS = new Set([
  "Singleplayer", "Multiplayer", "Great Soundtrack", "Moddable",
  "Steam Achievements", "Steam Cloud", "Steam Trading Cards",
  "Steam Workshop", "Full controller support", "Partial Controller Support",
  "Remote Play on Phone", "Remote Play on Tablet", "Remote Play on TV",
  "Remote Play Together", "Family Sharing",
  "Action", "Adventure", "Indie", "Casual", "Simulation", "Strategy", "RPG",
  "Free to Play", "Early Access", "2D", "3D", "Colorful",
  "First-Person", "Third Person", "Shooter", "FPS",
  "Atmospheric", "Funny", "Difficult", "Replay Value",
  "Controller", "Mouse only",
]);

/* ─── localStorage-cached enrichment ─── */
export async function fetchEnrich(appids: number[]): Promise<Record<number, Enriched>> {
  if (!appids.length) return {};
  const result: Record<number, Enriched> = {};
  const uncached: number[] = [];

  for (const id of appids) {
    try {
      const raw = localStorage.getItem(`e:${id}`);
      if (raw) {
        const { ts, d } = JSON.parse(raw);
        if (Date.now() - ts < 7 * 86400000) { result[id] = d; continue; }
      }
    } catch {}
    uncached.push(id);
  }

  for (let i = 0; i < uncached.length; i += 40) {
    try {
      const res = await fetch("/api/steam/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appids: uncached.slice(i, i + 40) }),
      });
      if (!res.ok) continue;
      const j = await res.json().catch(() => null);
      if (!j?.items) continue;
      for (const [id, data] of Object.entries(j.items)) {
        result[Number(id)] = data as Enriched;
        try { localStorage.setItem(`e:${id}`, JSON.stringify({ ts: Date.now(), d: data })); } catch {}
      }
    } catch {}
  }
  return result;
}

/* ─── User DNA Builder ─── */

type UserDNA = {
  /** Weighted tag scores — positive = likes, negative = dislikes */
  tagWeights: Record<string, number>;
  /** Top positive tags for catalog query */
  topTags: string[];
  /** Top tag PAIRS the user likes together (synergy signal) */
  synergies: [string, string][];
};

export function buildUserDNA(
  games: GameLite[],
  enrichMap: Record<number, Enriched>,
): UserDNA {
  // Step 1: Classify games by engagement level
  const tagDocs: Record<string, number> = {}; // how many games have each tag
  const tagWeightSum: Record<string, number> = {};
  let gamesWithTags = 0;

  // Track tag co-occurrences on highly-played games
  const cooccurrence: Record<string, number> = {};

  for (const g of games) {
    const e = enrichMap[g.appid];
    if (!e) continue;
    const tags = (e.tags || []).filter(t => !IGNORE_TAGS.has(t)).slice(0, 15);
    if (!tags.length) continue;

    gamesWithTags++;

    // Engagement-based weight:
    // - 0h (never played): negative signal (-0.5)
    // - 0.1-0.5h: slight negative (-0.2) — tried and abandoned
    // - 0.5-2h: neutral (0.3)
    // - 2-10h: moderate positive (sqrt)
    // - 10h+: strong positive (sqrt)
    // - Recently played: 3x multiplier
    let weight: number;
    if (g.hours <= 0) weight = -0.5;
    else if (g.hours < 0.5) weight = -0.2;
    else if (g.hours < 2) weight = 0.3;
    else weight = Math.sqrt(g.hours);

    if ((g.hours2w ?? 0) > 0) weight = Math.abs(weight) * 3; // recent = always positive boost

    for (const tag of tags) {
      tagDocs[tag] = (tagDocs[tag] || 0) + 1;
      tagWeightSum[tag] = (tagWeightSum[tag] || 0) + weight;
    }

    // Track tag pairs on well-played games (for synergy detection)
    if (g.hours > 5) {
      for (let i = 0; i < Math.min(tags.length, 8); i++) {
        for (let j = i + 1; j < Math.min(tags.length, 8); j++) {
          const pair = [tags[i], tags[j]].sort().join("||");
          cooccurrence[pair] = (cooccurrence[pair] || 0) + weight;
        }
      }
    }
  }

  // Step 2: Apply IDF weighting
  // IDF = log(totalGames / gamesWithTag) — rare tags score higher
  const tagWeights: Record<string, number> = {};
  for (const [tag, rawWeight] of Object.entries(tagWeightSum)) {
    const docFreq = tagDocs[tag] || 1;
    const idf = Math.log((gamesWithTags + 1) / (docFreq + 1)) + 1; // smoothed IDF
    tagWeights[tag] = rawWeight * idf;
  }

  // Step 3: Extract top positive tags (for catalog query)
  const topTags = Object.entries(tagWeights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t);

  // Step 4: Extract top tag synergies (pairs that co-occur on loved games)
  const synergies = Object.entries(cooccurrence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pair]) => pair.split("||") as [string, string]);

  return { tagWeights, topTags, synergies };
}

/* ─── Convenience: extract just the tag names for the catalog API ─── */
export function extractTopTags(enrichMap: Record<number, Enriched>, games: GameLite[], n = 10): string[] {
  const dna = buildUserDNA(games, enrichMap);
  return dna.topTags.slice(0, n);
}

/* ─── Score and Rank Candidates ─── */
export function scoreAndRank(
  candidates: CandidateGame[],
  dna: UserDNA,
  ownedAppids: Set<number>,
  topN = 30
): PrescreenResult {
  if (!candidates.length || !dna.topTags.length) return [];

  // Normalize tag weights to [0, 1] range for scoring
  const maxWeight = Math.max(...Object.values(dna.tagWeights).map(Math.abs), 1);

  const scored: PrescreenResult = [];

  for (const c of candidates) {
    if (ownedAppids.has(c.appid)) continue;
    const matched = c.matchedTags || [];
    if (matched.length === 0) continue;

    // 1. TAG MATCH SCORE (with IDF weighting)
    let positiveScore = 0;
    let negativeScore = 0;
    const matchReasons: string[] = [];

    for (const tag of matched) {
      const w = (dna.tagWeights[tag] || 0) / maxWeight;
      if (w > 0) {
        positiveScore += w;
        matchReasons.push(tag);
      } else if (w < 0) {
        negativeScore += Math.abs(w);
      }
    }

    // 2. SYNERGY BONUS — candidate matches tag PAIRS the user loves together
    let synergyBonus = 0;
    const matchedSet = new Set(matched);
    for (const [a, b] of dna.synergies) {
      if (matchedSet.has(a) && matchedSet.has(b)) {
        synergyBonus += 0.15; // significant bonus per synergy pair matched
      }
    }

    // 3. COVERAGE BONUS — matching more tags = more confident recommendation
    const coverageBonus = Math.min(0.2, matched.length * 0.04);

    // 4. REVIEW QUALITY
    const reviewScore = c.reviewScore ?? 0.5;

    // 5. DISCOUNT (mild boost)
    const discount = Math.min(1, (c.discount_pct ?? 0) / 100);

    // Combine signals
    const tagSignal = Math.max(0, positiveScore - negativeScore * 0.5);
    const normalizedTag = Math.min(1, tagSignal / 2); // cap at 1

    const finalScore =
      0.55 * normalizedTag +
      0.15 * synergyBonus +
      0.10 * coverageBonus +
      0.12 * reviewScore +
      0.08 * discount;

    scored.push({
      ...c,
      score: Math.max(0, Math.min(1, finalScore)),
      matchReasons: matchReasons.slice(0, 5),
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // DIVERSITY PASS — mix of "safe" and "stretch" recommendations
  const selected: PrescreenResult = [];
  const seenTagCombos = new Map<string, number>();

  for (const game of scored) {
    if (selected.length >= topN) break;

    // Limit games with identical tag combos (max 2)
    const comboKey = (game.matchReasons || []).sort().join(",");
    const count = seenTagCombos.get(comboKey) || 0;
    if (count >= 2) continue;
    seenTagCombos.set(comboKey, count + 1);

    selected.push(game);
  }

  return selected;
}
