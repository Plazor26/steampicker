import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SteamPicker — Steam Profile Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

export default async function Image({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || "http://localhost:3001";

  let personaName = "Steam Player";
  let avatarUrl = "";
  let totalGames = 0;
  let totalHours = 0;
  let neverPlayed = 0;
  let topGameName = "";
  let topGameHours = 0;

  try {
    const res = await fetch(`${baseUrl}/api/steam/profile/${steamId}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        personaName = data.profile?.personaName || "Steam Player";
        avatarUrl = data.profile?.avatar || "";
        const allGames: Array<{ hours?: number; name?: string }> = data.library?.allGames || [];
        totalGames = data.library?.totalGames || allGames.length;
        totalHours = Math.round(allGames.reduce((s: number, g: { hours?: number }) => s + (g.hours || 0), 0));
        neverPlayed = allGames.filter((g: { hours?: number }) => (g.hours || 0) === 0).length;
        const sorted = [...allGames].sort((a, b) => (b.hours || 0) - (a.hours || 0));
        if (sorted[0]) {
          topGameName = sorted[0].name || "";
          topGameHours = Math.round(sorted[0].hours || 0);
        }
      }
    }
  } catch {
    // fallback to defaults
  }

  const { grade, color, label } = getGrade(totalGames, totalHours, neverPlayed);
  const costPerHour = totalHours > 0 ? Math.round((totalGames * 15) / totalHours * 100) / 100 : 0;
  const unplayedPct = totalGames > 0 ? Math.round((neverPlayed / totalGames) * 100) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(145deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "48px 56px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle accent glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
            display: "flex",
          }}
        />

        {/* Header: Avatar + Name + Grade */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {avatarUrl && (
            <img
              src={avatarUrl}
              width={88}
              height={88}
              style={{ borderRadius: "16px", border: `3px solid ${color}44` }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: "1" }}>
            <div style={{ fontSize: 42, fontWeight: 700, color: "white" }}>
              {personaName}
            </div>
            <div style={{ fontSize: 18, color: "#64748b", marginTop: 4 }}>
              STEAM PROFILE ROAST
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 80,
              height: 80,
              borderRadius: "16px",
              border: `3px solid ${color}`,
              fontSize: 44,
              fontWeight: 800,
              color: color,
            }}
          >
            {grade}
          </div>
        </div>

        {/* Verdict */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            padding: "16px 24px",
            borderRadius: "12px",
            background: `${color}15`,
            borderLeft: `4px solid ${color}`,
          }}
        >
          <span style={{ fontSize: 22, color: color, fontWeight: 600 }}>
            {label}
          </span>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            marginTop: 36,
            gap: "16px",
          }}
        >
          {[
            { label: "GAMES", value: totalGames.toLocaleString() },
            { label: "HOURS", value: totalHours.toLocaleString() },
            { label: "UNPLAYED", value: `${neverPlayed} (${unplayedPct}%)` },
            { label: "TOP GAME", value: topGameName ? `${topGameName.substring(0, 18)}${topGameName.length > 18 ? "..." : ""}` : "—" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: "1",
                padding: "18px 16px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: "1px" }}>
                {s.label}
              </span>
              <span style={{ fontSize: 26, fontWeight: 700, marginTop: 6, color: "white" }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>

        {/* Top game callout */}
        {topGameName && topGameHours > 0 && (
          <div style={{ display: "flex", marginTop: 24, fontSize: 18, color: "#94a3b8" }}>
            {topGameHours.toLocaleString()}h in {topGameName}. No comment.
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>
              SteamPicker
            </span>
          </div>
          <span style={{ fontSize: 16, color: "#475569" }}>
            steampicker.plazor.xyz
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
