"use client";

/**
 * Content-based recommendation engine v2.
 *
 * Uses SteamSpy community tags as PRIMARY signal (much more granular than
 * Steam's official genres). Tags like "Souls-like", "Metroidvania", "Roguelike",
 * "Open World", "Story Rich" capture taste far better than broad genres.
 *
 * Pipeline:
 * 1. Build "User DNA" tag vector from owned games, weighted by playtime.
 *    - Community tags are the main signal (weighted 1.0)
 *    - Steam genres are secondary (weighted 0.5)
 *    - Categories are filtered to only gameplay-relevant ones (weighted 0.3)
 *    - Recently played games get a 3x boost (strong current-interest signal)
 * 2. Score candidates via cosine similarity to User DNA.
 * 3. Boost by review quality, discount, recency.
 * 4. Penalize tag-similarity to already-recommended games (diversity).
 * 5. Return top N.
 */

export type GameLite = {
  appid: number;
  name: string;
  header: string;
  hours: number;
  hours2w?: number;
};

export type Enriched = {
  tags?: string[];        // SteamSpy community tags
  genres: string[];       // Steam official genres
  categories: string[];   // Steam categories
  price_cents: number | null;
  discount_pct: number;
  released_year: number | null;
  review_count?: number | null;
  metacritic_score?: number | null;
  initialprice_cents?: number | null;
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

// Categories that actually describe gameplay (filter out noise like "Stats", "Cloud")
const GAMEPLAY_CATS = new Set([
  "Single-player", "Multi-player", "Co-op", "Online Co-Op", "Local Co-Op",
  "Online PvP", "Local PvP", "Cross-Platform Multiplayer", "MMO",
  "Full controller support", "Partial Controller Support",
  "VR Support", "VR Only", "VR Supported",
]);

// Tags to IGNORE (too generic or meta)
const IGNORE_TAGS = new Set([
  "Singleplayer", "Multiplayer", "Great Soundtrack", "Moddable",
  "Steam Achievements", "Steam Cloud", "Steam Trading Cards",
  "Steam Workshop", "Full controller support", "Partial Controller Support",
  "Remote Play on Phone", "Remote Play on Tablet", "Remote Play on TV",
  "Remote Play Together", "Family Sharing",
]);

/** Fetch enrichment with localStorage cache (7-day TTL) */
export async function fetchEnrich(appids: number[]): Promise<Record<number, Enriched>> {
  if (!appids.length) return {};

  const result: Record<number, Enriched> = {};
  const uncached: number[] = [];

  // Check localStorage for cached enrichment
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

  if (uncached.length === 0) return result;

  // Fetch uncached in batches of 40
  for (let i = 0; i < uncached.length; i += 40) {
    const batch = uncached.slice(i, i + 40);
    try {
      const res = await fetch("/api/steam/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appids: batch }),
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

/** Extract top N tag names from an enrichment map, sorted by frequency */
export function extractTopTags(enrichMap: Record<number, Enriched>, games: GameLite[], n = 8): string[] {
  const counts: Record<string, number> = {};
  for (const g of games) {
    const e = enrichMap[g.appid];
    if (!e) continue;
    const w = g.hours > 0 ? Math.sqrt(g.hours) : 0.2;
    const mult = (g.hours2w ?? 0) > 0 ? 3 : 1;
    for (const tag of (e.tags || []).filter(t => !IGNORE_TAGS.has(t)).slice(0, 8)) {
      counts[tag] = (counts[tag] || 0) + w * mult;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

/**
 * Build a weighted tag vector from the user's library.
 *
 * Tag sources (in priority order):
 * 1. SteamSpy community tags (t:tag) — weight 1.0
 * 2. Steam genres (g:genre) — weight 0.6
 * 3. Gameplay-relevant categories (c:cat) — weight 0.3
 *
 * Playtime weighting: sqrt(hours) gives diminishing returns without
 * letting 5000h games completely dominate.
 * Recently played: 3x multiplier (strong active interest signal).
 * Never played (0h): 0.2 weight (bought but didn't play = mild interest).
 */
function buildUserDNA(
  ownedGames: GameLite[],
  enrichMap: Record<number, Enriched>
): Record<string, number> {
  const vec: Record<string, number> = {};

  for (const g of ownedGames) {
    const e = enrichMap[g.appid];
    if (!e) continue;

    // Playtime weight
    let w = g.hours > 0 ? Math.sqrt(g.hours) : 0.2;
    // Recently played boost
    if (g.hours2w && g.hours2w > 0) w *= 3;

    if (w <= 0) continue;

    // Community tags (primary signal)
    const tags = (e.tags || []).filter(t => !IGNORE_TAGS.has(t));
    // Top tags get more weight (SteamSpy returns them sorted by votes)
    for (let i = 0; i < tags.length; i++) {
      const tagW = w * (1.0 - i * 0.03); // slight decay for lower-ranked tags
      if (tagW <= 0) break;
      vec[`t:${tags[i]}`] = (vec[`t:${tags[i]}`] || 0) + tagW;
    }

    // Steam genres (secondary)
    for (const genre of e.genres) {
      vec[`g:${genre}`] = (vec[`g:${genre}`] || 0) + w * 0.6;
    }

    // Gameplay categories (tertiary, filtered)
    for (const cat of e.categories) {
      if (GAMEPLAY_CATS.has(cat)) {
        vec[`c:${cat}`] = (vec[`c:${cat}`] || 0) + w * 0.3;
      }
    }
  }

  // L2-normalize
  const mag = Math.sqrt(Object.values(vec).reduce((s, v) => s + v * v, 0));
  if (mag > 0) for (const k of Object.keys(vec)) vec[k] /= mag;

  return vec;
}

/**
 * Score one candidate game against the user DNA.
 */
function scoreCandidate(
  candidate: CandidateGame,
  e: Enriched | undefined,
  dna: Record<string, number>,
  nowYear: number
): { score: number; matchReasons: string[] } {
  // 1. Content similarity (cosine)
  let dot = 0;
  let candidateMagSq = 0;
  const matched: string[] = [];

  if (e && Object.keys(dna).length > 0) {
    // Tags (primary)
    const tags = (e.tags || []).filter(t => !IGNORE_TAGS.has(t));
    for (const tag of tags) {
      const w = dna[`t:${tag}`] || 0;
      dot += w;
      candidateMagSq += 1;
      if (w > 0.005 && matched.length < 5) matched.push(tag);
    }
    // Genres
    for (const genre of e.genres) {
      const w = dna[`g:${genre}`] || 0;
      dot += w * 0.6;
      candidateMagSq += 0.36;
    }
    // Categories
    for (const cat of e.categories) {
      if (GAMEPLAY_CATS.has(cat)) {
        dot += (dna[`c:${cat}`] || 0) * 0.3;
        candidateMagSq += 0.09;
      }
    }
  }

  const candidateMag = Math.sqrt(candidateMagSq);
  const similarity = candidateMag > 0 ? Math.min(1, dot / candidateMag) : 0;

  // 2. Review quality (0-1)
  let quality = 0.3;
  if (e?.metacritic_score != null && e.metacritic_score > 0) {
    quality = e.metacritic_score / 100;
  } else if (e?.review_count != null && e.review_count > 0) {
    quality = Math.min(0.9, 0.3 + 0.6 * (Math.log10(e.review_count) / 5));
  }

  // 3. Discount boost
  const discount = Math.min(1, (e?.discount_pct ?? candidate.discount_pct ?? 0) / 100);

  // 4. Recency (newer = slightly better)
  let recency = 0.5;
  if (e?.released_year) {
    recency = 1 - Math.min(1, Math.max(0, nowYear - e.released_year) / 8);
  }

  // Final weighted score — similarity is king (65%)
  const score =
    0.65 * similarity +
    0.15 * quality +
    0.12 * discount +
    0.08 * recency;

  return { score: Math.max(0, Math.min(1, score)), matchReasons: matched };
}

/**
 * Main prescreener.
 */
export async function prescreen(
  ownedGames: GameLite[],
  candidates: CandidateGame[],
  topN = 30
): Promise<PrescreenResult> {
  if (!ownedGames?.length || !candidates?.length) return [];

  const nowYear = new Date().getFullYear();

  // Taste pool: top 100 most-played + all recently-played (deduped, max 120)
  const sortedOwned = [...ownedGames].sort((a, b) => b.hours - a.hours);
  const recentlyPlayed = ownedGames.filter((g) => (g.hours2w ?? 0) > 0);
  const tastePool = [
    ...new Map(
      [...sortedOwned.slice(0, 100), ...recentlyPlayed].map((g) => [g.appid, g])
    ).values(),
  ].slice(0, 120);

  // Phase 1: Enrich taste pool (cached in localStorage, fast on repeat visits)
  const ownedEnrich = await fetchEnrich(tastePool.map((g) => g.appid));
  const dna = buildUserDNA(tastePool, ownedEnrich);

  // Phase 2: Quick rough-score ALL candidates using only catalog data (no enrichment)
  // This is instant — no API calls
  const roughScored = candidates
    .filter(c => c.name && c.header)
    .map(c => {
      // Use any SteamSpy data that came with the catalog
      const spy = c as any;
      let roughScore = 0;
      // Discount boost
      roughScore += Math.min(0.3, (spy.discount_pct ?? 0) / 100 * 0.3);
      // Review quality from catalog's SteamSpy data
      const pos = spy.spy_positive ?? 0;
      const neg = spy.spy_negative ?? 0;
      const total = pos + neg;
      if (total > 0) roughScore += (pos / total) * 0.3;
      // Prefer games with more reviews (popularity)
      if (total > 1000) roughScore += 0.2;
      else if (total > 100) roughScore += 0.1;
      return { ...c, roughScore };
    })
    .sort((a, b) => b.roughScore - a.roughScore);

  // Phase 3: Enrich ONLY top 80 candidates (not all 800+)
  const topCandidates = roughScored.slice(0, 80);
  const candidateEnrich = await fetchEnrich(topCandidates.map(c => c.appid));

  // Phase 4: Precise scoring with full tag similarity
  const filtered = topCandidates.filter((c) => {
    const e = candidateEnrich[c.appid];
    const cats = new Set(e?.categories || []);
    if (cats.has("Demo") || cats.has("Application") || cats.has("SteamVR Tool")) return false;
    if (e?.released_year) {
      const age = nowYear - e.released_year;
      if (age > 10 && (e.discount_pct || 0) < 50) return false;
    }
    return true;
  });

  const scored = filtered.map((c) => {
    const e = candidateEnrich[c.appid];
    const { score, matchReasons } = scoreCandidate(c, e, dna, nowYear);
    return { ...c, score, enriched: e, matchReasons };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Diversity pass: penalize if too similar to already-selected games
  const selected: typeof scored = [];
  const selectedTagSets: Set<string>[] = [];

  for (const game of scored) {
    if (selected.length >= topN) break;

    // Check tag overlap with already-selected games
    const gameTags = new Set((game.enriched?.tags || []).filter(t => !IGNORE_TAGS.has(t)).slice(0, 10));
    let maxOverlap = 0;
    for (const prevTags of selectedTagSets) {
      let overlap = 0;
      for (const t of gameTags) if (prevTags.has(t)) overlap++;
      const overlapPct = gameTags.size > 0 ? overlap / gameTags.size : 0;
      maxOverlap = Math.max(maxOverlap, overlapPct);
    }

    // If > 80% tag overlap with any selected game, apply penalty
    if (maxOverlap > 0.8) {
      game.score *= 0.7;
    }

    selected.push(game);
    selectedTagSets.push(gameTags);
  }

  // Re-sort after diversity penalty
  selected.sort((a, b) => b.score - a.score);

  return selected;
}
