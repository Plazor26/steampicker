// src/app/profile/[steamId]/page.tsx
"use client";

import React, { useEffect, useMemo, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { prescreen, type CandidateGame } from "@/lib/prescreener";
import { FaSteam, FaArrowLeft, FaExternalLinkAlt } from "react-icons/fa";
import BackgroundEffects from "@/components/BackgroundEffects";
import { Analytics } from "@vercel/analytics/next";

/* ─── Types ─── */
type Profile = {
  personaName: string | null;
  avatar: string | null;
  profileUrl: string | null;
  country: string | null;
  visibility: number | null;
};
type GameLite = {
  appid: number;
  name: string;
  header: string;
  hours: number;
  hours2w?: number;
};
type Library = {
  totalGames: number | null;
  totalMinutes: number | null;
  neverPlayed: number | null;
  recentGames: GameLite[];
  topGames: GameLite[];
  ownedGames: { appid: number }[];
  allGames?: GameLite[];
};
type ApiOk = { ok: true; isPrivate: boolean; profile: Profile; library: Library };
type ApiErr = { ok: false; error: string };
type ApiResponse = ApiOk | ApiErr;

export const dynamic = "force-dynamic";

/* ─── Helpers ─── */
function guessCCFromNavigator(): string | null {
  if (typeof navigator === "undefined") return null;
  const loc = Intl.DateTimeFormat().resolvedOptions().locale || (navigator as any).language || "";
  const part = String(loc).split("-")[1];
  return part && part.length === 2 ? part.toUpperCase() : null;
}

async function detectCCFromIP(): Promise<string | null> {
  try {
    const r = await fetch("https://ipapi.co/country/", { cache: "no-store" });
    if (!r.ok) return null;
    const code = (await r.text()).trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch { return null; }
}
function headerURL(appid: number) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
}
function fmt(n: number | null | undefined) { return n == null ? "—" : n.toLocaleString(); }
function fmtHours(minutes: number | null | undefined) { return minutes == null ? "—" : `${(minutes / 60).toFixed(1)} h`; }

function normalizeCatalog(cat: any): Array<{
  appid: number; name: string; header?: string;
  price_cents?: number; discount_pct?: number; currencyCode?: string;
}> {
  if (!cat) return [];
  if (Array.isArray(cat)) return normalizeCatalog({ items: cat });
  let arr = cat.candidates ?? cat.items ?? cat.games ?? cat.data ?? cat.list ??
    cat.response?.items ?? cat.response?.candidates ?? null;
  if (!Array.isArray(arr) || !arr.length) {
    if (Array.isArray(cat?.featured?.items)) arr = cat.featured.items;
    else if (Array.isArray(cat?.specials?.items)) arr = cat.specials.items;
    else if (Array.isArray(cat?.topsellers?.items)) arr = cat.topsellers.items;
  }
  if (!Array.isArray(arr) || !arr.length) {
    const flat: any[] = [];
    for (const k of Object.keys(cat)) {
      const v = (cat as any)[k];
      if (Array.isArray(v)) flat.push(...v);
      else if (v && typeof v === "object") {
        for (const kk of Object.keys(v)) {
          const vv = (v as any)[kk];
          if (Array.isArray(vv)) flat.push(...vv);
        }
      }
    }
    arr = flat;
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((c: any) => {
    const appid = c.appid ?? c.id ?? c.app_id ?? c.appID ?? c.appId ?? null;
    if (!Number.isFinite(appid)) return null;
    const price_cents = typeof c.price_cents === "number" ? c.price_cents
      : typeof c.final_price === "number" ? c.final_price
      : typeof c.price === "number" ? c.price : undefined;
    return {
      appid, name: c.name ?? c.title ?? `App ${appid}`,
      header: c.header ?? c.header_image ?? c.capsule_image ?? headerURL(appid),
      price_cents, discount_pct: c.discount_pct ?? c.discount_percent ?? c.discount ?? 0,
      currencyCode: c.currencyCode ?? c.currency ?? undefined,
    };
  }).filter(Boolean) as any[];
}

async function fetchCatalog(cc: string | null) {
  const tries = [
    `/api/steam/catalog?${new URLSearchParams({ ...(cc ? { cc } : {}), limit: "300" }).toString()}`,
    `/api/steam/catalog?${new URLSearchParams({ ...(cc ? { cc } : {}) }).toString()}`,
    `/api/steam/catalog`,
  ];
  for (const url of tries) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      const items = normalizeCatalog(j);
      if (Array.isArray(items) && items.length) return items;
    } catch {}
  }
  return [] as ReturnType<typeof normalizeCatalog>;
}

