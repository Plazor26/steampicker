/**
 * Steam profile roast generator.
 * Pure functions — no side effects, no fetching.
 */

export type RoastInput = {
  personaName: string;
  totalGames: number;
  totalHours: number;
  neverPlayed: number;
  libraryValue: number;
  currencySymbol: string;
  topGame: { name: string; hours: number } | null;
  recentGames: number;
};

export type RoastResult = {
  headline: string;
  lines: string[];
  rating: string;
  grade: string;
  gradeColor: string;
};

// ─── Pick a random item from an array ───
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Known game roasts (multiple per game for variety) ───
const GAME_ROASTS: Record<string, string[]> = {
  "counter-strike 2": [
    "{h}h in CS2. Your aim is still trash. We checked.",
    "Silver after {h}h? That's not a rank, that's a lifestyle.",
    "{h}h of 'one more game' at 3AM. Your sleep schedule filed a restraining order.",
    "{h}h and you still buy a Negev on round 2.",
  ],
  "counter-strike: global offensive": [
    "You peaked in 2017. The game is dead. You're still here.",
    "{h}h in CSGO. The game literally shut down and you're still on the leaderboard.",
  ],
  "dota 2": [
    "{h}h in Dota. Blink twice if you need help.",
    "{h}h and your MMR is still calibrating... your life choices.",
    "Dota 2 for {h}h. Your therapist should bill Valve.",
    "{h}h and you still blame your supports.",
  ],
  "team fortress 2": [
    "TF2 in {year}? Bots have more hours than you. Literally.",
    "{h}h in TF2. Even the bots feel sorry for you.",
  ],
  "pubg: battlegrounds": [
    "{h}h dropping hot and dying instantly. Every. Single. Time.",
    "You've been playing PUBG for {h}h and your best strategy is still 'hide in a bathroom'.",
  ],
  "rust": [
    "{h}h of being raided while offline. It's not a game, it's emotional damage.",
    "Rust for {h}h. You've been griefed more than helped in your entire gaming career.",
    "{h}h in Rust. Your base was raided while you read this.",
  ],
  "garry's mod": [
    "{h}h in Gmod. You're either 12 or 30. No in between.",
    "Gmod for {h}h. Your DarkRP addiction is not a personality.",
  ],
  "terraria": [
    "{h}h and you still haven't beaten Moon Lord, have you?",
    "{h}h of 'just one more ore vein'. The mine owns you now.",
  ],
  "stardew valley": [
    "{h}h farming virtual turnips. Your real plants are dead.",
    "You've spent {h}h in Stardew. Pierre makes more money than you.",
    "{h}h and you still can't decide between Shane and Sebastian.",
  ],
  "the elder scrolls v: skyrim": [
    "You've bought Skyrim {times} times. Todd Howard sends his regards.",
    "{h}h in Skyrim. 80% of that is modding, 20% is crashing.",
    "{h}h and you still haven't finished the main quest.",
  ],
  "grand theft auto v": [
    "{h}h in GTA Online. Your K/D ratio has a K/D ratio.",
    "GTA V for {h}h. You've spent more on shark cards than your rent.",
  ],
  "wallpaper engine": [
    "Your most played 'game' is literally animated wallpaper. Absolute legend.",
    "{h}h in Wallpaper Engine. You game harder picking backgrounds than playing games.",
  ],
  "civilization v": [
    "Just one more turn. For {h} hours. Your family misses you.",
    "{h}h in Civ V. Gandhi has nuked you more times than you've showered.",
  ],
  "civilization vi": [
    "You've spent {h}h failing at diplomacy. IRL and in-game.",
    "{h}h in Civ VI. You've restarted more saves than conversations.",
  ],
  "destiny 2": [
    "{h}h of content Bungie will sunset anyway.",
    "Destiny 2 for {h}h. You grind more than a coffee shop.",
  ],
  "warframe": [
    "{h}h of grinding. The real endgame is fashion frame and you know it.",
    "Warframe for {h}h. You've spent more time in trade chat than combat.",
  ],
  "path of exile": [
    "{h}h and you still don't understand the passive tree. Nobody does.",
    "PoE for {h}h. Your stash tabs cost more than most AAA games.",
  ],
  "apex legends": [
    "{h}h in Apex. Your K/D and your GPA have something in common.",
    "Apex for {h}h. You've been third-partied more than a political candidate.",
  ],
  "dead by daylight": [
    "{h}h of getting tunneled at 5 gens. And you keep coming back.",
    "DbD for {h}h. Stockholm syndrome is not a perk.",
  ],
  "elden ring": [
    "{h}h in Elden Ring. 'Git gud' was not a suggestion, it was a threat.",
    "Elden Ring for {h}h. Malenia has your number on speed dial.",
    "{h}h and you still use a guide for every boss. No judgment. Okay, some judgment.",
  ],
  "fortnite": [
    "{h}h in Fortnite. Your building skills are cracked. Your social life isn't.",
    "Fortnite for {h}h. You floss IRL, don't you?",
  ],
  "minecraft": [
    "{h}h in Minecraft. You've built more homes here than you'll ever own.",
    "Minecraft for {h}h. The creepers have become family.",
  ],
  "ark: survival evolved": [
    "{h}h taming dinos. You could have earned an actual paleontology degree.",
    "ARK for {h}h. Your GPU aged faster than you did.",
  ],
  "rocket league": [
    "{h}h in Rocket League. Still whiffing aerials. Still typing 'What a save!'",
    "RL for {h}h. Your car flies better than your life trajectory.",
  ],
  "among us": [
    "{h}h in Among Us. You're still sus.",
  ],
  "baldur's gate 3": [
    "{h}h in BG3. That's a lot of save-scumming for a 'natural 20'.",
    "BG3 for {h}h. You've romanced everyone including the bear. ESPECIALLY the bear.",
  ],
  "palworld": [
    "{h}h in Palworld. Pokemon called. Their lawyers are on the way.",
  ],
  "lethal company": [
    "{h}h in Lethal Company. The real monster was the quota all along.",
  ],
  "helldivers 2": [
    "{h}h spreading democracy. Liberty doesn't sleep and neither do you.",
    "Helldivers 2 for {h}h. You've died for Super Earth more than you've lived for yourself.",
  ],
  "valorant": [
    "{h}h in Valorant. Your instalock Jett is not the flex you think it is.",
    "Valorant for {h}h. You've spent more time in deathmatch 'warming up' than actually playing.",
  ],
};

