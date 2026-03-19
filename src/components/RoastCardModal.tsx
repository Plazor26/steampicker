"use client";

import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RoastCard from "./RoastCard";
import type { RoastResult } from "@/lib/roast";
import { FaDownload, FaCopy, FaTimes, FaCheck } from "react-icons/fa";

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
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shameAppId, setShameAppId] = useState<number | null>(null);

  const shameGame = recentGames.find(g => g.appid === shameAppId) ?? null;
  const shameImageUrl = shameAppId
    ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${shameAppId}/header.jpg`
    : null;

  const capture = useCallback(async () => {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#050a14",
    });
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
            className="relative z-10 max-w-[95vw] flex flex-col items-center my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <FaTimes size={12} />
            </button>

            {/* Card preview — scales to fit viewport */}
            <div className="rounded-2xl border border-white/[0.08] shadow-2xl mb-4 overflow-hidden" style={{ width: "min(90vw, 900px)", aspectRatio: "1200/630" }}>
              <div style={{ width: 1200, height: 630, transform: "scale(var(--card-scale))", transformOrigin: "top left", "--card-scale": "calc(min(90vw, 900px) / 1200)" } as React.CSSProperties}>
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
              <div className="mb-4 w-full max-w-[min(90vw,780px)]">
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
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-60"
              >
                <FaDownload size={14} />
                {saving ? "Saving…" : "Download PNG"}
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-gray-300 font-semibold text-sm transition-colors"
              >
                {copied ? <><FaCheck size={14} className="text-green-400" /> Copied!</> : <><FaCopy size={14} /> Copy to Clipboard</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
