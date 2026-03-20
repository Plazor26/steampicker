import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const steamId = req.nextUrl.searchParams.get("id");
  if (!steamId) {
    return new Response("Missing id", { status: 400 });
  }

  const STEAM_KEY = process.env.STEAM_API_KEY || "";

  let personaName = "Steam Player";
  let avatarUrl = "";
  let totalGames = 0;
  let totalHours = 0;
  let neverPlayed = 0;
  let topGameName = "";
  let topGameHours = 0;

  try {
    const [sumRes, gamesRes] = await Promise.all([
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_KEY}&steamids=${steamId}`),
      fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`),
    ]);

    const sumData = await sumRes.json();
    const player = sumData?.response?.players?.[0];
    personaName = player?.personaname || "Steam Player";
    avatarUrl = player?.avatarfull || "";

    const gamesData = await gamesRes.json();
    const games: Array<{ name: string; playtime_forever: number }> = gamesData?.response?.games || [];
    totalGames = gamesData?.response?.game_count || games.length;
    totalHours = Math.round(games.reduce((s: number, g: { playtime_forever: number }) => s + (g.playtime_forever || 0), 0) / 60);
    neverPlayed = games.filter((g: { playtime_forever: number }) => (g.playtime_forever || 0) === 0).length;
    const sorted = [...games].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));
    if (sorted[0]) {
      topGameName = sorted[0].name || "";
      topGameHours = Math.round((sorted[0].playtime_forever || 0) / 60);
    }
  } catch (e) {
    console.error("[OG] fetch error:", e);
  }

  // Grade
  const playedRatio = totalGames > 0 ? 1 - neverPlayed / totalGames : 0;
  const avgHours = totalGames > 0 ? totalHours / totalGames : 0;
  const score = playedRatio * 40 + Math.min(avgHours, 50) * 1.2;
  const { grade, color, label } = score >= 70
    ? { grade: "S", color: "#f59e0b", label: "Steam Whale" }
    : score >= 55
      ? { grade: "A", color: "#f97316", label: "Certified Hoarder" }
      : score >= 40
        ? { grade: "B", color: "#3b82f6", label: "Backlog Enjoyer" }
        : score >= 25
          ? { grade: "C", color: "#8b5cf6", label: "Casual Collector" }
          : score >= 15
            ? { grade: "D", color: "#ef4444", label: "Wishlist Warrior" }
            : { grade: "F", color: "#6b7280", label: "NPC" };

  const unplayedPct = totalGames > 0 ? Math.round((neverPlayed / totalGames) * 100) : 0;

  try {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(145deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)", color: "white", fontFamily: "sans-serif", padding: "48px 56px", position: "relative" }}>
          <div style={{ position: "absolute", top: "-100px", right: "-100px", width: "400px", height: "400px", background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`, display: "flex" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            {avatarUrl ? <img src={avatarUrl} width={88} height={88} style={{ borderRadius: "16px", border: `3px solid ${color}44` }} /> : <div style={{ width: 88, height: 88, borderRadius: "16px", background: "#1e293b", display: "flex" }} />}
            <div style={{ display: "flex", flexDirection: "column", flex: "1" }}>
              <div style={{ fontSize: 42, fontWeight: 700 }}>{personaName}</div>
              <div style={{ fontSize: 18, color: "#64748b", marginTop: 4 }}>STEAM PROFILE ROAST</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: "16px", border: `3px solid ${color}`, fontSize: 44, fontWeight: 800, color }}>{grade}</div>
          </div>

          <div style={{ display: "flex", marginTop: 28, padding: "16px 24px", borderRadius: "12px", background: `${color}15`, borderLeft: `4px solid ${color}` }}>
            <span style={{ fontSize: 22, color, fontWeight: 600 }}>{label}</span>
          </div>

          <div style={{ display: "flex", marginTop: 36, gap: "16px" }}>
            {[
              { l: "GAMES", v: String(totalGames) },
              { l: "HOURS", v: String(totalHours) },
              { l: "UNPLAYED", v: `${neverPlayed} (${unplayedPct}%)` },
              { l: "TOP GAME", v: topGameName ? (topGameName.length > 18 ? topGameName.substring(0, 18) + "..." : topGameName) : "—" },
            ].map((s) => (
              <div key={s.l} style={{ display: "flex", flexDirection: "column", flex: "1", padding: "18px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: "1px" }}>{s.l}</span>
                <span style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{s.v}</span>
              </div>
            ))}
          </div>

          {topGameName && topGameHours > 0 && (
            <div style={{ display: "flex", marginTop: 24, fontSize: 18, color: "#94a3b8" }}>{topGameHours}h in {topGameName}. No comment.</div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 24 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>SteamPicker</span>
            <span style={{ fontSize: 16, color: "#475569" }}>steampicker.plazor.xyz</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (e) {
    console.error("[OG] ImageResponse error:", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
