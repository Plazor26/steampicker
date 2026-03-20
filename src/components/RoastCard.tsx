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

const GC: Record<string, { bg: string; border: string; text: string }> = {
  S: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)", text: "#ef4444" },
  A: { bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.5)", text: "#f97316" },
  B: { bg: "rgba(234,179,8,0.15)", border: "rgba(234,179,8,0.5)", text: "#eab308" },
  C: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.5)", text: "#22c55e" },
  D: { bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.5)", text: "#60a5fa" },
  F: { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)", text: "#94a3b8" },
};

const RoastCard = forwardRef<HTMLDivElement, RoastCardProps>(function RoastCard(
  { personaName, avatarUrl, totalGames, totalHours, neverPlayed, libraryValue, libraryValueNum, currencySymbol, roast, shameGame },
  ref
) {
  const playedPct = totalGames > 0 ? Math.round(((totalGames - neverPlayed) / totalGames) * 100) : 0;
  const cph = totalHours > 0 ? (libraryValueNum / totalHours) : 0;
  const gc = GC[roast.grade] || GC.F;

  return (
    <div
      ref={ref}
      style={{
        width: 800,
        background: "linear-gradient(145deg, #050a14 0%, #0c1929 40%, #0a1628 100%)",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Glows */}
      <div style={{ position: "absolute", top: -80, right: -60, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${gc.bg} 0%, transparent 70%)` }} />
      <div style={{ position: "absolute", bottom: -60, left: -40, width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }} />

      <div style={{ position: "relative", zIndex: 10, padding: 40, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 68, height: 68, borderRadius: 16, overflow: "hidden", border: `2px solid ${gc.border}`, boxShadow: `0 0 20px ${gc.bg}`, flexShrink: 0 }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.06)" }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{personaName}</div>
            <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, marginTop: 3 }}>Steam Profile Roast</div>
          </div>
          <div style={{ width: 58, height: 58, borderRadius: 14, background: gc.bg, border: `2px solid ${gc.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 30, fontWeight: 900, color: gc.text }}>{roast.grade}</span>
          </div>
        </div>

        {/* Shame game */}
        {shameGame && (
          <div style={{ marginTop: 0, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(249,115,22,0.3)", position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shameGame.imageUrl} alt="" style={{ width: "100%", height: 160, objectFit: "cover", objectPosition: "top", opacity: 0.65 }} crossOrigin="anonymous" />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(5,10,20,0.95) 25%, rgba(5,10,20,0.3) 60%, transparent)" }} />
            <div style={{ position: "absolute", bottom: 12, left: 16, right: 16 }}>
              <div style={{ color: "rgba(249,115,22,0.7)", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const }}>Game of Shame</div>
              <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, marginTop: 2 }}>{shameGame.name}</div>
              <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 11, marginTop: 1 }}>{Math.round(shameGame.hours).toLocaleString()}h of questionable life choices</div>
            </div>
          </div>
        )}

        {/* Headline */}
        <div style={{
          marginTop: 0,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: "18px 22px",
          borderLeft: `3px solid ${gc.border}`,
        }}>
          <div style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700, lineHeight: 1.35, fontStyle: "italic" as const }}>
            &ldquo;{roast.headline}&rdquo;
          </div>
        </div>

        {/* Roast lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 18 }}>
          {roast.lines.map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ color: gc.text, fontSize: 10, lineHeight: "20px", marginTop: 1 }}>&#9670;</span>
              <span style={{ color: "rgba(203,213,225,0.85)", fontSize: 13.5, lineHeight: "20px" }}>{line}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {[
            { label: "Games", value: totalGames.toLocaleString() },
            { label: "Hours", value: Math.round(totalHours).toLocaleString() },
            { label: "Unplayed", value: `${neverPlayed} (${100 - playedPct}%)` },
            { label: "Value", value: libraryValue },
            { label: "Cost/Hr", value: cph > 0 ? `${currencySymbol}${cph.toFixed(2)}` : "—" },
          ].map((s) => (
            <div key={s.label} style={{
              flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 10, padding: "9px 6px", textAlign: "center" as const,
            }}>
              <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 3 }}>{s.label}</div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: gc.bg, border: `1px solid ${gc.border}`, borderRadius: 8, padding: "5px 12px" }}>
            <span style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", fontWeight: 600 }}>Verdict:</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: gc.text }}>{roast.rating}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(96,165,250,0.5)", letterSpacing: -0.5 }}>SteamPicker</span>
            <span style={{ color: "rgba(148,163,184,0.2)", fontSize: 11 }}>|</span>
            <span style={{ fontSize: 10, color: "rgba(148,163,184,0.3)" }}>steampicker.plazor.xyz</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default RoastCard;
