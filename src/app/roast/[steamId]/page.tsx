import type { Metadata } from "next";

const STEAM_KEY = process.env.STEAM_API_KEY || "";

async function fetchProfile(steamId: string) {
  const base = "https://api.steampowered.com";
  const [sumRes, gamesRes] = await Promise.all([
    fetch(`${base}/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_KEY}&steamids=${steamId}`, { cache: "no-store" }),
    fetch(`${base}/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`, { cache: "no-store" }),
  ]);
  const sumData = await sumRes.json();
  const player = sumData?.response?.players?.[0];
  const gamesData = await gamesRes.json();
  const games: Array<{ name: string; playtime_forever: number }> = gamesData?.response?.games || [];
  const totalGames = gamesData?.response?.game_count || games.length;
  const totalHours = Math.round(games.reduce((s: number, g: { playtime_forever: number }) => s + (g.playtime_forever || 0), 0) / 60);
  const neverPlayed = games.filter((g: { playtime_forever: number }) => (g.playtime_forever || 0) === 0).length;
  const sorted = [...games].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));
  const topGame = sorted[0] ? { name: sorted[0].name, hours: Math.round((sorted[0].playtime_forever || 0) / 60) } : null;
  return {
    personaName: player?.personaname || "Steam Player",
    avatarUrl: player?.avatarfull || "",
    totalGames, totalHours, neverPlayed, topGame,
  };
}

function getGrade(totalGames: number, totalHours: number, neverPlayed: number) {
  const playedRatio = totalGames > 0 ? 1 - neverPlayed / totalGames : 0;
  const avgHours = totalGames > 0 ? totalHours / totalGames : 0;
  const score = playedRatio * 40 + Math.min(avgHours, 50) * 1.2;
  if (score >= 70) return { grade: "S", color: "#f59e0b", label: "Steam Whale" };
  if (score >= 55) return { grade: "A", color: "#f97316", label: "Certified Hoarder" };
  if (score >= 40) return { grade: "B", color: "#3b82f6", label: "Backlog Enjoyer" };
  if (score >= 25) return { grade: "C", color: "#8b5cf6", label: "Casual Collector" };
  if (score >= 15) return { grade: "D", color: "#ef4444", label: "Wishlist Warrior" };
  return { grade: "F", color: "#6b7280", label: "NPC" };
}

export async function generateMetadata({ params }: { params: Promise<{ steamId: string }> }): Promise<Metadata> {
  const { steamId } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://steampicker.plazor.xyz";
  const ogImage = `${siteUrl}/api/og?id=${steamId}`;
  let title = "Steam Profile Roast — SteamPicker";
  try {
    const data = await fetchProfile(steamId);
    const { grade, label } = getGrade(data.totalGames, data.totalHours, data.neverPlayed);
    title = `${data.personaName}'s Steam Roast: Grade ${grade} (${label})`;
  } catch {}
  return {
    title,
    description: "See this Steam profile get roasted. Get yours at SteamPicker.",
    openGraph: {
      title,
      description: "See this Steam profile get roasted. Get yours at SteamPicker.",
      url: `${siteUrl}/roast/${steamId}`,
      siteName: "SteamPicker",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [ogImage] },
  };
}

export default async function RoastSharePage({ params }: { params: Promise<{ steamId: string }> }) {
  const { steamId } = await params;
  let data = { personaName: "Steam Player", avatarUrl: "", totalGames: 0, totalHours: 0, neverPlayed: 0, topGame: null as { name: string; hours: number } | null };
  try { data = await fetchProfile(steamId); } catch {}
  const { grade, color, label } = getGrade(data.totalGames, data.totalHours, data.neverPlayed);
  const unplayedPct = data.totalGames > 0 ? Math.round((data.neverPlayed / data.totalGames) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6">
      {/* Server-rendered roast card */}
      <div className="w-full max-w-[640px] rounded-2xl border border-white/[0.08] p-8 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)" }}>
        {/* Glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full" style={{ background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` }} />

        {/* Header */}
        <div className="flex items-center gap-5 relative z-10">
          {data.avatarUrl && (
            <img src={data.avatarUrl} width={72} height={72} className="rounded-2xl" style={{ border: `3px solid ${color}44` }} alt="" />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">{data.personaName}</h1>
            <p className="text-sm text-gray-500 mt-1 tracking-wider uppercase">Steam Profile Roast</p>
          </div>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-extrabold" style={{ border: `3px solid ${color}`, color }}>
            {grade}
          </div>
        </div>

        {/* Verdict */}
        <div className="mt-5 px-5 py-3 rounded-xl relative z-10" style={{ background: `${color}15`, borderLeft: `4px solid ${color}` }}>
          <span className="text-lg font-semibold" style={{ color }}>{label}</span>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-4 gap-3 relative z-10">
          {[
            { l: "GAMES", v: data.totalGames.toLocaleString() },
            { l: "HOURS", v: data.totalHours.toLocaleString() },
            { l: "UNPLAYED", v: `${data.neverPlayed} (${unplayedPct}%)` },
            { l: "TOP GAME", v: data.topGame ? (data.topGame.name.length > 16 ? data.topGame.name.substring(0, 16) + "..." : data.topGame.name) : "—" },
          ].map(s => (
            <div key={s.l} className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3">
              <div className="text-[10px] text-gray-500 font-semibold tracking-widest">{s.l}</div>
              <div className="text-lg font-bold text-white mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Top game callout */}
        {data.topGame && data.topGame.hours > 0 && (
          <p className="mt-4 text-sm text-gray-400 relative z-10">{data.topGame.hours.toLocaleString()}h in {data.topGame.name}. No comment.</p>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between relative z-10">
          <span className="text-lg font-extrabold text-white tracking-tight">SteamPicker</span>
          <span className="text-xs text-gray-600">steampicker.plazor.xyz</span>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <a href={`/profile/${steamId}`} className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold hover:from-blue-400 hover:to-indigo-400 transition-all">
          View Full Profile
        </a>
        <a href="/" className="text-gray-500 text-sm hover:text-blue-400 transition-colors">
          Get your own roast at <span className="text-blue-400">SteamPicker</span>
        </a>
      </div>
    </main>
  );
}
