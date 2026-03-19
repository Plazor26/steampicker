"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RoastCard from "./RoastCard";
import type { RoastResult } from "@/lib/roast";
import { FaDownload, FaCopy, FaTimes, FaCheck, FaTwitter, FaRedditAlien, FaDiscord } from "react-icons/fa";
import { SiBluesky } from "react-icons/si";

type ShameGame = { appid: number; name: string; hours: number };

type Props = {
  open: boolean;
  onClose: () => void;
  personaName: string;
  avatarUrl: string | null;
  totalGames: number;
  totalHours: number;
  neverPlayed: number;
  libraryValue: string;
  libraryValueNum: number;
  currencySymbol: string;
  topGames: { name: string; hours: number }[];
  recentGames: ShameGame[];
  roast: RoastResult;
};

export default function RoastCardModal({
  open, onClose, personaName, avatarUrl, totalGames, totalHours,
  neverPlayed, libraryValue, libraryValueNum, currencySymbol, topGames, recentGames, roast,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shameAppId, setShameAppId] = useState<number | null>(null);
  const [scale, setScale] = useState(0.6);

  const shameGame = recentGames.find(g => g.appid === shameAppId) ?? null;
  const shameImageUrl = shameAppId
    ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${shameAppId}/header.jpg`
    : null;

  // Fit the 1200px card into the container
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.65, 700);
      setScale(size / 800);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  const capture = useCallback(async () => {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    // html2canvas can't parse Tailwind CSS 4's lab() color functions.
    // Clone the card into a detached container with no stylesheets so html2canvas
    // only sees inline styles (which use hex/rgba, not lab()).
    const clone = cardRef.current.cloneNode(true) as HTMLElement;
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";
    container.appendChild(clone);
    document.body.appendChild(container);
    try {
      return await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#050a14",
      });
    } finally {
      document.body.removeChild(container);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    setSaving(true);
    try {
      const canvas = await capture();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `${personaName.replace(/[^a-zA-Z0-9]/g, "_")}_roast.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Download failed:", e);
    } finally { setSaving(false); }
  }, [capture, personaName]);

  const handleCopy = useCallback(async () => {
    try {
      const canvas = await capture();
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }, "image/png");
    } catch {}
  }, [capture]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center my-8"
            style={{ width: Math.round(800 * scale) }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <FaTimes size={12} />
            </button>

            {/* Card — exactly fills the modal width */}
            <div
              ref={wrapperRef}
              className="rounded-2xl border border-white/[0.08] shadow-2xl mb-4 overflow-hidden"
              style={{ width: Math.round(800 * scale), height: Math.round(800 * scale) }}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 800, height: 800 }}>
                <RoastCard
                  ref={cardRef}
                  personaName={personaName}
                  avatarUrl={avatarUrl}
                  totalGames={totalGames}
                  totalHours={totalHours}
                  neverPlayed={neverPlayed}
                  libraryValue={libraryValue}
                  libraryValueNum={libraryValueNum}
                  currencySymbol={currencySymbol}
                  topGames={topGames}
                  roast={roast}
                  shameGame={shameGame ? { name: shameGame.name, hours: shameGame.hours, imageUrl: shameImageUrl! } : null}
                />
              </div>
            </div>

            {/* Game of Shame selector */}
            {recentGames.length > 0 && (
              <div className="mb-4 w-full">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">Game of Shame (optional)</div>
                <div className="flex gap-2 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                  <button
                    onClick={() => setShameAppId(null)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      !shameAppId ? "bg-blue-600/20 border-blue-500/50 text-blue-300" : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white"
                    }`}
                  >
                    None
                  </button>
                  {recentGames.map(g => (
                    <button
                      key={g.appid}
                      onClick={() => setShameAppId(g.appid === shameAppId ? null : g.appid)}
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        shameAppId === g.appid ? "bg-orange-600/20 border-orange-500/50 text-orange-300" : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`}
                        alt="" className="w-8 h-4 rounded object-cover" loading="lazy"
                      />
                      <span className="whitespace-nowrap">{g.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={handleDownload}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-60"
              >
                <FaDownload size={13} />
                {saving ? "Saving…" : "Download"}
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-gray-300 font-semibold text-sm transition-colors"
              >
                {copied ? <><FaCheck size={13} className="text-green-400" /> Copied!</> : <><FaCopy size={13} /> Copy</>}
              </button>

              <div className="w-px h-6 bg-white/[0.08] mx-1 hidden sm:block" />

              {/* Share links */}
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`My Steam profile got roasted: "${roast.headline}" — Grade: ${roast.grade} (${roast.rating})\n\nGet roasted at steampicker.plazor.xyz`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-400 hover:text-white text-sm font-semibold transition-colors"
              >
                <FaTwitter size={14} /> X
              </a>
              <a
                href={`https://bsky.app/intent/compose?text=${encodeURIComponent(`My Steam profile got roasted: "${roast.headline}" — Grade: ${roast.grade} (${roast.rating})\n\nGet roasted at steampicker.plazor.xyz`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-400 hover:text-white text-sm font-semibold transition-colors"
              >
                <SiBluesky size={14} /> Bsky
              </a>
              <a
                href={`https://reddit.com/submit?title=${encodeURIComponent(`My Steam profile got roasted: "${roast.headline}" (Grade: ${roast.grade})`)}&url=${encodeURIComponent("https://steampicker.plazor.xyz")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-400 hover:text-white text-sm font-semibold transition-colors"
              >
                <FaRedditAlien size={14} /> Reddit
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