function getGameRoast(name: string, hours: number): string {
  const key = name.toLowerCase();
  const templates = GAME_ROASTS[key];
  if (templates) {
    return pick(templates)
      .replace("{h}", Math.round(hours).toLocaleString())
      .replace("{year}", new Date().getFullYear().toString())
      .replace("{times}", String(Math.max(3, Math.floor(hours / 500))));
  }
  // Generic roasts for unknown games based on hours
  if (hours > 5000) return pick([
    `${Math.round(hours).toLocaleString()}h in ${name}. That's not a hobby, that's a hostage situation.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. The game doesn't even love you back.`,
    `You've spent ${Math.round(hours).toLocaleString()}h in ${name}. That's ${(hours / 8760).toFixed(1)} years. Of your ONE life.`,
  ]);
  if (hours > 2000) return pick([
    `${Math.round(hours).toLocaleString()}h in ${name}. Your Steam profile is a cry for help.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. Even the devs don't play it that much.`,
  ]);
  if (hours > 1000) return pick([
    `${Math.round(hours).toLocaleString()}h in ${name}. We get it, you like the game. You don't need to marry it.`,
    `Most played: ${name} with ${Math.round(hours).toLocaleString()}h. Touch grass? Never heard of it.`,
  ]);
  return pick([
    `Most played: ${name} (${Math.round(hours).toLocaleString()}h). No comment.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. Acceptable. Barely.`,
  ]);
}

