"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const inView = useInView(ref, { once: true, margin: "-40% 0px -40% 0px" });
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

export default function Home() {
  const [ready, setReady] = useState(false);

  /* ---------- Particles init ---------- */
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => setReady(true));
  }, []);

  const particlesOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      background: { color: "transparent" },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: { value: 140, density: { enable: true, area: 800 } },
        color: { value: ["#60a5fa", "#a78bfa", "#22d3ee"] }, // blue/violet/cyan
        links: {
          enable: true,
          color: "#7dd3fc",
          distance: 140,
          opacity: 0.45,
          width: 1,
        },
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
      {/* ---------- Global animated background (one layer for entire page) ---------- */}
      <div className="pointer-events-none absolute inset-0 -z-20">
        {/* animated grid */}
        <div className="absolute inset-0 opacity-[0.12] bg-[length:40px_40px] bg-[radial-gradient(circle,_rgba(255,255,255,0.14)_1px,_transparent_1px)] animate-[grid-pan_24s_linear_infinite]"></div>
        {/* floating gradient orbs */}
        <div className="absolute -top-32 -left-32 w-[45rem] h-[45rem] rounded-full blur-3xl opacity-40 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.45),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(168,85,247,0.35),transparent_60%)] animate-[float-slow_22s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-[-16rem] right-[-16rem] w-[42rem] h-[42rem] rounded-full blur-3xl opacity-35 bg-[radial-gradient(circle_at_40%_40%,rgba(34,211,238,0.4),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.35),transparent_60%)] animate-[float-slower_28s_ease-in-out_infinite]"></div>
        {/* deep base gradient so there is no banding between sections */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0b1220] via-[#0e1322] to-[#05070c]" />
      </div>

      {/* subtle vignette */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5))]" />

      {/* Particles */}
      {ready && (
        <Particles
          id="tsparticles"
          options={particlesOptions as any}
          className="absolute inset-0 -z-10"
        />
      )}

      {/* ---------- HERO ---------- */}
      <section className="relative flex flex-col items-center justify-center text-center py-28 px-6">
        <h1 className="text-6xl md:text-7xl font-extrabold mb-4 drop-shadow-[0_0_28px_rgba(59,130,246,0.7)]">
          <span className="text-blue-400">SteamPicker</span>
        </h1>

        {/* sub-head (extra line you mentioned) */}
        <p className="text-xl md:text-2xl text-gray-200/90 mb-1">
          Find sales that match your taste.
        </p>

        <h2 className="text-lg md:text-xl text-gray-300 mb-6">
          <Typewriter
            words={[
              "Your Steam, curated.",
              "Discover trending titles.",
              "Find sales that match your taste.",
              "Turn your stats into stories.",
            ]}
            loop={0}
            cursor
            cursorStyle="|"
            typeSpeed={60}
            deleteSpeed={40}
            delaySpeed={1500}
          />
        </h2>

        <p className="text-base md:text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Discover games shaped around you—trending, discounted, unforgettable.{" "}
          <span className="text-blue-400">Open source</span>. Private by design.
        </p>

        {/* Dual option: login or paste */}
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full max-w-xl">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full sm:w-auto px-8 py-4 text-lg rounded-xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/40 transition-transform flex items-center justify-center gap-3"
          >
            <FaSteam /> Login with Steam
          </motion.button>

          <span className="text-gray-400 font-semibold">or</span>

          <motion.form
            whileHover={{ scale: 1.02 }}
            className="flex w-full sm:w-auto bg-black/30 rounded-xl border border-white/10 overflow-hidden shadow-lg"
          >
            <input
              type="text"
              placeholder="Paste your Steam username or URL"
              className="px-4 py-3 w-full text-gray-200 bg-transparent focus:outline-none placeholder-gray-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 font-bold text-white transition"
            >
              Go
            </button>
          </motion.form>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section className="py-20 px-6 max-w-6xl mx-auto grid gap-12 md:grid-cols-3 text-center">
        {[
          {
            icon: <FaFire size={40} className="text-blue-400 mx-auto mb-4" />,
            title: "Trending Games",
            desc: "See what’s hot on Steam, updated in real time.",
            color: "from-blue-500/40 to-blue-800/10",
          },
          {
            icon: <FaTags size={40} className="text-green-400 mx-auto mb-4" />,
            title: "Smart Sales",
            desc: "Discounts ranked by how closely they match your taste.",
            color: "from-green-500/40 to-emerald-700/10",
          },
          {
            icon: (
              <FaLayerGroup size={40} className="text-pink-400 mx-auto mb-4" />
            ),
            title: "Flex & Roast",
            desc: "Generate cards that celebrate your stats—or expose your backlog sins.",
            color: "from-pink-500/40 to-fuchsia-700/10",
          },
        ].map((f, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05 }}
            className={`bg-gradient-to-br ${f.color} rounded-xl p-8 shadow-lg border border-white/10 backdrop-blur-md hover:border-white/20 transition-all`}
          >
            {f.icon}
            <h3 className="text-2xl font-semibold mb-3">{f.title}</h3>
            <p className="text-gray-300">{f.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* ---------- STATS (replaces the removed how-it-works; animated counters) ---------- */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-xl backdrop-blur">
            <div className="text-sm uppercase tracking-widest text-blue-300 mb-2">
              Games Analyzed
            </div>
            <Counter
              from={0}
              to={125000}
              duration={2.2}
              className="text-4xl font-extrabold text-blue-400"
            />
            <p className="text-gray-400 mt-2 text-sm">and counting</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-xl backdrop-blur">
            <div className="text-sm uppercase tracking-widest text-emerald-300 mb-2">
              Personalized Picks Served
            </div>
            <Counter
              from={0}
              to={68000}
              duration={2.4}
              className="text-4xl font-extrabold text-emerald-400"
            />
            <p className="text-gray-400 mt-2 text-sm">curated by taste</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-xl backdrop-blur">
            <div className="text-sm uppercase tracking-widest text-pink-300 mb-2">
              Backlogs Roasted
            </div>
            <Counter
              from={0}
              to={42000}
              duration={2.6}
              className="text-4xl font-extrabold text-pink-400"
            />
            <p className="text-gray-400 mt-2 text-sm">mercilessly</p>
          </div>
        </div>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      <section className="py-20 px-6 max-w-6xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-12">Gamers Love SteamPicker</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              name: "Piaggio Ape",
              text:
                "Finally a way to discover Steam sales that actually fit me. This site saved me money and time.",
            },
            {
              name: "nums",
              text:
                "The flex cards are hilarious. Got roasted for my 200 games never played—worth it.",
            },
            {
              name: "Dosaluver",
              text:
                "Open source and private? I trust this more than anything else in the gaming space.",
            },
          ].map((t, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.03 }}
              className="bg-white/5 backdrop-blur rounded-xl p-6 shadow-lg border border-white/10 hover:border-white/20 transition-all"
            >
              <h3 className="text-xl font-semibold text-blue-300 mb-3">
                @{t.name}
              </h3>
              <p className="text-gray-300 italic">“{t.text}”</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- OPEN SOURCE BANNER ---------- */}
      <section className="py-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30 bg-gradient-to-r from-blue-600/40 via-purple-600/40 to-pink-600/40 blur-2xl" />
        <h2 className="text-3xl font-bold text-white mb-4">Free & Open Source</h2>
        <p className="text-gray-200 max-w-2xl mx-auto mb-8">
          Built by gamers, for gamers. No ads. No tracking. No stored data.
          SteamPicker is open, transparent, and community-driven.
        </p>
        <a
          href="https://github.com/"
          target="_blank"
          className="px-10 py-4 text-lg rounded-xl font-bold bg-white text-black hover:bg-gray-200 transition inline-flex items-center gap-3"
        >
          <FaGithub /> View on GitHub
        </a>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="py-14 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12 text-center md:text-left">
          <div>
            <h3 className="text-lg font-semibold mb-4">SteamPicker</h3>
            <p className="text-gray-400 text-sm">
              Your Steam, curated. Discover games shaped around you—trending,
              discounted, unforgettable. Open source. Private by design.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Links</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a href="#" className="hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  GitHub
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Privacy
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Credits</h3>
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} SteamPicker — Built by Plazor & Mai
            </p>
          </div>
        </div>
      </footer>

      {/* ---------- Local keyframes (no config edits needed) ---------- */}
      <style jsx global>{`
        @keyframes float-slow {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(30px, -20px, 0) scale(1.05);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes float-slower {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(-40px, 25px, 0) scale(1.04);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes grid-pan {
          0% {
            background-position: 0px 0px;
          }
          100% {
            background-position: 40px 40px;
          }
        }
      `}</style>
    </main>
  );
}
