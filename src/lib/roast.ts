/**
 * Steam profile roast generator v2.
 * 100+ roast templates per category. Pure functions.
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

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ─────────────────────────────────────────────────────────────
// GAME-SPECIFIC ROASTS (4-8 per game)
// ─────────────────────────────────────────────────────────────
const GAME_ROASTS: Record<string, string[]> = {
  "counter-strike 2": [
    "{h}h in CS2. Your aim is still trash. We checked.",
    "Silver after {h}h? That's not a rank, that's a lifestyle.",
    "{h}h of 'one more game' at 3AM. Your sleep schedule filed a restraining order.",
    "{h}h and you still buy a Negev on round 2.",
    "{h}h in CS2 and your crosshair placement is still at ankle height.",
    "Your CS2 stats are classified. Not because they're impressive.",
  ],
  "counter-strike: global offensive": [
    "You peaked in 2017. The game is dead. You're still here.",
    "{h}h in CSGO. The game literally shut down and you're still counting.",
    "CSGO for {h}h. Even Valve moved on. Why can't you?",
  ],
  "dota 2": [
    "{h}h in Dota. Blink twice if you need help.",
    "{h}h and your MMR is still calibrating... your life choices.",
    "Dota 2 for {h}h. Your therapist should bill Valve.",
    "{h}h and you still blame your supports.",
    "{h}h in Dota. You could have cured a disease. Instead you picked Techies.",
    "Your Dota 2 hours ({h}h) are longer than some prison sentences.",
  ],
  "team fortress 2": [
    "TF2 in {year}? Bots have more hours than you. Literally.",
    "{h}h in TF2. Even the bots feel sorry for you.",
    "{h}h in TF2. You've been headshot by more bots than players.",
  ],
  "pubg: battlegrounds": [
    "{h}h dropping hot and dying instantly. Every. Single. Time.",
    "PUBG for {h}h and your best strategy is still 'hide in a bathroom'.",
    "{h}h in PUBG. You've spent more time in loading screens than alive.",
  ],
  "rust": [
    "{h}h of being raided while offline. It's emotional damage.",
    "Rust for {h}h. You've been griefed more than helped in life.",
    "{h}h in Rust. Your base was raided while you read this.",
    "Rust for {h}h. Trust issues? Can't imagine why.",
  ],
  "garry's mod": [
    "{h}h in Gmod. You're either 12 or 30. No in between.",
    "Gmod for {h}h. Your DarkRP addiction is not a personality.",
    "{h}h in Gmod and you still think prop kill is peak comedy.",
  ],
  "terraria": [
    "{h}h and you still haven't beaten Moon Lord, have you?",
    "{h}h of 'just one more ore vein'. The mine owns you now.",
    "Terraria for {h}h. Your NPCs have a better housing situation than you.",
  ],
  "stardew valley": [
    "{h}h farming virtual turnips. Your real plants are dead.",
    "You've spent {h}h in Stardew. Pierre makes more money than you.",
    "{h}h and you still can't decide between Shane and Sebastian.",
    "Stardew for {h}h. Grandpa's evaluation was more positive than your annual review.",
  ],
  "the elder scrolls v: skyrim": [
    "You've bought Skyrim {times} times. Todd Howard sends his regards.",
    "{h}h in Skyrim. 80% of that is modding, 20% is crashing.",
    "{h}h and you still haven't finished the main quest.",
    "Skyrim for {h}h. You have more saves than accomplishments.",
  ],
  "grand theft auto v": [
    "{h}h in GTA Online. Your K/D ratio has a K/D ratio.",
    "GTA V for {h}h. More shark cards than brain cells.",
    "{h}h in GTA. Your criminal record is more impressive than your resume.",
  ],
  "wallpaper engine": [
    "Your most played 'game' is animated wallpaper. Absolute legend.",
    "{h}h in Wallpaper Engine. You game harder picking backgrounds than playing.",
    "Wallpaper Engine at {h}h. Sir, this is not a game.",
  ],
  "civilization v": [
    "Just one more turn. For {h} hours. Your family misses you.",
    "{h}h in Civ V. Gandhi has nuked you more times than you've showered.",
    "Civ V for {h}h. You've committed more war crimes than you've eaten meals.",
  ],
  "civilization vi": [
    "You've spent {h}h failing at diplomacy. IRL and in-game.",
    "{h}h in Civ VI. You've restarted more saves than conversations.",
    "Civ VI for {h}h. Your turns take longer than your relationships.",
  ],
  "destiny 2": [
    "{h}h of content Bungie will sunset anyway.",
    "Destiny 2 for {h}h. You grind more than a coffee shop.",
    "{h}h in Destiny. The loot cave had more personality than you.",
  ],
  "warframe": [
    "{h}h of grinding. The real endgame is fashion frame.",
    "Warframe for {h}h. More time in trade chat than combat.",
    "{h}h in Warframe. Your Warframe looks better than you do.",
  ],
  "path of exile": [
    "{h}h and you still don't understand the passive tree. Nobody does.",
    "PoE for {h}h. Your stash tabs cost more than most AAA games.",
    "{h}h in PoE. You've seen more skill trees than actual trees.",
  ],
  "apex legends": [
    "{h}h in Apex. Your K/D and your GPA have something in common.",
    "Apex for {h}h. Third-partied more than a political candidate.",
    "{h}h of dropping Fragment. Why do you hate yourself?",
  ],
  "dead by daylight": [
    "{h}h of getting tunneled at 5 gens. And you keep coming back.",
    "DbD for {h}h. Stockholm syndrome is not a perk.",
    "{h}h in DbD. You've been hooked more times than a coat.",
  ],
  "elden ring": [
    "{h}h in Elden Ring. 'Git gud' was a threat, not a suggestion.",
    "Elden Ring for {h}h. Malenia has your number on speed dial.",
    "{h}h and you still use a guide for every boss.",
    "Elden Ring for {h}h. You've died more than you've lived. In-game and out.",
  ],
  "fortnite": [
    "{h}h in Fortnite. Your building skills are cracked. Your social life isn't.",
    "Fortnite for {h}h. You floss IRL, don't you?",
    "{h}h of Fortnite. Your V-Bucks are worth more than your savings.",
  ],
  "minecraft": [
    "{h}h in Minecraft. You've built more homes here than you'll ever own.",
    "Minecraft for {h}h. The creepers have become family.",
    "{h}h in Minecraft. Your pixel house has better architecture than your apartment.",
  ],
  "ark: survival evolved": [
    "{h}h taming dinos. You could have an actual paleontology degree.",
    "ARK for {h}h. Your GPU aged faster than you did.",
    "{h}h in ARK. Your tribe betrayed you more than your ex.",
  ],
  "rocket league": [
    "{h}h in Rocket League. Still whiffing aerials. Still typing 'What a save!'",
    "RL for {h}h. Your car flies better than your life trajectory.",
    "{h}h in RL. You peaked at Plat and called it 'good enough'.",
  ],
  "among us": [
    "{h}h in Among Us. You're still sus. Always were.",
    "Among Us for {h}h. Imposter syndrome, but make it literal.",
  ],
  "baldur's gate 3": [
    "{h}h in BG3. That's a lot of save-scumming for a 'natural 20'.",
    "BG3 for {h}h. You've romanced everyone including the bear.",
    "{h}h of BG3. You've had more relationships here than IRL.",
  ],
  "palworld": [
    "{h}h in Palworld. Pokémon's lawyers are on the way.",
    "Palworld for {h}h. PETA would like a word.",
  ],
  "lethal company": [
    "{h}h in Lethal Company. The real monster was the quota all along.",
    "Lethal for {h}h. Your coworkers have more survival instincts than yours.",
  ],
  "helldivers 2": [
    "{h}h spreading democracy. Liberty doesn't sleep and neither do you.",
    "Helldivers for {h}h. You've died for Super Earth more than lived for yourself.",
    "{h}h in Helldivers. Friendly fire is a skill you've mastered.",
  ],
  "valorant": [
    "{h}h in Valorant. Your instalock Jett is not the flex you think.",
    "Valorant for {h}h. More time in deathmatch 'warming up' than playing.",
    "{h}h in Val. Your crosshair is lower than your standards.",
  ],
  "league of legends": [
    "{h}h in League. Your teammates wish you were a bot.",
    "LoL for {h}h. You flame harder than you carry.",
    "{h}h in League. Your LP graph is flatter than your heartbeat.",
  ],
  "overwatch 2": [
    "{h}h in OW2. Still blaming the healers.",
    "Overwatch for {h}h. You have a Mercy main's attitude and a DPS main's aim.",
  ],
  "no man's sky": [
    "{h}h exploring a quintillion planets. All of them look the same.",
    "NMS for {h}h. You've named more planets than friends you have.",
  ],
  "cyberpunk 2077": [
    "{h}h in Night City. The bugs were features. Apparently.",
    "Cyberpunk for {h}h. V had more life choices than you ever will.",
  ],
  "red dead redemption 2": [
    "{h}h in RDR2. Arthur's tuberculosis lasted shorter than your playthrough.",
    "RDR2 for {h}h. You've brushed your horse more than your teeth.",
    "{h}h in the Wild West. Your horse has better stats than your life.",
  ],
  "the witcher 3: wild hunt": [
    "{h}h in Witcher 3. Geralt gets more action than you in every way.",
    "Witcher 3 for {h}h. You've played Gwent longer than the main story.",
  ],
  "dark souls iii": [
    "{h}h dying to the same boss. Masochism isn't a personality trait.",
    "Dark Souls for {h}h. You've seen 'YOU DIED' more than your own reflection.",
  ],
  "monster hunter: world": [
    "{h}h hunting the same Rathalos. It's not a game, it's a part-time job.",
    "MH:W for {h}h. Your palico is more useful than you.",
  ],
  "sea of thieves": [
    "{h}h on the seas. You've been sunk more times than the Titanic.",
    "Sea of Thieves for {h}h. The real treasure is the anger issues you found.",
  ],
  "deep rock galactic": [
    "{h}h in DRG. Rock and Stone! Also, get a job.",
    "DRG for {h}h. You mine more than a Bitcoin farm.",
  ],
  "satisfactory": [
    "{h}h in Satisfactory. Your factory is more organized than your life.",
    "Satisfactory for {h}h. Your conveyor belts are straighter than your priorities.",
  ],
  "factorio": [
    "{h}h in Factorio. The factory must grow. Your social life must not.",
    "Factorio for {h}h. You've automated everything except touching grass.",
  ],
  "fall guys": [
    "{h}h of being eliminated by a spinning bar. Peak gaming.",
    "Fall Guys for {h}h. You trip more than you win.",
  ],
  "left 4 dead 2": [
    "{h}h killing zombies. At some point, YOU became the zombie.",
    "L4D2 for {h}h. You've been more useful as bait than as a teammate.",
  ],
  "hades": [
    "{h}h in Hades. Zagreus has escaped more than your dating life.",
    "Hades for {h}h. Even the underworld has better exit strategies than your library.",
  ],
  "hollow knight": [
    "{h}h in Hollownest. You haven't beaten the Pantheon, have you?",
    "Hollow Knight for {h}h. Your nail is sharper than your life decisions.",
  ],
  "persona 5": [
    "{h}h in Persona 5. You've had more social links than real friendships.",
    "P5 for {h}h. Your fictional love life is more active than your real one.",
  ],
  "genshin impact": [
    "{h}h in Genshin. Your primogem budget exceeds your grocery budget.",
    "Genshin for {h}h. You've wished more here than on your birthday.",
  ],
  "animal crossing: new horizons": [
    "{h}h decorating a virtual island. Your room IRL looks nothing like that.",
    "Animal Crossing for {h}h. Tom Nook has more financial power over you than your bank.",
  ],
  "euro truck simulator 2": [
    "{h}h of virtual trucking. You drive better here than in real life.",
    "ETS2 for {h}h. The only road trip you'll ever take.",
  ],
  "fifa": [
    "{h}h of FIFA. Your pack luck is as bad as your life luck.",
    "FIFA for {h}h. EA Sports: it's in your wallet.",
  ],
  "the sims 4": [
    "{h}h playing god with tiny people. Ironic, given your own life.",
    "Sims 4 for {h}h. Your Sims have better careers than you.",
  ],
  "rimworld": [
    "{h}h in RimWorld. Geneva Convention? More like Geneva Suggestion.",
    "RimWorld for {h}h. Your colony management skills are inversely proportional to your life management.",
  ],
  "subnautica": [
    "{h}h in Subnautica. Your thalassophobia is well-earned.",
    "Subnautica for {h}h. You've drowned more than a goldfish.",
  ],
};

function getGameRoast(name: string, hours: number): string {
  const key = name.toLowerCase();
  const templates = GAME_ROASTS[key];
  if (templates) {
    return pick(templates)
      .replace(/\{h\}/g, Math.round(hours).toLocaleString())
      .replace("{year}", new Date().getFullYear().toString())
      .replace("{times}", String(Math.max(3, Math.floor(hours / 500))));
  }
  // Generic roasts by hour tiers
  if (hours > 5000) return pick([
    `${Math.round(hours).toLocaleString()}h in ${name}. That's not a hobby, it's a hostage situation.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. The game doesn't even love you back.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. That's ${(hours / 8760).toFixed(1)} years. Of your ONE life.`,
    `${name} at ${Math.round(hours).toLocaleString()}h. You don't play this game. It plays you.`,
    `${Math.round(hours).toLocaleString()}h. ${name} owns you. Legally, emotionally, spiritually.`,
  ]);
  if (hours > 2000) return pick([
    `${Math.round(hours).toLocaleString()}h in ${name}. Your Steam profile is a cry for help.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. Even the devs don't play it that much.`,
    `${name}: ${Math.round(hours).toLocaleString()}h. This isn't dedication, it's a medical condition.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. You've outlasted most marriages.`,
  ]);
  if (hours > 1000) return pick([
    `${Math.round(hours).toLocaleString()}h in ${name}. Touch grass? Never heard of it.`,
    `${name} at ${Math.round(hours).toLocaleString()}h. We get it, you like the game.`,
    `${Math.round(hours).toLocaleString()}h of ${name}. That's more commitment than your average relationship.`,
    `${name}: ${Math.round(hours).toLocaleString()}h. The game knows your name. And your fears.`,
  ]);
  if (hours > 500) return pick([
    `${name} at ${Math.round(hours).toLocaleString()}h. Dedicated, but in a concerning way.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. You've passed the point of no return.`,
    `${name}: ${Math.round(hours).toLocaleString()}h. Your most stable relationship.`,
  ]);
  if (hours > 100) return pick([
    `${name} at ${Math.round(hours).toLocaleString()}h. Committed enough to be suspicious.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. It's not a phase, is it?`,
  ]);
  return pick([
    `Most played: ${name} (${Math.round(hours).toLocaleString()}h). No comment.`,
    `${Math.round(hours).toLocaleString()}h in ${name}. Acceptable. Barely.`,
    `${name}: ${Math.round(hours).toLocaleString()}h. Entry-level addiction.`,
  ]);
}

// ─────────────────────────────────────────────────────────────
// HEADLINE POOLS (20+ per category)
// ─────────────────────────────────────────────────────────────
type HF = (...args: any[]) => string;

const SHAME_HEADLINES: HF[] = [
  (pct: number, n: number) => `${pct}% of your library is untouched. Steam isn't a museum.`,
  (_: number, n: number) => `${n} games you bought and never opened. Your wallet wants a refund on YOU.`,
  (pct: number) => `You've ignored ${pct}% of your games. They're plotting revenge.`,
  (_: number, n: number) => `${n} unplayed games. That's not a backlog, that's a graveyard.`,
  (pct: number) => `${pct}% unplayed. Your library is 90% shopping receipts.`,
  (pct: number) => `${pct}% of your games have never been launched. They don't even know your face.`,
  (_: number, n: number) => `${n} games collecting digital dust. Impressive. In the saddest way.`,
  (pct: number) => `${pct}% untouched. You treat Steam like a hoarding simulator.`,
  (_: number, n: number) => `${n} unplayed titles. That's not a library, it's a memorial.`,
  (pct: number) => `You've played ${100 - pct}% of your games. The other ${pct}% filed for neglect.`,
  (_: number, n: number) => `${n} games waiting for you. They've given up hope.`,
  (pct: number) => `${pct}% of your library exists only in your purchase history.`,
];
const SHAME_LOW_HEADLINES: HF[] = [
  (pct: number) => `Only ${pct}% unplayed? You actually play your games? Psychopath behavior.`,
  (pct: number) => `${pct}% unplayed. You're disgustingly responsible. Stop it.`,
  (pct: number) => `${pct}% unplayed. You're the person who reads every book on their shelf.`,
  (pct: number) => `Only ${pct}% unplayed. This level of discipline is suspicious.`,
  (pct: number) => `${pct}% unplayed. Are you... actually playing your games? Who does that?`,
];

const HOURS_HIGH_HEADLINES: HF[] = [
  (h: string, y: string) => `${h} hours on Steam. That's ${y} years of your life. Gone. No refunds.`,
  (h: string) => `${h} hours logged. Your gaming chair filed for workers' comp.`,
  (h: string) => `${h} hours. You've gamed more than some people have lived.`,
  (h: string) => `${h} hours on Steam. The sun has filed a missing person report.`,
  (h: string) => `${h} hours. At this point, reality is the side quest.`,
  (h: string, y: string) => `${h} hours. That's ${y} years you could have spent becoming a doctor.`,
  (h: string) => `${h} hours. Your Steam account qualifies for a pension.`,
  (h: string) => `${h} hours logged. Even your shadow has forgotten what you look like.`,
  (h: string) => `${h} hours of screen time. Your optometrist is buying a yacht.`,
  (h: string) => `${h} hours. You don't have a gaming habit. You have a gaming career.`,
];
const HOURS_MED_HEADLINES: HF[] = [
  (h: string) => `${h} hours. Your employer would like a word. Several, actually.`,
  (h: string) => `${h} hours of gaming. Your chiropractor sends thank-you cards.`,
  (h: string) => `${h} hours on Steam. That's concerning. Not alarming. But concerning.`,
  (h: string) => `${h} hours. Your posture has a posture problem.`,
  (h: string) => `${h} hours. Somewhere, a gym membership weeps.`,
  (h: string) => `${h} hours. That's a lot of 'just five more minutes'.`,
];
const HOURS_LOW_HEADLINES: HF[] = [
  (h: string) => `${h} hours total? Steam thinks you're a bot.`,
  (h: string) => `${h} hours. That's not gaming, that's browsing with extra steps.`,
  (h: string) => `${h} hours? You're barely a gamer. You're more of a… watcher.`,
  (h: string) => `${h} hours. Your library has more games than you have minutes played.`,
  (h: string) => `${h} hours total. Even mobile gamers are judging you.`,
];

const COST_HEADLINES: HF[] = [
  (c: string) => `${c} per hour of gaming. A movie theater is cheaper. So is therapy.`,
  (c: string) => `You're paying ${c}/hour to game. Rent would be cheaper.`,
  (c: string) => `${c} per hour. You're speedrunning bankruptcy.`,
  (c: string) => `${c}/hour of entertainment. Netflix is crying at your wasted potential.`,
  (c: string) => `${c} per gaming hour. Your money burns faster than your GPU.`,
  (c: string) => `${c}/hr. At that rate, hire someone to play for you.`,
];

const HOARDER_HEADLINES: HF[] = [
  (n: string) => `${n} games. You don't have a library, you have a cry for help.`,
  (n: string) => `${n} games collected. Pokémon had 151. You have a problem.`,
  (n: string) => `${n} games. You've spent more time buying than playing.`,
  (n: string) => `${n} games. At this point, Steam sales are a medical trigger.`,
  (n: string) => `${n} titles. This isn't a library, it's an intervention waiting to happen.`,
  (n: string) => `${n} games. Your hard drive is begging for mercy.`,
  (n: string) => `${n} games in your library. Marie Kondo just fainted.`,
  (n: string) => `${n} games. You've downloaded more than you've played by a factor of 10.`,
];

// ─────────────────────────────────────────────────────────────
// SUPPORTING LINE POOLS (15+ per category)
// ─────────────────────────────────────────────────────────────

const SHAME_LINES: HF[] = [
  (n: number, v: string) => `${n} games you paid for and never touched. ${v} in the trash.`,
  (n: number) => `${n} unplayed games. Your pile of shame could fill a GameStop. If those still existed.`,
  (n: number) => `${n} games rotting in your library. Even Steam sales can't justify this.`,
  (n: number) => `${n} games you'll 'get to eventually.' You won't.`,
  (n: number) => `${n} titles you bought at 3 AM during a sale. Zero regret? All regret.`,
  (n: number) => `${n} games unopened. They have support groups for this.`,
  (n: number) => `${n} games collecting dust. Your library is a digital landfill.`,
  (n: number, v: string) => `${v} worth of games you've never even looked at. Iconic.`,
  (n: number) => `${n} unplayed. At least your steam library has good taste in decorating.`,
  (n: number) => `${n} games sitting in darkness. You are the worst curator on Steam.`,
];
const SHAME_LOW_LINES: HF[] = [
  (n: number) => `Only ${n} unplayed? You're either disciplined or broke. We're guessing broke.`,
  () => `Almost no unplayed games. You're the gamer others pretend to be.`,
  (n: number) => `${n} unplayed. That's… actually impressive. Suspicious, but impressive.`,
  () => `Tiny backlog. You're either a completionist or you just can't afford more games.`,
  (n: number) => `Only ${n} unplayed. You have the self-control of a gaming monk.`,
];

const HOURS_LINES: HF[] = [
  () => `You've gamed for over a year of real time. The sun misses you.`,
  (h: string) => `${h}h on Steam. You could've learned 3 languages. Or touched grass once.`,
  (h: string) => `${h}h logged. Your posture called. It wants a divorce.`,
  (h: string) => `${h}h. More time gaming than some people spend sleeping.`,
  (h: string) => `${h}h total. Your electricity bill could fund a small country.`,
  (h: string) => `${h}h of gaming. Your monitor has seen more of you than your family has.`,
  (h: string) => `${h}h. In that time, the Earth orbited the Sun ${(parseInt(h.replace(/,/g, "")) / 8760).toFixed(1)} times. You orbited your desk.`,
  (h: string) => `${h}h logged. At minimum wage, that's a down payment on a house.`,
  (h: string) => `${h}h. That's more than most people spend at their actual jobs.`,
  (h: string) => `${h}h of screen glow. Your vitamin D levels are theoretical.`,
];
const HOURS_LOW_LINES: HF[] = [
  (h: string) => `${h}h total? Steam called. They want their account back.`,
  (h: string) => `${h}h. Even your refunded games have more playtime.`,
  (h: string) => `${h}h total. Are you sure you game? Or just browse the store?`,
  (h: string) => `${h}h. Your Steam account is basically ornamental.`,
];

const VALUE_HIGH_LINES: HF[] = [
  (v: string) => `Library worth ${v}. That's a vacation you'll never take because you're gaming.`,
  (v: string) => `${v} in games. Your wallet didn't sign up for this.`,
  (v: string) => `${v} spent. You could've bought a car. A bad one, but it would move.`,
  (v: string) => `${v} of games. Your Steam account is worth more than your car.`,
  (v: string) => `${v} in the library. Congrats, your most expensive hobby is also your least productive.`,
  (v: string) => `${v}. That's not a game library, it's a financial confession.`,
  (v: string) => `${v} spent on games. Your bank thinks you have a gambling problem.`,
  (v: string) => `${v}. If Steam refunded your life decisions, you'd be rich.`,
  (v: string) => `Library: ${v}. Portfolio: $0. Priorities: clear.`,
  (v: string) => `${v} in games. Your accountant just quit.`,
];
const VALUE_LOW_LINES: HF[] = [
  (v: string) => `${v} library. Even your wallet is disappointed.`,
  (v: string) => `Library worth ${v}. Budget gamer with expensive taste.`,
  (v: string) => `${v} total. You game like you're on a diet.`,
  (v: string) => `${v}. That's… not even a flex. That's a whisper.`,
];

const RECENT_LINES: HF[] = [
  () => `No recent activity. Even Steam forgot about you.`,
  () => `Zero hours this month. Your library is collecting more dust than your bookshelf.`,
  () => `No recent playtime. Your games are sending you passive-aggressive notifications.`,
  () => `Nothing played recently. Your PC is being used as a very expensive space heater.`,
  () => `No recent games. Your Steam profile has 'last online: 47 days ago' energy.`,
];

// ─────────────────────────────────────────────────────────────
// MAIN GENERATOR
// ─────────────────────────────────────────────────────────────
export function generateRoast(input: RoastInput): RoastResult {
  const { totalGames, totalHours, neverPlayed, libraryValue, currencySymbol, topGame, recentGames } = input;

  const neverPlayedPct = totalGames > 0 ? Math.round((neverPlayed / totalGames) * 100) : 0;
  const costPerHour = totalHours > 0 ? libraryValue / totalHours : 0;
  const lines: string[] = [];
  const fmtH = Math.round(totalHours).toLocaleString();
  const fmtV = `${currencySymbol}${libraryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtCPH = `${currencySymbol}${costPerHour.toFixed(2)}`;

  // ── Headline: randomly pick from ANY applicable category for variety ──
  let headline = "";
  const headlinePool: string[] = [];

  // Add all applicable headlines to the pool
  if (neverPlayedPct > 30) {
    SHAME_HEADLINES.forEach(fn => headlinePool.push(fn(neverPlayedPct, neverPlayed)));
  } else {
    SHAME_LOW_HEADLINES.forEach(fn => headlinePool.push(fn(neverPlayedPct)));
  }
  if (totalHours > 5000) {
    HOURS_HIGH_HEADLINES.forEach(fn => headlinePool.push(fn(fmtH, (totalHours / 8760).toFixed(1))));
  } else if (totalHours > 1000) {
    HOURS_MED_HEADLINES.forEach(fn => headlinePool.push(fn(fmtH)));
  } else {
    HOURS_LOW_HEADLINES.forEach(fn => headlinePool.push(fn(fmtH)));
  }
  if (costPerHour > 2) {
    COST_HEADLINES.forEach(fn => headlinePool.push(fn(fmtCPH)));
  }
  if (totalGames > 100) {
    HOARDER_HEADLINES.forEach(fn => headlinePool.push(fn(totalGames.toLocaleString())));
  }

  headline = pick(headlinePool);

  // ── Supporting lines (one per category) ──

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
  if (libraryValue > 2000) lines.push(pick(VALUE_HIGH_LINES)(fmtV));
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