// ─── Headline generators ───
const SHAME_HEADLINES = [
  (pct: number, n: number) => `${pct}% of your library is untouched. Steam isn't a museum.`,
  (pct: number, n: number) => `${n} games you bought and never opened. Your wallet wants a refund on YOU.`,
  (pct: number, n: number) => `You've ignored ${pct}% of your games. They're plotting revenge in your library.`,
  (pct: number, n: number) => `${n} unplayed games. That's not a backlog, that's a graveyard.`,
  (pct: number, n: number) => `${pct}% unplayed. Your Steam library is 90% window shopping receipts.`,
];
const SHAME_LOW_HEADLINES = [
  (pct: number) => `Only ${pct}% unplayed? You actually play your games? Psychopath behavior.`,
  (pct: number) => `${pct}% unplayed. You're disgustingly responsible. Stop it.`,
];

const HOURS_HIGH_HEADLINES = [
  (h: string, y: string) => `${h} hours on Steam. That's ${y} years of your life. Gone. No refunds.`,
  (h: string) => `${h} hours logged. Your gaming chair has filed for workers' comp.`,
  (h: string) => `${h} hours. You've gamed more than some people have lived.`,
  (h: string) => `${h} hours on Steam. The sun has filed a missing person report.`,
];
const HOURS_MED_HEADLINES = [
  (h: string) => `${h} hours. Your employer would like a word. Several, actually.`,
  (h: string) => `${h} hours of gaming. Your chiropractor sends thank-you cards.`,
];
const HOURS_LOW_HEADLINES = [
  (h: string) => `${h} hours total? Steam thinks you're a bot.`,
  (h: string) => `${h} hours. That's not gaming, that's browsing with extra steps.`,
];

const COST_HIGH_HEADLINES = [
  (c: string) => `${c} per hour of gaming. A movie theater is cheaper. So is therapy.`,
  (c: string) => `You're paying ${c}/hour to game. Rent would be cheaper.`,
];
const HOARDER_HEADLINES = [
  (n: string) => `${n} games. You don't have a library, you have a cry for help.`,
  (n: string) => `${n} games collected. Pokémon had 151. You have a problem.`,
  (n: string) => `${n} games. You've spent more time buying games than playing them.`,
];

// ─── Supporting line generators ───
const SHAME_LINES = [
  (n: number, v: string) => `${n} games you paid for and never touched. ${v} in the trash.`,
  (n: number) => `${n} unplayed games. Your pile of shame could fill a GameStop. If those still existed.`,
  (n: number) => `${n} games rotting in your library. Even Steam sales can't justify this.`,
];
const SHAME_LOW_LINES = [
  (n: number) => `Only ${n} unplayed? You're either disciplined or broke. We're guessing broke.`,
  () => `Almost no unplayed games. You're the gamer others pretend to be.`,
];

const HOURS_LINES = [
  () => `You've gamed for over a year of real time. The sun misses you.`,
  (h: string) => `${h}h on Steam. You could've learned 3 languages. Or touched grass once.`,
  (h: string) => `${h}h logged. Your posture called. It wants a divorce.`,
  (h: string) => `${h}h. You've spent more time gaming than some people spend sleeping.`,
];
const HOURS_LOW_LINES = [
  (h: string) => `${h}h total? Steam called. They want their account back.`,
  (h: string) => `${h}h. Even your refunded games have more playtime.`,
];

const VALUE_LINES = [
  (v: string) => `Library worth ${v}. That's a vacation you'll never take because you're gaming.`,
  (v: string) => `${v} in games. Your wallet didn't sign up for this relationship.`,
  (v: string) => `${v} spent. You could've bought a car. A bad one, but it would move.`,
];
const VALUE_LOW_LINES = [
  (v: string) => `${v} library. Even your wallet is disappointed.`,
  (v: string) => `Library worth ${v}. Budget gamer with expensive taste.`,
];