/* ─── Animation variants ─── */
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

/* ─── Sub-components ─── */
function StatPill({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 backdrop-blur-sm text-center relative overflow-hidden group"
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${color} rounded-2xl`} />
      <div className="relative z-10">
        <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">{label}</div>
        <div className="text-2xl font-extrabold text-white">{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
    </motion.div>
  );
}

function GameCard({ game, show2w = false, badge }: { game: GameLite; show2w?: boolean; badge?: React.ReactNode }) {
  return (
    <motion.a
      variants={fadeUp}
      href={`https://store.steampowered.com/app/${game.appid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm hover:border-white/20 hover:bg-white/[0.06] transition-all duration-200"
      whileHover={{ y: -3 }}
    >
      <div className="relative w-full aspect-[460/215] bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.header}
          alt={game.name}
          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-200"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {badge && <div className="absolute top-2 left-2 flex gap-1.5">{badge}</div>}
      </div>
      <div className="p-4">
        <div className="font-semibold text-sm text-white truncate mb-1">{game.name}</div>
        <div className="text-xs text-gray-500">
          {show2w && (game.hours2w ?? 0) > 0
            ? `${game.hours2w} h lately · ${game.hours} h total`
            : `${game.hours} h total`}
        </div>
      </div>
    </motion.a>
  );
}

