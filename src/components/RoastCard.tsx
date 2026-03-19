"use client";

import React, { forwardRef } from "react";
import type { RoastResult } from "@/lib/roast";

type RoastCardProps = {
  personaName: string;
  avatarUrl: string | null;
  totalGames: number;
  totalHours: number;
  neverPlayed: number;
  libraryValue: string;
  libraryValueNum: number;
  currencySymbol: string;
  topGames: { name: string; hours: number }[];
  roast: RoastResult;
  shameGame?: { name: string; hours: number; imageUrl: string } | null;
};

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  S: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)", text: "#ef4444" },
  A: { bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.5)", text: "#f97316" },
  B: { bg: "rgba(234,179,8,0.15)", border: "rgba(234,179,8,0.5)", text: "#eab308" },
  C: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.5)", text: "#22c55e" },
  D: { bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.5)", text: "#60a5fa" },
  F: { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)", text: "#94a3b8" },
};

const RoastCard = forwardRef<HTMLDivElement, RoastCardProps>(function RoastCard(
  { personaName, avatarUrl, totalGames, totalHours, neverPlayed, libraryValue, libraryValueNum, currencySymbol, topGames, roast, shameGame },
  ref
) {
  const playedPct = totalGames > 0 ? Math.round(((totalGames - neverPlayed) / totalGames) * 100) : 0;
  const cph = totalHours > 0 ? (libraryValueNum / totalHours) : 0;
  const gc = GRADE_COLORS[roast.grade] || GRADE_COLORS.F;

  // Top 5 games for the playtime bar chart
  const maxHours = topGames.length > 0 ? topGames[0].hours : 1;

  return (
    <div
      ref={ref}
      style={{
        width: 1200, height: 630,
        background: "linear-gradient(145deg, #050a14 0%, #0c1929 40%, #0a1628 100%)",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        position: "relative", overflow: "hidden",
        display: "flex",
      }}
    >
      {/* Background glow accents */}
      <div style={{ position: "absolute", top: -60, right: 200, width: 350, height: 350, borderRadius: "50%", background: `radial-gradient(circle, ${gc.bg} 0%, transparent 70%)` }} />
      <div style={{ position: "absolute", bottom: -40, left: 100, width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }} />

      {/* Left column: profile + roast */}
      <div style={{ flex: "1 1 55%", padding: "40px 36px 32px 44px", display: "flex", flexDirection: "column", position: "relative", zIndex: 10 }}>

        {/* Header: avatar + name + grade */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, overflow: "hidden", border: `2px solid ${gc.border}`, boxShadow: `0 0 24px ${gc.bg}`, flexShrink: 0 }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.06)" }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{personaName}</div>
            <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, marginTop: 3 }}>Steam Profile Roast</div>
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: gc.bg, border: `2px solid ${gc.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: gc.text }}>{roast.grade}</span>
          </div>
        </div>

        {/* Headline quote */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: "16px 22px", marginBottom: 16,
          borderLeft: `3px solid ${gc.border}`,
        }}>
          <div style={{ color: "#e2e8f0", fontSize: 19, fontWeight: 700, lineHeight: 1.35, fontStyle: "italic" as const }}>
            &ldquo;{roast.headline}&rdquo;
          </div>
        </div>

        {/* Roast lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
          {roast.lines.map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: gc.text, fontSize: 10, lineHeight: "18px", marginTop: 1 }}>&#9670;</span>
              <span style={{ color: "rgba(203,213,225,0.85)", fontSize: 13, lineHeight: "18px" }}>{line}</span>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Games", value: totalGames.toLocaleString() },
            { label: "Hours", value: Math.round(totalHours).toLocaleString() },
            { label: "Unplayed", value: `${neverPlayed}` },
            { label: "Value", value: libraryValue },
            { label: "Cost/Hr", value: cph > 0 ? `${currencySymbol}${cph.toFixed(2)}` : "—" },
          ].map((s) => (
            <div key={s.label} style={{
              flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 10, padding: "8px 10px", textAlign: "center" as const,
            }}>
              <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 3 }}>{s.label}</div>
              <div style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Footer: rating + watermark */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: gc.bg, border: `1px solid ${gc.border}`, borderRadius: 8, padding: "5px 12px" }}>
            <span style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", fontWeight: 600 }}>Verdict:</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: gc.text }}>{roast.rating}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(96,165,250,0.5)", letterSpacing: -0.5 }}>SteamPicker</span>
            <span style={{ color: "rgba(148,163,184,0.2)", fontSize: 11 }}>|</span>
            <span style={{ fontSize: 10, color: "rgba(148,163,184,0.3)" }}>steampicker.plazor.xyz</span>
          </div>
        </div>
      </div>

      {/* Right column: top games chart */}
      <div style={{
        flex: "0 0 40%", padding: "40px 44px 32px 0",
        display: "flex", flexDirection: "column", position: "relative", zIndex: 10,
      }}>
        {/* Shame game spotlight */}
        {shameGame && (
          <div style={{ marginBottom: 14, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(249,115,22,0.3)", position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shameGame.imageUrl} alt="" style={{ width: "100%", height: 100, objectFit: "cover", opacity: 0.7 }} crossOrigin="anonymous" />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(5,10,20,0.95) 30%, transparent)" }} />
            <div style={{ position: "absolute", bottom: 8, left: 12, right: 12 }}>
              <div style={{ color: "rgba(249,115,22,0.6)", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const }}>Game of Shame</div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{shameGame.name}</div>
              <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 11 }}>{Math.round(shameGame.hours).toLocaleString()}h of questionable life choices</div>
            </div>
          </div>
        )}

        <div style={{ color: "rgba(148,163,184,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 12 }}>
          Top Games by Playtime
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {topGames.slice(0, 8).map((game, i) => {
            const pct = maxHours > 0 ? (game.hours / maxHours) * 100 : 0;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{
                    color: i === 0 ? "#fff" : "rgba(203,213,225,0.7)",
                    fontSize: 12, fontWeight: i === 0 ? 700 : 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                    maxWidth: "75%",
                  }}>
                    {game.name}
                  </span>
                  <span style={{ color: "rgba(148,163,184,0.5)", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    {Math.round(game.hours).toLocaleString()}h
                  </span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${Math.max(pct, 2)}%`,
                    background: i === 0 ? `linear-gradient(90deg, ${gc.text}, ${gc.border})`
                      : `rgba(96,165,250,${0.4 - i * 0.04})`,
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Played vs unplayed donut-style bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "rgba(148,163,184,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const }}>Library Completion</span>
            <span style={{ color: playedPct > 70 ? "#22c55e" : playedPct > 40 ? "#eab308" : "#ef4444", fontSize: 12, fontWeight: 800 }}>{playedPct}%</span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 5, overflow: "hidden", display: "flex" }}>
            <div style={{
              width: `${playedPct}%`, height: "100%", borderRadius: 5,
              background: playedPct > 70 ? "linear-gradient(90deg, #22c55e, #16a34a)" : playedPct > 40 ? "linear-gradient(90deg, #eab308, #ca8a04)" : "linear-gradient(90deg, #ef4444, #dc2626)",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ color: "rgba(148,163,184,0.3)", fontSize: 9 }}>{totalGames - neverPlayed} played</span>
            <span style={{ color: "rgba(148,163,184,0.3)", fontSize: 9 }}>{neverPlayed} unplayed</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default RoastCard;
