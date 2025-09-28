"use client";

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { Typewriter } from "react-simple-typewriter";
import { motion, useInView } from "framer-motion";
import { FaGithub, FaSteam, FaFire, FaTags, FaLayerGroup } from "react-icons/fa";

/* ---------- Small Counter component (animated on scroll) ---------- */
function Counter({
  from = 0,
  to = 1000,
  duration = 2.2,
  className = "",
  prefix = "",
  suffix = "",
}: {
  from?: number;
  to?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // FIX: rootMargin must be pixels, not percentages – otherwise it never triggers.
  const inView = useInView(ref, { once: true, margin: "-120px 0px -120px 0px" });
  const [val, setVal] = useState(from);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const n = Math.round(from + (to - from) * easeOutCubic(p));
      setVal(n);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, from, to, duration]);

  return (
    <div ref={ref} className={className}>
      {prefix}
      {val.toLocaleString()}
      {suffix}
    </div>
  );
}

/* ---------- Live sale meta types ---------- */
type SaleMeta = {
  gamesOnSale: number | null;
  saleLabel: string | null;            // e.g. "Summer Sale", "Next Sale"
  phase: "active" | "upcoming" | null; // whether we're in a sale or waiting
  saleTargetAt: string | null;         // ISO timestamp (end if active, start if upcoming)
  now: string;                         // ISO
};