function RecCard({ game }: { game: any }) {
  return (
    <motion.a
      variants={fadeUp}
      href={`https://store.steampowered.com/app/${game.appid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm hover:border-blue-500/30 hover:bg-white/[0.06] transition-all duration-200"
      whileHover={{ y: -3 }}
    >
      <div className="relative w-full aspect-[460/215] bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.header}
          alt={game.name}
          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-200"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-2 left-2 flex gap-1.5">
          {typeof game.score === "number" && (
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-600/90 text-white backdrop-blur-sm">
              {Math.round(game.score * 100)}% match
            </span>
          )}
          {game.discount_pct > 0 && (
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-600/90 text-white backdrop-blur-sm">
              -{game.discount_pct}%
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="font-semibold text-sm text-white truncate mb-1">{game.name}</div>
        <div className="text-xs text-gray-500 flex items-center justify-between">
          <span>
            {typeof game.price_cents === "number" && game.currencyCode
              ? new Intl.NumberFormat(undefined, { style: "currency", currency: game.currencyCode }).format(game.price_cents / 100)
              : typeof game.price_cents === "number"
                ? `$${(game.price_cents / 100).toFixed(2)}`
                : "View on store"}
          </span>
          <FaExternalLinkAlt size={10} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
        </div>
        {game.matchReasons?.length > 0 && (
          <div className="text-xs text-blue-400/60 mt-1.5 truncate">{game.matchReasons.join(" · ")}</div>
        )}
      </div>
    </motion.a>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-black/70 border border-white/10 text-gray-300 backdrop-blur-sm">
      {children}
    </span>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${
        checked
          ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
          : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:border-white/20"
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-gray-400 text-xs font-semibold tracking-widest uppercase mb-3">
        {label}
      </div>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
    </div>
  );
}

function GenreSidebar({ genres, selected, onSelect }: {
  genres: string[];
  selected: string | null;
  onSelect: (g: string | null) => void;
}) {
  if (!genres.length) return null;
  return (
    <div className="w-40 flex-shrink-0 space-y-1">
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
          !selected
            ? "bg-blue-600/20 border border-blue-500/50 text-blue-300"
            : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
        }`}
      >
        All
      </button>
      {genres.map((g) => (
        <button
          key={g}
          onClick={() => onSelect(selected === g ? null : g)}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 truncate ${
            selected === g
              ? "bg-blue-600/20 border border-blue-500/50 text-blue-300"
              : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
          }`}
          title={g}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

/* ─── Page ─── */
export default function Page({ params }: { params: Promise<{ steamId: string }> }) {
  const { steamId } = use(params);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"hours" | "name" | "recent">("hours");
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [tagNeverPlayed, setTagNeverPlayed] = useState(false);
  const [tagUnder2h, setTagUnder2h] = useState(false);
  const [tagRecent, setTagRecent] = useState(false);
  const [minHours, setMinHours] = useState(0);
  const [acctValue, setAcctValue] = useState<{ value: number; currency: string } | null>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recErr, setRecErr] = useState<string | null>(null);
  const [detectedCC, setDetectedCC] = useState<string | null>(null);
  const [recGenres, setRecGenres] = useState<Record<number, string[]>>({});
  const [libGenres, setLibGenres] = useState<Record<number, string[]>>({});
  const [selectedRecGenre, setSelectedRecGenre] = useState<string | null>(null);
  const [selectedLibGenre, setSelectedLibGenre] = useState<string | null>(null);

  /* Fetch profile */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/steam/profile/${steamId}`, { cache: "no-store" });
        const j: ApiResponse = await res.json();
        if (!alive) return;
        if (!res.ok || !("ok" in j) || !j.ok) setErr((j as any)?.error || `Failed (${res.status})`);
        setData(j);
      } catch (e: any) { if (!alive) return; setErr(e?.message || "Unable to load this profile."); }
    })();
    return () => { alive = false; };
  }, [steamId]);

  /* Detect country from IP (non-invasive) */
  useEffect(() => {
    let alive = true;
    (async () => {
      const cc = guessCCFromNavigator() || await detectCCFromIP();
      if (alive && cc) setDetectedCC(cc);
    })();
    return () => { alive = false; };
  }, []);

  /* Fetch account value */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cc = profile?.country || detectedCC || guessCCFromNavigator();
        const r = await fetch(`/api/steam/value/${steamId}${cc ? `?cc=${cc}` : ""}`, { cache: "no-store" });
        if (!alive || !r.ok) return;
        const j = await r.json().catch(() => null);
        if (j?.ok && typeof j.value === "number") {
          const formatted = j.currencyCode
            ? new Intl.NumberFormat(undefined, { style: "currency", currency: j.currencyCode }).format(j.value)
            : `${j.currency ?? ""} ${j.value.toLocaleString()}`;
          setAcctValue({ value: j.value, currency: formatted });
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [steamId, detectedCC]);

  /* Derived */
  const isOk = !!data && "ok" in data && data.ok;
  const profile: Profile | null = isOk ? (data as ApiOk).profile : null;
  const lib: Library | null = isOk ? (data as ApiOk).library : null;
  const ownedSet = useMemo(() => new Set((lib?.ownedGames || []).map((g) => g.appid)), [lib]);

  const allGames: GameLite[] = useMemo(() => {
    const base = lib?.allGames?.length ? lib.allGames : [...(lib?.recentGames || []), ...(lib?.topGames || [])];
    const seen = new Set<number>();
    return base.filter((g) => { if (seen.has(g.appid)) return false; seen.add(g.appid); return true; });
  }, [lib]);

  const filtered = useMemo(() => {
    let list = allGames;
    if (ownedOnly) list = list.filter((g) => ownedSet.has(g.appid));
    if (query.trim()) { const q = query.trim().toLowerCase(); list = list.filter((g) => g.name.toLowerCase().includes(q)); }
    if (minHours > 0) list = list.filter((g) => g.hours >= minHours);
    if (tagNeverPlayed) list = list.filter((g) => g.hours <= 0);
    if (tagUnder2h) list = list.filter((g) => g.hours > 0 && g.hours < 2);
    if (tagRecent) list = list.filter((g) => (g.hours2w ?? 0) > 0);
    if (selectedLibGenre) list = list.filter((g) => (libGenres[g.appid] || []).includes(selectedLibGenre));
    switch (sortBy) {
      case "name": list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case "recent": list = [...list].sort((a, b) => (b.hours2w ?? 0) - (a.hours2w ?? 0)); break;
      default: list = [...list].sort((a, b) => b.hours - a.hours);
    }
    return list;
  }, [allGames, ownedOnly, query, minHours, tagNeverPlayed, tagUnder2h, tagRecent, sortBy, ownedSet, selectedLibGenre, libGenres]);

  /* Filtered recs by genre */
  const filteredRecs = useMemo(() => {
    if (!selectedRecGenre) return recs;
    return recs.filter((g: any) => (recGenres[g.appid] || []).includes(selectedRecGenre));
  }, [recs, selectedRecGenre, recGenres]);

  /* Extract unique genres sorted by frequency */
  const recGenreList = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const genres of Object.values(recGenres)) {
      for (const g of genres) counts[g] = (counts[g] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [recGenres]);

  const libGenreList = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const genres of Object.values(libGenres)) {
      for (const g of genres) counts[g] = (counts[g] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [libGenres]);

  /* Recommendations */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!lib?.allGames?.length) { setRecs([]); return; }
      setLoadingRecs(true); setRecErr(null);
      try {
        const cc = profile?.country || detectedCC || guessCCFromNavigator();
        const catalogItems = await fetchCatalog(cc);
        const ownedAppIds = new Set((lib.ownedGames || []).map((g) => g.appid));
        const candidates: CandidateGame[] = catalogItems
          .filter((c) => !ownedAppIds.has(c.appid))
          .map((c) => ({ appid: c.appid, name: c.name, header: c.header || headerURL(c.appid), price_cents: c.price_cents ?? null, discount_pct: c.discount_pct ?? 0 }));
        const results = await prescreen(lib.allGames as GameLite[], candidates, 30);
        if (!alive) return;
        setRecs(results);
        // Enrich recs to get genres
        if (results.length) {
          try {
            const enrichRes = await fetch("/api/steam/enrich", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appids: results.map((r: any) => r.appid) }),
            });
            const enrichData = await enrichRes.json();
            if (alive && enrichData?.ok) {
              const genres: Record<number, string[]> = {};
              for (const [id, info] of Object.entries(enrichData.items)) {
                genres[Number(id)] = (info as any).genres || [];
              }
              setRecGenres(genres);
            }
          } catch {}
        }
      } catch (e: any) { if (!alive) return; setRecErr(e?.message || "Failed to build recommendations."); }
      finally { if (alive) setLoadingRecs(false); }
    })();
    return () => { alive = false; };
  }, [lib, profile, detectedCC]);

  /* Enrich library games for genre filters (background, batched) */
  useEffect(() => {
    if (!allGames.length) return;
    let alive = true;
    (async () => {
      // Batch in chunks of 50 to avoid overwhelming the API
      const BATCH = 50;
      const genreMap: Record<number, string[]> = {};
      for (let i = 0; i < allGames.length && alive; i += BATCH) {
        const batch = allGames.slice(i, i + BATCH).map(g => g.appid);
        try {
          const r = await fetch("/api/steam/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appids: batch }),
          });
          const d = await r.json();
          if (d?.ok) {
            for (const [id, info] of Object.entries(d.items)) {
              genreMap[Number(id)] = (info as any).genres || [];
            }
            if (alive) setLibGenres(prev => ({ ...prev, ...genreMap }));
          }
        } catch {}
      }
    })();
    return () => { alive = false; };
  }, [allGames]);

  const loading = !data && !err;
  const errorMsg = !isOk ? err || (data as ApiErr | null)?.error || null : null;

  return (
    <main className="relative min-h-screen text-gray-100 overflow-x-hidden">
      <Analytics />

      <BackgroundEffects />
      <div className="relative z-10">

      {/* Nav bar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050a14]/80 backdrop-blur-xl px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors">
            <FaArrowLeft size={12} />
            <FaSteam className="text-blue-400" />
            <span>SteamPicker</span>
          </Link>
          {profile?.personaName && (
            <span className="text-xs text-gray-500 font-mono">{steamId}</span>
          )}
        </div>
      </nav>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center justify-center min-h-[80vh]"
          >
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Loading Steam profile…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {!loading && errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center min-h-[80vh] p-6"
        >
          <div className="max-w-md text-center rounded-2xl bg-white/[0.04] border border-white/[0.08] p-10 backdrop-blur-sm">
            <div className="text-4xl mb-4">😶‍🌫️</div>
            <h1 className="text-xl font-bold text-white mb-2">Couldn't load profile</h1>
            <p className="text-gray-400 text-sm mb-6">{errorMsg}</p>
            <Link href="/" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm inline-block transition-colors">
              Back to Home
            </Link>
          </div>
        </motion.div>
      )}

      {/* Main content */}
      {!loading && isOk && (
        <div className="max-w-6xl mx-auto px-6 pb-24">

          {/* ── Profile header ── */}
          <motion.section
            initial="hidden" animate="show" variants={stagger}
            className="pt-12 pb-10"
          >
            <motion.div variants={fadeUp}
              className="relative rounded-3xl bg-white/[0.03] border border-white/[0.08] p-8 md:p-10 backdrop-blur-sm overflow-hidden"
            >
              {/* Glow behind avatar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/10 blur-3xl -z-10" />

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {profile?.avatar ? (
                    <Image
                      src={profile.avatar}
                      alt={profile?.personaName ?? "Avatar"}
                      width={96} height={96}
                      className="rounded-2xl border border-white/10 shadow-xl"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-white/[0.06] border border-white/10" />
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#050a14]" />
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-3xl font-black text-white mb-1">
                    {profile?.personaName ?? "Unknown Player"}
                  </h1>
                  <p className="text-gray-500 text-xs font-mono mb-4">steamid: {steamId}</p>
                  {(data as ApiOk).isPrivate && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
                      🔒 Private library — showing public info only
                    </div>
                  )}
                  {profile?.profileUrl && (
                    <a
                      href={profile.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-sm font-semibold text-gray-300 hover:text-white transition-all"
                    >
                      <FaSteam size={14} className="text-blue-400" />
                      View on Steam
                      <FaExternalLinkAlt size={10} className="text-gray-500" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.section>

          {/* ── Stats ── */}
          <motion.section
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={stagger} className="pb-16"
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatPill label="Total Games" value={fmt(lib?.totalGames)} color="from-blue-500/10 to-transparent" />
              <StatPill label="Playtime" value={fmtHours(lib?.totalMinutes)} sub="lifetime" color="from-emerald-500/10 to-transparent" />
              <StatPill label="Never Played" value={fmt(lib?.neverPlayed)} sub="in library" color="from-pink-500/10 to-transparent" />
              <StatPill
                label="Visibility"
                value={profile?.visibility === 3 ? "Public" : profile?.visibility === 1 ? "Private" : "?"}
                color="from-violet-500/10 to-transparent"
              />
              <StatPill
                label="Library Value"
                value={acctValue ? acctValue.currency : "—"}
                sub={acctValue ? "estimated" : undefined}
                color="from-cyan-500/10 to-transparent"
              />
            </div>
          </motion.section>

          {/* ── Recently Played ── */}
          {!!lib?.recentGames?.length && (
            <section className="pb-16">
              <SectionHeader label="Activity" title="Recently Played" />
              <motion.div
                initial="hidden" whileInView="show" viewport={{ once: true }}
                variants={stagger}
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {lib.recentGames.filter((g) => ownedSet.has(g.appid)).map((g) => (
                  <GameCard key={g.appid} game={g} show2w />
                ))}
              </motion.div>
            </section>
          )}

          {/* ── Recommendations ── */}
          <section className="pb-16">
            <SectionHeader label="AI Picks" title="Recommended for You" />

            {loadingRecs && (
              <div className="flex items-center gap-3 text-gray-400 text-sm">
                <div className="w-4 h-4 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin" />
                Crunching the catalog…
              </div>
            )}
            {recErr && <p className="text-red-400 text-sm">{recErr}</p>}

            {!loadingRecs && !recErr && (
              <div className="flex gap-6">
                <GenreSidebar genres={recGenreList} selected={selectedRecGenre} onSelect={setSelectedRecGenre} />
                <motion.div
                  initial="hidden" animate="show" variants={stagger}
                  className="flex-1 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {filteredRecs.map((g: any) => <RecCard key={g.appid} game={g} />)}
                  {!filteredRecs.length && (
                    <p className="text-gray-500 text-sm col-span-full">
                      {selectedRecGenre
                        ? `No recommendations in "${selectedRecGenre}".`
                        : "No recommendations yet — your library may be empty or private."}
                    </p>
                  )}
                </motion.div>
              </div>
            )}
          </section>

          {/* ── All Games browser ── */}
          <section className="pb-16">
            <SectionHeader label="Library" title="All Games" />

            {/* Filter bar */}
            <div className="sticky top-[61px] z-40 rounded-2xl bg-[#050a14]/90 border border-white/[0.08] backdrop-blur-xl p-4 mb-6">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  placeholder="Search games…"
                  className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors w-44"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-gray-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="hours">Most played</option>
                  <option value="recent">Recently played</option>
                  <option value="name">A – Z</option>
                </select>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Min hrs</span>
                  <input type="range" min={0} max={200} value={minHours}
                    onChange={(e) => setMinHours(Number(e.target.value))} className="w-24 accent-blue-500" />
                  <span className="font-mono w-6">{minHours}</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-auto">
                  <Toggle label="Owned" checked={ownedOnly} onChange={setOwnedOnly} />
                  <Toggle label="Never played" checked={tagNeverPlayed} onChange={setTagNeverPlayed} />
                  <Toggle label="Under 2h" checked={tagUnder2h} onChange={setTagUnder2h} />
                  <Toggle label="Recent" checked={tagRecent} onChange={setTagRecent} />
                </div>
              </div>
            </div>

            {/* Sidebar + Game grid */}
            <div className="flex gap-6">
              <GenreSidebar genres={libGenreList} selected={selectedLibGenre} onSelect={setSelectedLibGenre} />
              <div className="flex-1 max-h-[72vh] overflow-y-auto pr-1 rounded-xl">
                <motion.div
                  initial="hidden" animate="show" variants={stagger}
                  className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {filtered.map((g) => (
                    <GameCard key={g.appid} game={g}
                      badge={<>
                        {g.hours <= 0 && <Badge>Never played</Badge>}
                        {g.hours > 0 && g.hours < 2 && <Badge>Under 2h</Badge>}
                        {(g.hours2w ?? 0) > 0 && <Badge>Recent</Badge>}
                      </>}
                    />
                  ))}
                  {!filtered.length && (
                    <p className="text-gray-500 text-sm col-span-full">No games match your filters.</p>
                  )}
                </motion.div>
              </div>
            </div>
          </section>
        </div>
      )}

      </div>{/* end z-10 wrapper */}
    </main>
  );
}