const RECENT_LINES = [
  () => `No recent activity. Even Steam forgot about you.`,
  () => `Zero hours this month. Your library is collecting more dust than your bookshelf.`,
];

// ─── Main roast generator ───
export function generateRoast(input: RoastInput): RoastResult {
  const { totalGames, totalHours, neverPlayed, libraryValue, currencySymbol, topGame, recentGames } = input;

  const playedPct = totalGames > 0 ? Math.round(((totalGames - neverPlayed) / totalGames) * 100) : 0;
  const neverPlayedPct = totalGames > 0 ? Math.round((neverPlayed / totalGames) * 100) : 0;
  const costPerHour = totalHours > 0 ? libraryValue / totalHours : 0;
  const lines: string[] = [];
  const fmtH = Math.round(totalHours).toLocaleString();
  const fmtV = `${currencySymbol}${libraryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtCPH = `${currencySymbol}${costPerHour.toFixed(2)}`;

  // ── Headline ──
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
      if (neverPlayedPct > 30) headline = pick(SHAME_HEADLINES)(neverPlayedPct, neverPlayed);
      else headline = pick(SHAME_LOW_HEADLINES)(neverPlayedPct);
      break;
    case "hours":
      if (totalHours > 5000) headline = pick(HOURS_HIGH_HEADLINES)(fmtH, (totalHours / 8760).toFixed(1));
      else if (totalHours > 1000) headline = pick(HOURS_MED_HEADLINES)(fmtH);
      else headline = pick(HOURS_LOW_HEADLINES)(fmtH);
      break;
    case "cost":
      headline = pick(COST_HIGH_HEADLINES)(fmtCPH);
      break;
    case "hoarder":
      headline = pick(HOARDER_HEADLINES)(totalGames.toLocaleString());
      break;
  }

  // ── Supporting lines (one from each category) ──

  // Pile of shame
  if (neverPlayedPct > 30) {
    const wastedVal = `${currencySymbol}${Math.round((neverPlayed / totalGames) * libraryValue).toLocaleString()}`;
    lines.push(pick(SHAME_LINES)(neverPlayed, wastedVal));
  } else {
    lines.push(pick(SHAME_LOW_LINES)(neverPlayed));
  }

  // Playtime
  if (totalHours > 2000) lines.push(pick(HOURS_LINES)(fmtH));
  else if (totalHours < 50) lines.push(pick(HOURS_LOW_LINES)(String(Math.round(totalHours))));
  else lines.push(`${fmtH}h total. Casual, but with commitment issues.`);

  // Top game
  if (topGame) lines.push(getGameRoast(topGame.name, topGame.hours));

  // Value
  if (libraryValue > 2000) lines.push(pick(VALUE_LINES)(fmtV));
  else if (libraryValue > 0) lines.push(pick(VALUE_LOW_LINES)(fmtV));

  // Recent activity
  if (recentGames === 0) lines.push(pick(RECENT_LINES)());

  // ── Rating ──
  const roastScore = neverPlayedPct * 0.3 + Math.min(totalHours / 100, 30) + Math.min(totalGames / 20, 20) + (costPerHour > 5 ? 20 : costPerHour > 2 ? 10 : 0);

  let rating: string, grade: string, gradeColor: string;
  if (roastScore > 70) { rating = "Steam Whale"; grade = "S"; gradeColor = "text-red-400"; }
  else if (roastScore > 55) { rating = "Certified Hoarder"; grade = "A"; gradeColor = "text-orange-400"; }
  else if (roastScore > 40) { rating = "Backlog Enjoyer"; grade = "B"; gradeColor = "text-yellow-400"; }
  else if (roastScore > 25) { rating = "Casual Gamer"; grade = "C"; gradeColor = "text-green-400"; }
  else if (roastScore > 10) { rating = "Tourist"; grade = "D"; gradeColor = "text-blue-400"; }
  else { rating = "NPC"; grade = "F"; gradeColor = "text-gray-400"; }

  return { headline, lines: lines.slice(0, 4), rating, grade, gradeColor };
}
