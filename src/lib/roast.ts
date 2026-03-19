/**
 * Steam profile roast generator.
 * Pure functions — no side effects, no fetching.
 */

export type RoastInput = {
  personaName: string;
  totalGames: number;
  totalHours: number;       // total playtime in hours
  neverPlayed: number;
  libraryValue: number;     // in whatever currency
  currencySymbol: string;   // e.g. "$", "₹"
  topGame: { name: string; hours: number } | null;
  recentGames: number;      // count of recently played games
};

export type RoastResult = {
  headline: string;
  lines: string[];
  rating: string;
  grade: string;           // letter grade: S, A, B, C, D, F
  gradeColor: string;      // tailwind color class
};

// ─── Known game roasts ───
const GAME_ROASTS: Record<string, string> = {
  "counter-strike 2": "Your aim is still trash after {h}h. We checked.",
  "counter-strike: global offensive": "You peaked in 2017. It's time to accept it.",
  "dota 2": "{h}h in Dota. Blink twice if you need help.",
  "team fortress 2": "TF2 in {year}? The bots outnumber the players.",
  "pubg: battlegrounds": "{h}h dropping hot and dying instantly.",
  "rust": "{h}h of being raided while offline. Fun.",
  "garry's mod": "{h}h in Gmod. You're either 12 or 30. No in between.",
  "terraria": "{h}h and you still haven't beaten Moon Lord, have you?",
  "stardew valley": "{h}h farming virtual turnips. Your real plants are dead.",
  "the elder scrolls v: skyrim": "You've bought Skyrim {times} times. Todd Howard thanks you.",
  "grand theft auto v": "{h}h in GTA Online. How's that flying bike treating you?",
  "wallpaper engine": "Your most played 'game' isn't even a game. Legend.",
  "civilization v": "Just one more turn. For {h} hours.",
  "civilization vi": "You've spent {h}h failing at diplomacy virtually too.",
  "ark: survival evolved": "{h}h taming dinos. You could have become a paleontologist.",
  "destiny 2": "{h}h of content Bungie will delete anyway.",
  "warframe": "{h}h of grinding. The real endgame is fashion frame.",
  "path of exile": "{h}h and you still don't understand the passive tree.",
  "apex legends": "{h}h and your K/D is still below 1, isn't it?",
  "dead by daylight": "{h}h of getting tunneled at 5 gens.",
};

function getGameRoast(name: string, hours: number): string {
  const key = name.toLowerCase();
  const template = GAME_ROASTS[key];
  if (template) {
    return template
      .replace("{h}", Math.round(hours).toLocaleString())
      .replace("{year}", new Date().getFullYear().toString())
      .replace("{times}", String(Math.max(3, Math.floor(hours / 500))));
  }
  if (hours > 5000) return `${Math.round(hours).toLocaleString()}h in ${name}. That's not a hobby, that's a hostage situation.`;
  if (hours > 2000) return `${Math.round(hours).toLocaleString()}h in ${name}. Your Steam profile is a cry for help.`;
  if (hours > 1000) return `${Math.round(hours).toLocaleString()}h in ${name}. We get it, you like the game.`;
  return `Most played: ${name} (${Math.round(hours).toLocaleString()}h). No comment.`;
}

