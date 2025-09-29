"use client";

import React, { useEffect, useMemo, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { prescreen } from "@/lib/prescreener";

/* ---------- Types returned by /api/steam/profile/[steamId] ---------- */
type Profile = {
  personaName: string | null;
  avatar: string | null;
  profileUrl: string | null;
  visibility: number | null; // 3 public, 1 private
};
type GameLite = {
  appid: number;
  name: string;
  header: string;
  hours: number; // lifetime hours
  hours2w?: number; // last 2 weeks hours
};
type Library = {
  totalGames: number | null;
  totalMinutes: number | null; // lifetime minutes
  neverPlayed: number | null;
  recentGames: GameLite[];
  topGames: GameLite[]; // kept in type, but we won't render this section anymore
  ownedGames: { appid: number }[];
  allGames?: GameLite[];
};
type ApiOk = { ok: true; isPrivate: boolean; profile: Profile; library: Library };
type ApiErr = { ok: false; error: string };
type ApiResponse = ApiOk | ApiErr;

export const dynamic = "force-dynamic";

/* ---------- Helpers ---------- */
function guessCCFromNavigator(): string | null {
  if (typeof navigator === "undefined") return null;
  const loc = Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || "";
  const part = loc.split("-")[1];
  return part && part.length === 2 ? part.toUpperCase() : null;
}

export default function Page({
  params,
}: {
  // Next 15: params is a Promise in client components, unwrap via React.use()
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = use(params);

  /* ---------- state ---------- */
  const [ready, setReady] = useState(false); // particles ready
  const [data, setData] = useState<ApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Filters (All Games browser)
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"hours" | "name" | "recent">("hours");
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [tagNeverPlayed, setTagNeverPlayed] = useState(false);
  const [tagUnder2h, setTagUnder2h] = useState(false);
  const [tagRecent, setTagRecent] = useState(false);
  const [minHours, setMinHours] = useState(0);

  // “account value”
  const [acctValue, setAcctValue] = useState<{ value: number; currency: string } | null>(null);

  // Recommendations (math-based prescreener)
  const [recs, setRecs] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recErr, setRecErr] = useState<string | null>(null);

  /* ---------- Particles ---------- */
  useEffect(() => {
    initParticlesEngine(loadFull).then(() => setReady(true));
  }, []);

  /* ---------- Fetch profile ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/steam/profile/${steamId}`, { cache: "no-store" });
        const j: ApiResponse = await res.json();
        if (!alive) return;
        if (!res.ok || !("ok" in j) || !j.ok) setErr((j as any)?.error || `Failed (${res.status})`);
        setData(j);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Unable to load this profile.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [steamId]);

  /* ---------- Load estimated account value (region aware) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cc = guessCCFromNavigator();
        const r = await fetch(`/api/steam/value/${steamId}${cc ? `?cc=${cc}` : ""}`, {
          cache: "no-store",
        });
        if (!alive || !r.ok) return; // ignore if route not implemented
        const j = await r.json().catch(() => null);
        if (j?.ok && typeof j.value === "number") {
          const formatted =
            j.currencyCode
              ? new Intl.NumberFormat(undefined, { style: "currency", currency: j.currencyCode }).format(j.value)
              : `${j.currency ?? ""} ${j.value.toLocaleString()}`;
          setAcctValue({ value: j.value, currency: formatted });
        }
      } catch {
        /* optional feature, ignore errors */
      }
    })();
    return () => {
      alive = false;
    };
  }, [steamId]);

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

  /* ---------- Derived values (hooks stay unconditional) ---------- */
  const isOk = !!data && "ok" in data && data.ok;
  const profile: Profile | null = isOk ? (data as ApiOk).profile : null;
  const lib: Library | null = isOk ? (data as ApiOk).library : null;
  const ownedSet = useMemo(() => new Set((lib?.ownedGames || []).map((g) => g.appid)), [lib]);

  // Base list
  const allGames: GameLite[] = useMemo(() => {
    const base =
      lib?.allGames && lib.allGames.length > 0
        ? lib.allGames
        : [...(lib?.recentGames || []), ...(lib?.topGames || [])];
    const seen = new Set<number>();
    const dedup: GameLite[] = [];
    for (const g of base) {
      if (!seen.has(g.appid)) {
        seen.add(g.appid);
        dedup.push(g);
      }
    }
    return dedup;
  }, [lib]);

  // Filters
  const filtered = useMemo(() => {
    let list = allGames;
    if (ownedOnly) list = list.filter((g) => ownedSet.has(g.appid));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    if (minHours > 0) list = list.filter((g) => g.hours >= minHours);
    if (tagNeverPlayed) list = list.filter((g) => g.hours <= 0);
    if (tagUnder2h) list = list.filter((g) => g.hours > 0 && g.hours < 2);
    if (tagRecent) list = list.filter((g) => (g.hours2w ?? 0) > 0);

    switch (sortBy) {
      case "name":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "recent":
        list = [...list].sort((a, b) => (b.hours2w ?? 0) - (a.hours2w ?? 0));
        break;
      case "hours":
      default:
        list = [...list].sort((a, b) => b.hours - a.hours);
        break;
    }
    return list;
  }, [allGames, ownedOnly, query, minHours, tagNeverPlayed, tagUnder2h, tagRecent, sortBy, ownedSet]);

  /* ---------- Recommendations (catalog -> exclude owned -> prescreen/fallback) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!lib?.allGames?.length) {
        setRecs([]);
        return;
      }
      setLoadingRecs(true);
      setRecErr(null);
      try {
        const cc = guessCCFromNavigator();
        const catRes = await fetch(`/api/steam/catalog${cc ? `?cc=${cc}` : ""}`, { cache: "no-store" });
        const cat = await catRes.json().catch(() => null);
        let candidates: any[] = Array.isArray(cat?.candidates) ? cat.candidates : [];

        // Ensure header fallback
        candidates = candidates.map((c) => ({
          ...c,
          header:
            c.header ||
            `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${c.appid}/header.jpg`,
        }));

        // Exclude owned
        candidates = candidates.filter((c) => !ownedSet.has(c.appid));

        let shortlist: any[] = [];
        try {
          // Try prescreen if it supports candidates; if it throws, we fall back
          const maybe = await (prescreen as any)(
            { allGames: lib.allGames as GameLite[], favoriteGenres: [], favoriteCategories: [] },
            60,
            candidates
          );
          if (Array.isArray(maybe) && maybe.length) shortlist = maybe;
        } catch {
          // ignore; fallback below
        }

        if (!shortlist.length) {
          // Fallback: discount desc, then cheaper first, then name
          shortlist = [...candidates]
            .sort((a, b) => {
              const d = (b.discount_pct || 0) - (a.discount_pct || 0);
              if (d) return d;
              const ap = a.price_cents ?? Number.MAX_SAFE_INTEGER;
              const bp = b.price_cents ?? Number.MAX_SAFE_INTEGER;
              if (ap !== bp) return ap - bp;
              return String(a.name).localeCompare(String(b.name));
            })
            .slice(0, 60)
            .map((c, i) => ({ ...c, score: (c.discount_pct || 0) / 100 || 0.01 * (60 - i) }));
        }

        if (!alive) return;
        // Safety filter (owned) + cap
        shortlist = shortlist.filter((g) => !ownedSet.has(g.appid)).slice(0, 30);
        setRecs(shortlist);
      } catch (e: any) {
        if (!alive) return;
        setRecErr(e?.message || "Failed to build recommendations.");
      } finally {
        if (alive) setLoadingRecs(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lib, ownedSet]);

  /* ---------- UI ---------- */
  const loading = !data && !err;
  const errorMsg = !isOk ? err || (data as ApiErr | null)?.error || null : null;

  return (
    <main className="relative min-h-screen text-gray-100 overflow-hidden">
      <Background ready={ready} particlesOptions={particlesOptions} />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center bg-white/5 border border-white/10 px-6 py-8 rounded-xl backdrop-blur">
            <div className="text-2xl font-semibold mb-2">Loading profile…</div>
            <div className="text-gray-400">Fetching Steam data</div>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && errorMsg && (
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="max-w-xl text-center bg-white/5 border border-white/10 p-8 rounded-xl backdrop-blur">
            <h1 className="text-3xl font-bold mb-4">Profile</h1>
            <p className="text-gray-300 mb-6">{errorMsg}</p>
            <Link href="/" className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold inline-block">
              Back to Home
            </Link>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && isOk && (
        <>
          {/* Header */}
          <section className="px-6 pt-16 pb-10 flex items-center justify-center">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 max-w-3xl w-full text-center backdrop-blur">
              <div className="flex items-center justify-center mb-6">
                {profile?.avatar ? (
                  <Image
                    src={profile.avatar}
                    alt={profile?.personaName ?? "Avatar"}
                    width={96}
                    height={96}
                    className="rounded-full border border-white/10 shadow"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white/10 border border-white/10" />
                )}
              </div>
              <h1 className="text-3xl font-extrabold mb-2">{profile?.personaName ?? "Unknown Player"}</h1>
              <p className="text-sm text-gray-400">
                SteamID: <span className="font-mono">{steamId}</span>
              </p>
              {profile?.profileUrl && (
                <div className="mt-6">
                  <a
                    href={profile.profileUrl}
                    target="_blank"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold inline-block"
                  >
                    View on Steam
                  </a>
                </div>
              )}
              {(data as ApiOk).isPrivate && (
                <p className="text-amber-300 mt-4">
                  This account’s game details are private. You can still view public summary info above.
                </p>
              )}
            </div>
          </section>

          {/* Stats (Account Value formatted) */}
          <section className="px-6 pb-10 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <Stat title="Total Games" value={fmt(lib?.totalGames)} accent="text-blue-300" />
              <Stat title="Total Playtime" value={fmtHours(lib?.totalMinutes)} sub="lifetime" accent="text-emerald-300" />
              <Stat title="Never Played" value={fmt(lib?.neverPlayed)} sub="in your library" accent="text-pink-300" />
              <Stat
                title="Visibility"
                value={profile?.visibility === 3 ? "Public" : profile?.visibility === 1 ? "Private" : "Unknown"}
                accent="text-violet-300"
              />
              <Stat
                title="Account Value"
                value={acctValue ? acctValue.currency : "—"}
                sub={acctValue ? "estimated" : undefined}
                accent="text-cyan-300"
              />
            </div>
          </section>

          {/* Recently Played */}
          {!!lib?.recentGames?.length && (
            <Section title="Recently Played">
              <GameRow games={lib.recentGames.filter((g) => ownedSet.has(g.appid))} show2w />
            </Section>
          )}

          {/* (Removed) Top Games by Playtime */}

          {/* RECOMMENDATIONS (beta) */}
          <section className="px-6 py-10 max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Recommendations (beta)</h2>

            {loadingRecs && <div className="text-gray-400">Crunching numbers…</div>}
            {recErr && <div className="text-red-300">{recErr}</div>}

            {!loadingRecs && !recErr && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {recs.map((g) => (
                  <a
                    key={g.appid}
                    href={`https://store.steampowered.com/app/${g.appid}`}
                    target="_blank"
                    className="group rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur hover:border-white/20 transition-colors"
                  >
                    <div className="relative w-full h-[140px] bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.header}
                        alt={g.name}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2 flex gap-2">
                        {typeof g.score === "number" && <Badge>{Math.round(g.score * 100)}%</Badge>}
                        {g.discount_pct ? <Badge>{g.discount_pct}% off</Badge> : null}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="font-semibold mb-1">{g.name}</div>
                      <div className="text-sm text-gray-400">
                        {/* Optional price display if available */}
                        {typeof g.price_cents === "number" ? (
                          <span>Price: {(g.price_cents / 100).toLocaleString()}</span>
                        ) : (
                          <span>View on store</span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
                {!recs.length && <div className="text-gray-400">No recommendations yet.</div>}
              </div>
            )}
          </section>

          {/* ALL GAMES – scrollable browser with filters */}
          <section className="px-6 py-10 max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">All Games</h2>

            {/* Filters bar */}
            <div className="sticky top-2 z-[1] bg-black/30 backdrop-blur rounded-xl border border-white/10 p-4 mb-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-center">
                <input
                  type="text"
                  placeholder="Search by name…"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none text-gray-100 placeholder:text-gray-400"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-300">Sort</label>
                  <select
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="hours">Playtime (desc)</option>
                    <option value="recent">Recent (2 weeks)</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-300 whitespace-nowrap">Min hours</label>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={minHours}
                    onChange={(e) => setMinHours(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-300 w-10 text-right">{minHours}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Toggle label="Owned only" checked={ownedOnly} onChange={setOwnedOnly} />
                  <Toggle label="Never played" checked={tagNeverPlayed} onChange={setTagNeverPlayed} />
                  <Toggle label="Under 2h" checked={tagUnder2h} onChange={setTagUnder2h} />
                  <Toggle label="Recently played" checked={tagRecent} onChange={setTagRecent} />
                </div>
              </div>
            </div>

            {/* Scrollable grid */}
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((g) => (
                  <a
                    key={g.appid}
                    href={`https://store.steampowered.com/app/${g.appid}`}
                    target="_blank"
                    className="group rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur hover:border-white/20 transition-colors"
                  >
                    <div className="relative w-full h-[140px] bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.header}
                        alt={g.name}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2 flex gap-2">
                        {g.hours <= 0 && <Badge>Never played</Badge>}
                        {g.hours > 0 && g.hours < 2 && <Badge>Under 2h</Badge>}
                        {(g.hours2w ?? 0) > 0 && <Badge>Recent</Badge>}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="font-semibold mb-1">{g.name}</div>
                      <div className="text-sm text-gray-400">
                        {`${g.hours} h total`}
                        {(g.hours2w ?? 0) > 0 ? ` • ${(g.hours2w ?? 0)} h in 2 weeks` : ""}
                      </div>
                    </div>
                  </a>
                ))}
                {!filtered.length && <div className="text-gray-400">No games match your filters.</div>}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Local keyframes to keep the background motion identical to the landing page */}
      <style jsx global>{`
        @keyframes float-slow {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(30px, -20px, 0) scale(1.05); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes float-slower {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-40px, 25px, 0) scale(1.04); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes grid-pan {
          0% { background-position: 0px 0px; }
          100% { background-position: 40px 40px; }
        }
      `}</style>
    </main>
  );
}

/* ---------- Background (shared look with landing page) ---------- */
function Background({
  ready,
  particlesOptions,
}: {
  ready: boolean;
  particlesOptions: any;
}) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute inset-0 opacity-[0.12] bg-[length:40px_40px] bg-[radial-gradient(circle,_rgba(255,255,255,0.14)_1px,_transparent_1px)] animate-[grid-pan_24s_linear_infinite]" />
        <div className="absolute -top-32 -left-32 w-[45rem] h-[45rem] rounded-full blur-3xl opacity-40 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.45),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(168,85,247,0.35),transparent_60%)] animate-[float-slow_22s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-16rem] right-[-16rem] w-[42rem] h-[42rem] rounded-full blur-3xl opacity-35 bg-[radial-gradient(circle_at_40%_40%,rgba(34,211,238,0.4),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.35),transparent_60%)] animate-[float-slower_28s_ease-in-out_infinite]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0b1220] via-[#0e1322] to-[#05070c]" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5))]" />
      {ready && <Particles id="tsparticles" options={particlesOptions} className="absolute inset-0 -z-10" />}
    </>
  );
}

/* ---------- UI bits ---------- */
function Stat({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur text-center">
      <div className={`text-xs uppercase tracking-widest ${accent ?? "text-gray-300"} mb-2`}>{title}</div>
      <div className="text-3xl font-extrabold">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-10 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      {children}
    </section>
  );
}

function GameRow({ games, show2w = false }: { games: GameLite[]; show2w?: boolean }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {games.map((g) => (
        <a
          key={g.appid}
          href={`https://store.steampowered.com/app/${g.appid}`}
          target="_blank"
          className="group rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur hover:border-white/20 transition-colors"
        >
          <div className="relative w-full h-[140px] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.header}
              alt={g.name}
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
              loading="lazy"
            />
          </div>
          <div className="p-4">
            <div className="font-semibold mb-1">{g.name}</div>
            <div className="text-sm text-gray-400">
              {show2w && typeof g.hours2w === "number"
                ? `${g.hours2w} h in 2 weeks • ${g.hours} h total`
                : `${g.hours} h total`}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-black/60 border border-white/10">{children}</span>;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" className="accent-blue-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

/* ---------- helpers ---------- */
function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}
function fmtHours(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  return `${(minutes / 60).toFixed(1)} h`;
}