/* ---------- Countdown text (isolated) ---------- */
function CountdownText({ targetISO }: { targetISO: string | null }) {
  const [txt, setTxt] = useState("—");

  useEffect(() => {
    if (!targetISO) {
      setTxt("—");
      return;
    }
    const target = new Date(targetISO).getTime();
    const format = (ms: number) => {
      if (ms <= 0) return "00d 00h 00m";
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    };
    const tick = () => setTxt(format(target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO]);

  return <>{txt}</>;
}

/* ---------- Review Carousel (memoized) ---------- */
const REVIEWS = [
  { name: "PiaggioApe", text: "Discovered SteamPicker and actually found a game I wanted to play instead of scrolling forever. It felt magical." },
  { name: "nums", text: "Owns 900 games, plays none. SteamPicker called me out harder than my mom" },
  { name: "BollyBoi", text: "Finally a site that understands my love for soulslike games. Respect." },
  { name: "Madscientist", text: "SteamPicker recommended something I had forgotten I even owned. Best surprise session ever." },
  { name: "SABRE", text: "It feels like a friend pointing out the good stuff in my library. No judgment, just fun." },
  { name: "sinhagaurav5342", text: "SteamPicker helped me spot the perfect sale. My wallet is crying but I’m happy." },
  { name: "saraneverknows", text: "I wanted to look mysterious but SteamPicker made me look adventurous instead. I’ll take it." },
  { name: "Dosaluver", text: "Usually I buy bundles and forget them. This time I actually played something. That’s progress." },
];


function ReviewCard({ name, text }: { name: string; text: string }) {
  return (
    <div className="min-w-[26rem] max-w-[26rem]">
      <div className="bg-white/6 backdrop-blur rounded-2xl p-6 shadow-lg border border-white/10 hover:border-white/20 transition-colors">
        <h3 className="text-xl font-semibold text-blue-300 mb-2">@{name}</h3>
        <p className="text-gray-200 italic leading-relaxed">“{text}”</p>
      </div>
    </div>
  );
}

const ReviewCarousel = memo(function ReviewCarousel() {
  // Duplicate array twice so it loops seamlessly
  const STRIP = useMemo(() => [...REVIEWS, ...REVIEWS], []);

  return (
    <section className="py-20">
      <h2 className="text-3xl font-bold text-center mb-12">Gamers Love SteamPicker</h2>

      {/* full-bleed strip */}
      <div className="relative w-screen left-1/2 right-1/2 -ml-[50vw]">
        <div
          className="overflow-hidden"
          style={{
            WebkitMaskImage:
              "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
            maskImage:
              "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
          }}
        >
          <motion.div
            className="flex gap-6"
            animate={{ x: ["0%", "-100%"] }} // travel one full strip
            transition={{ ease: "linear", duration: 60, repeat: Infinity }}
            style={{ willChange: "transform" }}
          >
            {STRIP.map((r, i) => (
              <ReviewCard key={`${r.name}-${i}`} name={r.name} text={r.text} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
});

export default function Home() {
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<SaleMeta | null>(null);

  /* Particles */
  useEffect(() => {
    initParticlesEngine(loadFull).then(() => setReady(true));
  }, []);

  /* Live meta fetch */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/steam/meta", {
          next: { revalidate: 300 },
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data: SaleMeta = await res.json();
        setMeta(data);
      } catch {}
    })();
    return () => ctrl.abort();
  }, []);

  const particlesOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      background: { color: "transparent" },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: { value: 140, density: { enable: true, area: 800 } },
        color: { value: ["#60a5fa", "#a78bfa", "#22d3ee"] },
        links: { enable: true, color: "#7dd3fc", distance: 140, opacity: 0.45, width: 1 },
        move: { enable: true, speed: 1.1, outModes: { default: "out" } },
        opacity: { value: 0.75 },
        size: { value: { min: 2, max: 4 } },
      },
      interactivity: {
        events: { onHover: { enable: true, mode: "repulse" }, resize: true },
        modes: { repulse: { distance: 120, duration: 0.4 } },
      },
    }),
    []
  );

  return (
    <main className="relative min-h-screen text-gray-100 overflow-hidden">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute inset-0 opacity-[0.12] bg-[length:40px_40px] bg-[radial-gradient(circle,_rgba(255,255,255,0.14)_1px,_transparent_1px)] animate-[grid-pan_24s_linear_infinite]" />
        <div className="absolute -top-32 -left-32 w-[45rem] h-[45rem] rounded-full blur-3xl opacity-40 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.45),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(168,85,247,0.35),transparent_60%)] animate-[float-slow_22s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-16rem] right-[-16rem] w-[42rem] h-[42rem] rounded-full blur-3xl opacity-35 bg-[radial-gradient(circle_at_40%_40%,rgba(34,211,238,0.4),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.35),transparent_60%)] animate-[float-slower_28s_ease-in-out_infinite]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0b1220] via-[#0e1322] to-[#05070c]" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5))]" />

      {ready && <Particles id="tsparticles" options={particlesOptions as any} className="absolute inset-0 -z-10" />}

      {/* HERO (glass) */}
      <section className="relative flex flex-col items-center justify-center text-center py-28 px-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl px-8 sm:px-10 py-10 sm:py-12 max-w-2xl w-full">
          <h1 className="text-6xl md:text-7xl font-extrabold mb-4 drop-shadow-[0_0_28px_rgba(59,130,246,0.7)]">
            <span className="text-blue-400">SteamPicker</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-200/90 mb-1">Find sales that match your taste.</p>
          <h2 className="text-lg md:text-xl text-gray-300 mb-6">
            <Typewriter
              words={["Your Steam, curated.", "Discover trending titles.", "Find sales that match your taste.", "Turn your stats into stories."]}
              loop={0}
              cursor
              cursorStyle="|"
              typeSpeed={60}
              deleteSpeed={40}
              delaySpeed={1500}
            />
          </h2>
          <p className="text-base md:text-lg text-gray-400 max-w-2xl mb-8 leading-relaxed mx-auto">
            Discover games shaped around you—trending, discounted, unforgettable. <span className="text-blue-400">Open source</span>. Private by design.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 w-full max-w-xl mx-auto">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto px-8 py-4 text-lg rounded-xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/40 transition-transform flex items-center justify-center gap-3">
              <FaSteam /> Login with Steam
            </motion.button>
            <span className="text-gray-400 font-semibold">or</span>
            <motion.form whileHover={{ scale: 1.02 }} className="flex w-full sm:w-auto bg-black/30 rounded-xl border border-white/10 overflow-hidden shadow-lg">
              <input type="text" placeholder="Steam username" className="px-4 py-3 w-full text-gray-200 bg-transparent focus:outline-none placeholder-gray-500" />
              <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 font-bold text-white transition">Go</button>
            </motion.form>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-6 max-w-6xl mx-auto grid gap-12 md:grid-cols-3 text-center">
        {[
          { icon: <FaFire size={40} className="text-blue-400 mx-auto mb-4" />, title: "Trending Games", desc: "See what’s hot on Steam, updated in real time.", color: "from-blue-500/40 to-blue-800/10" },
          { icon: <FaTags size={40} className="text-green-400 mx-auto mb-4" />, title: "Smart Sales", desc: "Discounts ranked by how closely they match your taste.", color: "from-green-500/40 to-emerald-700/10" },
          { icon: <FaLayerGroup size={40} className="text-pink-400 mx-auto mb-4" />, title: "Flex & Roast", desc: "Generate cards that celebrate your stats, or expose your backlog sins.", color: "from-pink-500/40 to-fuchsia-700/10" },
        ].map((f, i) => (
          <motion.div key={i} whileHover={{ scale: 1.05 }} className={`bg-gradient-to-br ${f.color} rounded-xl p-8 shadow-lg border border-white/10 backdrop-blur-md hover:border-white/20 transition-all`}>
            {f.icon}
            <h3 className="text-2xl font-semibold mb-3">{f.title}</h3>
            <p className="text-gray-300">{f.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* METRICS */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 text-center">
          {/* Meme */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-xl backdrop-blur">
              <div className="text-sm uppercase tracking-widest text-blue-300 mb-2">Backlogs Roasted</div>
              <Counter from={0} to={69420} duration={2.4} className="text-4xl font-extrabold text-blue-400" />
              <p className="text-gray-400 mt-2 text-sm">we saw everything</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-xl backdrop-blur">
              <div className="text-sm uppercase tracking-widest text-emerald-300 mb-2">Gamers Judged</div>
              <div className="text-4xl font-extrabold text-emerald-400 select-none">∞</div>
              <p className="text-gray-400 mt-2 text-sm">no one is safe</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-xl backdrop-blur">
              <div className="text-sm uppercase tracking-widest text-pink-300 mb-2">Games Actually Finished</div>
              <Counter from={0} to={1} duration={1.2} className="text-4xl font-extrabold text-pink-400" />
              <p className="text-gray-400 mt-2 text-sm">historic moment</p>
            </div>
          </div>

          {/* Live */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-xl backdrop-blur">
              <div className="text-sm uppercase tracking-widest text-cyan-300 mb-2">Games on Sale Right Now</div>
              <div className="text-4xl font-extrabold text-cyan-400">
                {meta?.gamesOnSale != null ? meta.gamesOnSale.toLocaleString() : "—"}
              </div>
              <p className="text-gray-400 mt-2 text-sm">via Steam Store</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-xl backdrop-blur">
              <div className="text-sm uppercase tracking-widest text-violet-300 mb-2">{meta?.saleLabel ?? "Next Sale"}</div>
              <div className="text-4xl font-extrabold text-violet-400">
                <CountdownText targetISO={meta?.saleTargetAt ?? null} />
              </div>
              <p className="text-gray-400 mt-2 text-sm">
                {meta?.phase ? (meta.phase === "active" ? "ends in" : "starts in") : "schedule pending"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <ReviewCarousel />

      {/* OPEN SOURCE */}
      <section className="py-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30 bg-gradient-to-r from-blue-600/40 via-purple-600/40 to-pink-600/40 blur-2xl" />
        <h2 className="text-3xl font-bold text-white mb-4">Free & Open Source</h2>
        <p className="text-gray-200 max-w-2xl mx-auto mb-8">
          Built by gamers, for gamers. No ads. No tracking. No stored data. SteamPicker is open, transparent, and community-driven.
        </p>
        <a href="https://github.com/Plazor26/steam-site" target="_blank" className="px-10 py-4 text-lg rounded-xl font-bold bg-white text-black hover:bg-gray-200 transition inline-flex items-center gap-3">
          <FaGithub /> View on GitHub
        </a>
      </section>

      {/* FOOTER */}
      <footer className="py-14 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12 text-center md:text-left">
          <div>
            <h3 className="text-lg font-semibold mb-4">SteamPicker</h3>
            <p className="text-gray-400 text-sm">Your Steam, curated. Discover games shaped around you—trending, discounted, unforgettable. Open source. Private by design.</p>
          </div>

            <div className="md:col-start-3 md:justify-self-end text-center md:text-right">
            <h3 className="text-lg font-semibold mb-4 md:text-left">Credits</h3>
            <p className="text-gray-400 text-sm">© {new Date().getFullYear()} SteamPicker — Built by Plazor & Mai</p>
            </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes float-slow { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(30px,-20px,0) scale(1.05); } 100% { transform: translate3d(0,0,0) scale(1); } }
        @keyframes float-slower { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-40px,25px,0) scale(1.04); } 100% { transform: translate3d(0,0,0) scale(1); } }
        @keyframes grid-pan { 0% { background-position: 0px 0px; } 100% { background-position: 40px 40px; } }
      `}</style>
    </main>
  );
}
