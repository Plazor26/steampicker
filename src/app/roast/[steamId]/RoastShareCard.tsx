"use client";

import type { ShareableRoast } from "@/lib/roastShare";

const GC: Record<string, { bg: string; border: string; text: string }> = {
  S: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)", text: "#ef4444" },
  A: { bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.5)", text: "#f97316" },
  B: { bg: "rgba(234,179,8,0.15)", border: "rgba(234,179,8,0.5)", text: "#eab308" },
  C: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.5)", text: "#22c55e" },
  D: { bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.5)", text: "#60a5fa" },
  F: { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)", text: "#94a3b8" },
};

export default function RoastShareCard({ roast, steamId }: { roast: ShareableRoast; steamId: string }) {
  const gc = GC[roast.gr] || GC.F;
  const playedPct = roast.g > 0 ? Math.round(((roast.g - roast.u) / roast.g) * 100) : 0;
  const cph = roast.h > 0 ? roast.vn / roast.h : 0;

  return (
    <div className="w-full max-w-[640px] relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(145deg, #050a14 0%, #0c1929 40%, #0a1628 100%)" }}>
      {/* Glows */}
      <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full" style={{ background: `radial-gradient(circle, ${gc.bg} 0%, transparent 70%)` }} />
      <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }} />

      <div className="relative z-10 p-8 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: `2px solid ${gc.border}`, boxShadow: `0 0 20px ${gc.bg}` }}>
            {roast.a ? (
              <img src={roast.a} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/[0.06]" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-white text-2xl font-extrabold leading-tight">{roast.n}</div>
            <div className="text-gray-500/50 text-[10px] font-bold tracking-[2.5px] uppercase mt-1">Steam Profile Roast</div>
          </div>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: gc.bg, border: `2px solid ${gc.border}` }}>
            <span className="text-3xl font-black" style={{ color: gc.text }}>{roast.gr}</span>
          </div>
        </div>

        {/* Shame game */}
        {roast.sg && (
          <div className="rounded-xl overflow-hidden relative" style={{ border: `1px solid rgba(249,115,22,0.3)` }}>
            <img src={roast.sg.img} alt="" className="w-full h-40 object-cover object-top opacity-65" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,10,20,0.95) 25%, rgba(5,10,20,0.3) 60%, transparent)" }} />
            <div className="absolute bottom-3 left-4 right-4">
              <div className="text-orange-500/70 text-[9px] font-bold tracking-[2px] uppercase">Game of Shame</div>
              <div className="text-white text-base font-bold mt-0.5">{roast.sg.n}</div>
              <div className="text-gray-400/50 text-[11px] mt-0.5">{Math.round(roast.sg.h)}h of questionable life choices</div>
            </div>
          </div>
        )}

        {/* Headline */}
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: `3px solid ${gc.border}` }}>
          <p className="text-gray-200 text-lg font-bold italic leading-snug">&ldquo;{roast.hl}&rdquo;</p>
        </div>

        {/* Roast lines */}
        <div className="flex flex-col gap-2 mt-2">
          {roast.ln.map((line, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-[10px] mt-0.5" style={{ color: gc.text }}>&#9670;</span>
              <span className="text-gray-300/85 text-[13.5px] leading-5">{line}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 mt-3">
          {[
            { label: "Games", value: roast.g.toLocaleString() },
            { label: "Hours", value: Math.round(roast.h).toLocaleString() },
            { label: "Unplayed", value: `${roast.u} (${100 - playedPct}%)` },
            { label: "Value", value: roast.v },
            { label: "Cost/Hr", value: cph > 0 ? `${roast.cs}${cph.toFixed(2)}` : "—" },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-gray-500/50 text-[8px] font-bold uppercase tracking-[1.5px] mb-1">{s.label}</div>
              <div className="text-white text-sm font-extrabold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: gc.bg, border: `1px solid ${gc.border}` }}>
            <span className="text-[10px] text-gray-400/60 font-semibold">Verdict:</span>
            <span className="text-[13px] font-extrabold" style={{ color: gc.text }}>{roast.rt}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-extrabold text-blue-400/50">SteamPicker</span>
            <span className="text-gray-500/20 text-[11px]">|</span>
            <span className="text-[10px] text-gray-500/30">steampicker.plazor.xyz</span>
          </div>
        </div>
      </div>
    </div>
  );
}
