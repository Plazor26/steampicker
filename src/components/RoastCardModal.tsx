"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RoastCard from "./RoastCard";
import type { RoastResult } from "@/lib/roast";
import { FaDownload, FaCopy, FaTimes, FaCheck, FaTwitter, FaRedditAlien, FaWhatsapp, FaInstagram, FaShareAlt } from "react-icons/fa";
import { SiBluesky } from "react-icons/si";

type ShameGame = { appid: number; name: string; hours: number };

type Props = {
  open: boolean;
  onClose: () => void;
  steamId: string;
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
  open, onClose, steamId, personaName, avatarUrl, totalGames, totalHours,
  neverPlayed, libraryValue, libraryValueNum, currencySymbol, topGames, recentGames, roast,
}: Props) {
  const shareUrl = `https://steampicker.plazor.xyz/roast/${steamId}`;
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [shameAppId, setShameAppId] = useState<number | null>(null);
  const [scale, setScale] = useState(0.6);
  const [cardHeight, setCardHeight] = useState(600);

  const shameGame = recentGames.find(g => g.appid === shameAppId) ?? null;
  const shameImageUrl = shameAppId
    ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${shameAppId}/header.jpg`
    : null;

  // Fit the 800px-wide card into the viewport
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const maxW = Math.min(window.innerWidth * 0.9, 700);
      setScale(maxW / 800);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  // Measure card's actual rendered height
  useEffect(() => {
    if (!cardRef.current || !open) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setCardHeight(e.contentRect.height);
    });
    obs.observe(cardRef.current);
    // Also measure immediately
    setCardHeight(cardRef.current.offsetHeight);
    return () => obs.disconnect();
  }, [open, shameAppId, roast]);

  const capture = useCallback(async () => {
    const { renderRoastCanvas } = await import("@/lib/roastCanvas");
    const shameG = recentGames.find(g => g.appid === shameAppId) ?? null;
    return renderRoastCanvas({
      personaName, avatarUrl, totalGames, totalHours, neverPlayed,
      libraryValue, libraryValueNum, currencySymbol, roast,
      shameGame: shameG ? {
        name: shameG.name, hours: shameG.hours,
        imageUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${shameG.appid}/header.jpg`,
      } : null,
    });
  }, [personaName, avatarUrl, totalGames, totalHours, neverPlayed, libraryValue, libraryValueNum, currencySymbol, roast, shameAppId, recentGames]);

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

  const handleNativeShare = useCallback(async () => {
    try {
      const canvas = await capture();
      if (!canvas) return;
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
      if (!blob) return;
      const file = new File([blob], `${personaName.replace(/[^a-zA-Z0-9]/g, "_")}_roast.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${personaName}'s Steam Roast`,
          text: `My Steam profile got roasted: "${roast.headline}" — Grade: ${roast.grade} (${roast.rating})\n\nCheck yours: ${shareUrl}`,
          files: [file],
        });
      } else {
        // Fallback: share without image
        await navigator.share({
          title: `${personaName}'s Steam Roast`,
          text: `My Steam profile got roasted: "${roast.headline}" — Grade: ${roast.grade} (${roast.rating})\n\nCheck yours: ${shareUrl}`,
          url: shareUrl,
        });
      }
    } catch {}
  }, [capture, personaName, roast]);

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

            {/* Card — scales to fit modal width, height matches content */}
            <div
              ref={wrapperRef}
              className="rounded-2xl border border-white/[0.08] shadow-2xl mb-4 overflow-hidden"
              style={{ width: Math.round(800 * scale), height: Math.round(cardHeight * scale) }}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 800 }}>
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

              {/* Native Share (mobile/desktop with file support) */}
              {typeof navigator !== "undefined" && !!navigator.share && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
                >
                  <FaShareAlt size={13} /> Share
                </button>
              )}

              <div className="w-px h-6 bg-white/[0.08] mx-1 hidden sm:block" />

              {/* Social share buttons */}
              {[
                { icon: <FaWhatsapp size={14} />, label: "WhatsApp", mode: "native" as const },
                { icon: <FaInstagram size={14} />, label: "Instagram", mode: "native" as const },
                { icon: <FaTwitter size={14} />, label: "X", mode: "url" as const, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`My Steam profile got roasted: "${roast.headline}" — Grade: ${roast.grade} (${roast.rating})\n\nCheck yours: ${shareUrl}`)}` },
                { icon: <FaRedditAlien size={14} />, label: "Reddit", mode: "url" as const, href: `https://reddit.com/submit?title=${encodeURIComponent(`My Steam profile got roasted: "${roast.headline}" (Grade: ${roast.grade})`)}&url=${encodeURIComponent(shareUrl)}` },
                { icon: <SiBluesky size={14} />, label: "Bsky", mode: "url" as const, href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`My Steam profile got roasted: "${roast.headline}" — Grade: ${roast.grade}\n\n${shareUrl}`)}` },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={async () => {
                    try {
                      const canvas = await capture();
                      if (!canvas) return;
                      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
                      if (!blob) return;
                      const fileName = `${personaName.replace(/[^a-zA-Z0-9]/g, "_")}_roast.png`;
                      const file = new File([blob], fileName, { type: "image/png" });
                      const shareText = `My Steam profile got roasted: "${roast.headline}" — Grade: ${roast.grade} (${roast.rating})\n\nCheck yours: ${shareUrl}`;

                      // Try native share with image (works on mobile)
                      if (navigator.canShare?.({ files: [file] })) {
                        await navigator.share({ text: shareText, files: [file] });
                        return;
                      }

                      // Desktop: download image + copy text to clipboard + open share URL
                      // Step 1: Auto-download the image
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = fileName;
                      a.click();
                      URL.revokeObjectURL(url);

                      // Step 2: Copy share text to clipboard
                      await navigator.clipboard.writeText(shareText);
                      setShareMsg(`Image downloaded & text copied! Attach image in ${btn.label}.`);
                      setTimeout(() => setShareMsg(null), 4000);

                      // Step 3: Open the platform
                      const shareHref = btn.mode === "url" && btn.href
                        ? btn.href
                        : btn.label === "WhatsApp"
                          ? `https://web.whatsapp.com/`
                          : btn.label === "Instagram"
                            ? `https://www.instagram.com/`
                            : null;
                      if (shareHref) window.open(shareHref, "_blank", "noopener,noreferrer");
                    } catch {}
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-400 hover:text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>

            {/* Share feedback message */}
            {shareMsg && (
              <div className="mt-3 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-medium text-center">
                {shareMsg}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
