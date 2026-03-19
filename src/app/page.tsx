"use client";

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Typewriter } from "react-simple-typewriter";
import { motion, useInView, useAnimation } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaGithub, FaSteam, FaFire, FaTags, FaLayerGroup, FaArrowRight } from "react-icons/fa";
import BackgroundEffects from "@/components/BackgroundEffects";

/* ─── Animated counter ─── */
function Counter({ from = 0, to = 1000, duration = 2.2, className = "", prefix = "", suffix = "" }: {
  from?: number; to?: number; duration?: number; className?: string; prefix?: string; suffix?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px 0px" });
  const [val, setVal] = useState(from);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      setVal(Math.round(from + (to - from) * ease(p)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, from, to, duration]);
  return <div ref={ref} className={className}>{prefix}{val.toLocaleString()}{suffix}</div>;
}

/* ─── Sale meta types ─── */
type SaleMeta = {
  gamesOnSale: number | null;
  saleLabel: string | null;
  phase: "active" | "upcoming" | null;
  saleTargetAt: string | null;
  now: string;
};

/* ─── Countdown ─── */
function CountdownText({ targetISO }: { targetISO: string | null }) {
  const [txt, setTxt] = useState("—");
  useEffect(() => {
    if (!targetISO) { setTxt("—"); return; }
    const target = new Date(targetISO).getTime();
    const fmt = (ms: number) => {
      if (ms <= 0) return "00d 00h 00m";
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    };
    const tick = () => setTxt(fmt(target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO]);
  return <>{txt}</>;
}

/* ─── Sale event type from API ─── */
type SaleEventData = {
  name: string;
  type: "major" | "fest" | "themed";
  start: string;
  end: string;
  estimated: boolean;
  source: "valve" | "fallback";
};

type SalesPayload = {
  events: SaleEventData[];
  liveCheck: { isMajorSaleActive: boolean; activeSaleName: string | null };
  dataSource: "valve" | "fallback";
};

/* ─── Calendar helpers ─── */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const EVENT_COLORS = {
  major:  { bg: "bg-blue-500/25", border: "border-blue-500/50", text: "text-blue-300", dot: "bg-blue-400" },
  fest:   { bg: "bg-purple-500/20", border: "border-purple-500/40", text: "text-purple-300", dot: "bg-purple-400" },
  themed: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-300", dot: "bg-emerald-400" },
};

/* ─── Calendar component (fetches from /api/steam/sales) ─── */
function SaleCalendar() {
  const [now, setNow] = useState(() => new Date());
  const [offset, setOffset] = useState(0); // month offset from current
  const [events, setEvents] = useState<SaleEventData[]>([]);
  const [liveCheck, setLiveCheck] = useState<SalesPayload["liveCheck"] | null>(null);
  const [dataSource, setDataSource] = useState<"valve" | "fallback" | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<{ ev: SaleEventData; x: number; y: number } | null>(null);
  const calRef = useRef<HTMLDivElement>(null);

  // Tick every second so live event detection is exact
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/steam/sales", { signal: ctrl.signal });
        if (res.ok) {
          const data: SalesPayload = await res.json();
          setEvents(data.events);
          setLiveCheck(data.liveCheck);
          setDataSource(data.dataSource);
        }
      } catch {}
    })();
    return () => ctrl.abort();
  }, []);

  // Find the currently live event (checked to the second)
  const liveEvent = useMemo(() => {
    const nowMs = now.getTime();
    return events.find(ev => {
      const s = new Date(ev.start + "T00:00:00").getTime();
      const e = new Date(ev.end + "T23:59:59").getTime();
      return nowMs >= s && nowMs <= e;
    }) ?? null;
  }, [events, now]);

  const navigateToEvent = (ev: SaleEventData) => {
    const evStart = new Date(ev.start + "T00:00:00");
    const monthDiff = (evStart.getFullYear() - now.getFullYear()) * 12 + (evStart.getMonth() - now.getMonth());
    setOffset(monthDiff);
  };

  const viewYear  = new Date(now.getFullYear(), now.getMonth() + offset, 1).getFullYear();
  const viewMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1).getMonth();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay  = startDayOfWeek(viewYear, viewMonth);

  // Build a map: day number -> events active on that day
  const dayEvents = useMemo(() => {
    const map: Record<number, SaleEventData[]> = {};
    for (const ev of events) {
      const s = new Date(ev.start + "T00:00:00");
      const e = new Date(ev.end + "T23:59:59");
      for (let d = 1; d <= totalDays; d++) {
        const cellDate = new Date(viewYear, viewMonth, d);
        if (cellDate >= s && cellDate <= e) {
          if (!map[d]) map[d] = [];
          map[d].push(ev);
        }
      }
    }
    return map;
  }, [events, viewYear, viewMonth, totalDays]);

  const isToday = (d: number) =>
    viewYear === now.getFullYear() && viewMonth === now.getMonth() && d === now.getDate();

  const handleDayHover = (d: number, e: React.MouseEvent) => {
    const evs = dayEvents[d];
    if (!evs?.length) { setHoveredEvent(null); return; }
    const rect = calRef.current?.getBoundingClientRect();
    setHoveredEvent({
      ev: evs[0],
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0) - 10,
    });
  };

  return (
    <div ref={calRef} className="relative">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setOffset(o => o - 1)}
          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-gray-400 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="text-center">
          <h3 className="text-lg font-bold text-white">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => setOffset(o => o + 1)}
          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-gray-400 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Live sale indicator — only when an event is actually live right now */}
      {liveEvent && (
        <button
          onClick={() => navigateToEvent(liveEvent)}
          className="mb-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-semibold hover:bg-green-500/15 transition-colors cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          {liveEvent.name} is LIVE right now
        </button>
      )}

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-600 py-2">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {/* Day cells */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const d = i + 1;
          const evs = dayEvents[d] || [];
          const hasEvent = evs.length > 0;
          const topEvent = evs[0];
          const colors = topEvent ? EVENT_COLORS[topEvent.type] : null;
          const isPast = new Date(viewYear, viewMonth, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate());

          return (
            <div
              key={d}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center relative cursor-default transition-all duration-150
                ${hasEvent ? `${colors!.bg} ${colors!.border} border` : "hover:bg-white/[0.02]"}
                ${isToday(d) ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-[#050a14] bg-blue-500/10" : ""}
                ${isPast && !hasEvent ? "opacity-30" : ""}
              `}
              onMouseEnter={(e) => handleDayHover(d, e)}
              onMouseLeave={() => setHoveredEvent(null)}
            >
              <span className={`text-sm font-medium ${hasEvent ? colors!.text : isToday(d) ? "text-blue-200 font-bold" : "text-gray-400"}`}>
                {d}
              </span>
              {isToday(d) && !hasEvent && (
                <span className="text-[8px] text-blue-400 font-bold leading-none">TODAY</span>
              )}
              {/* Event dots */}
              {hasEvent && (
                <div className="flex gap-0.5 mt-0.5">
                  {evs.slice(0, 3).map((ev, j) => (
                    <div key={j} className={`w-1 h-1 rounded-full ${EVENT_COLORS[ev.type].dot}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredEvent && (
        <div
          className="absolute z-50 px-4 py-3 rounded-xl bg-gray-900/95 border border-white/[0.12] backdrop-blur-md shadow-2xl pointer-events-none max-w-[240px]"
          style={{ left: Math.min(hoveredEvent.x, 280), top: hoveredEvent.y - 70 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${EVENT_COLORS[hoveredEvent.ev.type].dot}`} />
            <span className="font-bold text-white text-sm">{hoveredEvent.ev.name}</span>
          </div>
          <p className="text-gray-400 text-xs">
            {new Date(hoveredEvent.ev.start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {" — "}
            {new Date(hoveredEvent.ev.end + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${EVENT_COLORS[hoveredEvent.ev.type].bg} ${EVENT_COLORS[hoveredEvent.ev.type].text}`}>
              {hoveredEvent.ev.type}
            </span>
            {hoveredEvent.ev.estimated && (
              <span className="text-[10px] text-gray-600 italic">Estimated</span>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Major Sale</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Steam Fest</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Themed Fest</div>
      </div>
      <p className="mt-3 text-[10px] text-gray-700 text-center">
        {dataSource === "valve"
          ? "Live data from Valve Steamworks announcements"
          : dataSource === "fallback"
            ? "Using cached Valve schedule (live fetch unavailable)"
            : "Loading sale dates..."}
      </p>
    </div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon, title, desc, gradient, delay }: {
  icon: React.ReactNode; title: string; desc: string; gradient: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, scale: 1.02 }}
      className="relative group rounded-2xl bg-white/[0.04] border border-white/[0.08] p-8 backdrop-blur-sm overflow-hidden cursor-default transition-colors duration-300 hover:border-white/[0.16]"
    >
      {/* gradient glow on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${gradient} rounded-2xl`} />
      <div className="relative z-10">
        <div className="mb-5 inline-flex p-3 rounded-xl bg-white/[0.06] border border-white/[0.08]">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─── Stat card ─── */
function StatCard({ label, value, sub, color, delay }: {
  label: string; value: React.ReactNode; sub: string; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl bg-white/[0.04] border border-white/[0.08] p-7 backdrop-blur-sm overflow-hidden group"
    >
      <motion.div
        className={`absolute w-20 h-20 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity ${color}`}
        animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative z-10">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{label}</div>
        <div className={`text-4xl font-extrabold mb-1 ${color.replace("bg-", "text-")}`}>{value}</div>
        <div className="text-xs text-gray-500">{sub}</div>
      </div>
    </motion.div>
  );
}

/* ─── Main page ─── */
export default function Home() {
  const router = useRouter();
  const [meta, setMeta] = useState<SaleMeta | null>(null);
  const [pasteInput, setPasteInput] = useState("");
  const [submitting, setSubmitting] = useState<null | "login" | "paste">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/steam/meta", { signal: ctrl.signal });
        if (res.ok) setMeta(await res.json());
      } catch {}
    })();
    return () => ctrl.abort();
  }, []);

  const handleSteamLogin = () => {
    setError(null);
    setSubmitting("login");
    window.location.href = "/api/auth/steam";
  };

  const handlePasteSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!pasteInput.trim()) return;
    setError(null);
    setSubmitting("paste");
    try {
      const res = await fetch("/api/auth/steam/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: pasteInput.trim() }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || "Could not resolve that Steam profile");
      }
      const { steamId } = await res.json();
      router.push(`/profile/${steamId}`);
    } catch (err: any) {
      setError(err?.message || "Resolution failed");
      setSubmitting(null);
    }
  };

  return (
    <main className="relative min-h-screen text-gray-100 overflow-x-hidden">
      <BackgroundEffects />
      <div className="relative z-10">

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 py-32">

        {/* Spring sale badge */}
        {meta && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-300 text-xs font-semibold tracking-wide"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-400" />
            </span>
            {meta.phase === "active"
              ? `${meta.saleLabel} is LIVE — ends in `
              : `${meta.saleLabel ?? "Next Sale"} starts in `}
            <span className="font-mono font-bold text-orange-200">
              <CountdownText targetISO={meta.saleTargetAt ?? null} />
            </span>
          </motion.div>
        )}

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight mb-4 leading-none"
        >
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(59,130,246,0.5)]">
            Steam
          </span>
          <span className="text-white">Picker</span>
        </motion.h1>

        {/* Typewriter subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-xl md:text-2xl text-gray-400 mb-10 h-8"
        >
          <Typewriter
            words={[
              "Find your next game in seconds.",
              "AI picks. Spotify-level accuracy.",
              "Spring Sale starts tomorrow.",
              "Your Steam. Curated.",
            ]}
            loop={0}
            cursor
            cursorStyle="|"
            typeSpeed={55}
            deleteSpeed={35}
            delaySpeed={2000}
          />
        </motion.p>

        {/* CTA card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] rounded-2xl p-6 shadow-[0_0_80px_rgba(59,130,246,0.12)]"
        >
          {/* Steam login */}
          <div className="mb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSteamLogin}
              disabled={submitting === "login"}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-600/30 transition-all duration-200 disabled:opacity-60"
            >
              <FaSteam size={20} />
              {submitting === "login" ? "Redirecting…" : "Sign in through Steam"}
            </motion.button>
            <p className="text-center text-xs text-gray-400 mt-2">This site is not associated with Valve Corp.</p>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-gray-500 text-xs font-medium">or enter your username</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          {/* URL form */}
          <form onSubmit={handlePasteSubmit} className="flex rounded-xl overflow-hidden border border-white/[0.1] focus-within:border-blue-500/50 transition-colors">
            <input
              type="text"
              placeholder="Enter your Steam username"
              className="flex-1 px-4 py-3 bg-white/[0.04] text-gray-200 text-sm placeholder-gray-500 focus:outline-none"
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={submitting === "paste"}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {submitting === "paste" ? "…" : <><span>Go</span><FaArrowRight size={12} /></>}
            </button>
          </form>

          {error && (
            <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
          )}

          <p className="mt-4 text-center text-xs text-gray-600">
            No account required · Private by design · Open source
          </p>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-2 rounded-full bg-white/30" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-gray-400 text-xs font-semibold tracking-widest uppercase mb-4">
            What it does
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Built for gamers who <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">actually play</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<FaFire size={24} className="text-blue-400" />}
            title="Trending Games"
            desc="See what's hot on Steam right now, filtered by your genre preferences — not what everyone else plays."
            gradient="from-blue-500/10 to-transparent"
            delay={0}
          />
          <FeatureCard
            icon={<FaTags size={24} className="text-emerald-400" />}
            title="Sale Matching"
            desc="Spring Sale picks ranked by how closely they match your playstyle. Never scroll blindly again."
            gradient="from-emerald-500/10 to-transparent"
            delay={0.1}
          />
          <FeatureCard
            icon={<FaLayerGroup size={24} className="text-purple-400" />}
            title="Library Intelligence"
            desc="Roast your backlog, flex your stats, or find the hidden gem already sitting in your library."
            gradient="from-purple-500/10 to-transparent"
            delay={0.2}
          />
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Backlogs Roasted"
            value={<Counter from={0} to={69420} duration={2.4} />}
            sub="we saw everything"
            color="bg-blue-400 text-blue-400"
            delay={0}
          />
          <StatCard
            label="Gamers Judged"
            value="∞"
            sub="no one is safe"
            color="bg-emerald-400 text-emerald-400"
            delay={0.1}
          />
          <StatCard
            label="Games on Sale"
            value={meta?.gamesOnSale != null
              ? <Counter from={0} to={meta.gamesOnSale} duration={2} />
              : "—"}
            sub="via Steam Store"
            color="bg-cyan-400 text-cyan-400"
            delay={0.2}
          />
          <StatCard
            label={meta?.saleLabel ?? "Next Sale"}
            value={<span className="text-3xl font-mono"><CountdownText targetISO={meta?.saleTargetAt ?? null} /></span>}
            sub={meta?.phase === "active" ? "ends in" : "starts in"}
            color="bg-violet-400 text-violet-400"
            delay={0.3}
          />
        </div>
      </section>

      {/* ── STEAM SALE CALENDAR ── */}
      <section className="py-24 px-6 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-gray-400 text-xs font-semibold tracking-widest uppercase mb-4">
            Plan Ahead
          </div>
          <h2 className="text-4xl font-bold text-white mb-3">
            Steam Sale <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Calendar</span>
          </h2>
          <p className="text-gray-400 text-base">All major sales over the next 12 months, so you never miss a deal.</p>
        </motion.div>
        <SaleCalendar />
      </section>

      {/* ── OPEN SOURCE CTA ── */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center relative overflow-visible"
        >
          <div className="pointer-events-none absolute -inset-4 bg-gradient-to-r from-blue-600/25 via-purple-600/25 to-pink-600/25 blur-2xl rounded-3xl" />
          <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-gray-400 text-xs font-semibold tracking-widest uppercase mb-6">
              Free &amp; Open Source
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">
              Built by gamers, for gamers
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
              No ads. No tracking. No stored data. SteamPicker is open and transparent.
            </p>
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href="https://github.com/Plazor26/steam-site"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base bg-white text-black hover:bg-gray-100 transition shadow-xl"
            >
              <FaGithub size={20} /> View on GitHub
            </motion.a>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2 font-semibold text-gray-300">
            <FaSteam className="text-blue-400" />
            SteamPicker
          </div>
          <p>© {new Date().getFullYear()} SteamPicker — Built by NeuraFate</p>
          <a
            href="https://github.com/Plazor26/steam-site"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-300 transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>

      </div>{/* end z-10 wrapper */}
    </main>
  );
}