// ─── Main roast generator ───
export function generateRoast(input: RoastInput): RoastResult {
  const { totalGames, totalHours, neverPlayed, libraryValue, currencySymbol, topGame, recentGames } = input;

  const playedPct = totalGames > 0 ? Math.round(((totalGames - neverPlayed) / totalGames) * 100) : 0;
  const neverPlayedPct = totalGames > 0 ? Math.round((neverPlayed / totalGames) * 100) : 0;
  const costPerHour = totalHours > 0 ? libraryValue / totalHours : 0;
  const lines: string[] = [];

  // ── Headline (pick the most extreme stat) ──
  let headline = "";
  const extremes = [
    { score: neverPlayedPct, id: "shame" },
    { score: totalHours > 0 ? Math.min(totalHours / 50, 100) : 0, id: "hours" },
    { score: costPerHour > 0 ? Math.min(costPerHour * 8, 100) : 0, id: "cost" },
    { score: totalGames > 200 ? Math.min(totalGames / 10, 100) : 0, id: "hoarder" },
  ];
  const top = extremes.sort((a, b) => b.score - a.score)[0];

  switch (top.id) {
    case "shame":
      if (neverPlayedPct > 70) headline = `${neverPlayedPct}% of your library has never been opened. Steam is not a charity.`;
      else if (neverPlayedPct > 50) headline = `${neverPlayed} unplayed games. Your backlog has a backlog.`;
      else if (neverPlayedPct > 30) headline = `${neverPlayed} games gathering digital dust. Not great, not terrible.`;
      else headline = `Only ${neverPlayedPct}% unplayed? You're suspiciously responsible.`;
      break;
    case "hours":
      if (totalHours > 10000) headline = `${Math.round(totalHours).toLocaleString()} hours on Steam. That's ${(totalHours / 8760).toFixed(1)} years of your life. Gone.`;
      else if (totalHours > 5000) headline = `${Math.round(totalHours).toLocaleString()} hours logged. Your gaming chair has a permanent imprint of you.`;
      else if (totalHours > 2000) headline = `${Math.round(totalHours).toLocaleString()} hours. Your employer would like a word.`;
      else headline = `${Math.round(totalHours).toLocaleString()} hours total? Those are rookie numbers.`;
      break;
    case "cost":
      if (costPerHour > 10) headline = `${currencySymbol}${costPerHour.toFixed(2)} per hour of gaming. A movie theater is cheaper.`;
      else if (costPerHour > 5) headline = `You're paying ${currencySymbol}${costPerHour.toFixed(2)}/hour to game. Might as well rent them.`;
      else headline = `${currencySymbol}${costPerHour.toFixed(2)} per hour. Okay, you're getting your money's worth.`;
      break;
    case "hoarder":
      headline = `${totalGames.toLocaleString()} games. You don't have a library, you have a problem.`;
      break;
  }

  // ── Supporting lines ──

  // Pile of shame
  if (neverPlayedPct > 60) lines.push(`${neverPlayed} games you paid for and never touched. ${currencySymbol}${((neverPlayed / totalGames) * libraryValue).toFixed(0)} in the trash.`);
  else if (neverPlayedPct > 30) lines.push(`${neverPlayed} unplayed games. Your pile of shame could fill a GameStop.`);
  else if (neverPlayedPct > 10) lines.push(`Only ${neverPlayed} unplayed? You're either disciplined or poor.`);
  else lines.push(`Almost no unplayed games. You're the gamer others pretend to be.`);

  // Playtime
  if (totalHours > 8760) lines.push(`You've gamed for over a year of real time. The sun misses you.`);
  else if (totalHours > 2000) lines.push(`${Math.round(totalHours).toLocaleString()}h on Steam. You could've learned 3 languages.`);
  else if (totalHours > 500) lines.push(`${Math.round(totalHours).toLocaleString()}h logged. Certified gamer. Your posture is crying.`);
  else if (totalHours < 50) lines.push(`${Math.round(totalHours)}h total? Steam called. They want their account back.`);
  else lines.push(`${Math.round(totalHours).toLocaleString()}h total. Casual, but with commitment issues.`);

  // Top game
  if (topGame) {
    lines.push(getGameRoast(topGame.name, topGame.hours));
  }

  // Value
  if (libraryValue > 5000) lines.push(`Library worth ${currencySymbol}${libraryValue.toLocaleString()}. That's a vacation you'll never take.`);
  else if (libraryValue > 1000) lines.push(`${currencySymbol}${libraryValue.toLocaleString()} in games. Your wallet filed for divorce.`);
  else if (libraryValue > 100) lines.push(`${currencySymbol}${libraryValue.toLocaleString()} library. Budget gamer with expensive taste.`);

  // Recent activity
  if (recentGames === 0) lines.push(`No recent activity. Even Steam forgot about you.`);

  // ── Rating ──
  let rating = "Casual Carl";
  let grade = "C";
  let gradeColor = "text-yellow-400";

  // Score based on how "roastable" they are
  const roastScore = neverPlayedPct * 0.3 + Math.min(totalHours / 100, 30) + Math.min(totalGames / 20, 20) + (costPerHour > 5 ? 20 : costPerHour > 2 ? 10 : 0);

  if (roastScore > 70) { rating = "Steam Whale"; grade = "S"; gradeColor = "text-red-400"; }
  else if (roastScore > 55) { rating = "Certified Hoarder"; grade = "A"; gradeColor = "text-orange-400"; }
  else if (roastScore > 40) { rating = "Backlog Enjoyer"; grade = "B"; gradeColor = "text-yellow-400"; }
  else if (roastScore > 25) { rating = "Casual Gamer"; grade = "C"; gradeColor = "text-green-400"; }
  else if (roastScore > 10) { rating = "Tourist"; grade = "D"; gradeColor = "text-blue-400"; }
  else { rating = "NPC"; grade = "F"; gradeColor = "text-gray-400"; }

  return { headline, lines: lines.slice(0, 4), rating, grade, gradeColor };
}
