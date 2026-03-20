/**
 * Renders a roast card to a native Canvas2D — pixel-perfect, no html2canvas.
 */
import type { RoastResult } from "./roast";

type RoastCanvasInput = {
  personaName: string;
  avatarUrl: string | null;
  totalGames: number;
  totalHours: number;
  neverPlayed: number;
  libraryValue: string;
  libraryValueNum: number;
  currencySymbol: string;
  roast: RoastResult;
  shameGame?: { name: string; hours: number; imageUrl: string } | null;
};

const W = 800;
const H = 800;
const PAD = 40;

const GC: Record<string, { bg: string; border: string; text: string }> = {
  S: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)", text: "#ef4444" },
  A: { bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.5)", text: "#f97316" },
  B: { bg: "rgba(234,179,8,0.15)", border: "rgba(234,179,8,0.5)", text: "#eab308" },
  C: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.5)", text: "#22c55e" },
  D: { bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.5)", text: "#60a5fa" },
  F: { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)", text: "#94a3b8" },
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxW && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderRoastCanvas(input: RoastCanvasInput): Promise<HTMLCanvasElement> {
  const scale = 2; // retina
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const gc = GC[input.roast.grade] || GC.F;

  // ── Background ──
  const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
  bg.addColorStop(0, "#050a14");
  bg.addColorStop(0.4, "#0c1929");
  bg.addColorStop(1, "#0a1628");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow effects
  const glowGrad = ctx.createRadialGradient(W - 40, 40, 0, W - 40, 40, 200);
  glowGrad.addColorStop(0, gc.bg);
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(W - 240, -160, 400, 400);

  let y = PAD;

  // ── Header: Avatar + Name + Grade ──
  const [avatarImg] = await Promise.all([
    input.avatarUrl ? loadImage(input.avatarUrl) : Promise.resolve(null),
  ]);

  // Avatar
  const avSize = 64;
  ctx.save();
  roundRect(ctx, PAD, y, avSize, avSize, 14);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, PAD, y, avSize, avSize);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(PAD, y, avSize, avSize);
  }
  ctx.restore();
  // Avatar border
  ctx.strokeStyle = gc.border;
  ctx.lineWidth = 2;
  roundRect(ctx, PAD, y, avSize, avSize, 14);
  ctx.stroke();

  // Name
  ctx.fillStyle = "#fff";
  ctx.font = "800 26px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(input.personaName, PAD + avSize + 16, y + 28);
  ctx.fillStyle = "rgba(148,163,184,0.5)";
  ctx.font = "700 10px 'Segoe UI', system-ui, sans-serif";
  ctx.letterSpacing = "2.5px";
  ctx.fillText("STEAM PROFILE ROAST", PAD + avSize + 16, y + 48);
  ctx.letterSpacing = "0px";

  // Grade badge
  const gradeX = W - PAD - 54;
  roundRect(ctx, gradeX, y, 54, 54, 13);
  ctx.fillStyle = gc.bg;
  ctx.fill();
  ctx.strokeStyle = gc.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = gc.text;
  ctx.font = "900 28px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(input.roast.grade, gradeX + 27, y + 37);
  ctx.textAlign = "left";

  y += avSize + 16;

  // ── Shame Game ──
  if (input.shameGame) {
    const shameImg = await loadImage(input.shameGame.imageUrl);
    const shH = 140;
    roundRect(ctx, PAD, y, W - PAD * 2, shH, 14);
    ctx.save();
    ctx.clip();
    if (shameImg) {
      const imgW = W - PAD * 2;
      const imgH = shameImg.height * (imgW / shameImg.width);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(shameImg, PAD, y, imgW, imgH);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(PAD, y, W - PAD * 2, shH);
    }
    // Gradient overlay
    const sg = ctx.createLinearGradient(0, y + shH * 0.4, 0, y + shH);
    sg.addColorStop(0, "rgba(5,10,20,0.2)");
    sg.addColorStop(1, "rgba(5,10,20,0.95)");
    ctx.fillStyle = sg;
    ctx.fillRect(PAD, y, W - PAD * 2, shH);
    ctx.restore();
    // Border
    ctx.strokeStyle = "rgba(249,115,22,0.3)";
    ctx.lineWidth = 1;
    roundRect(ctx, PAD, y, W - PAD * 2, shH, 14);
    ctx.stroke();
    // Text
    ctx.fillStyle = "rgba(249,115,22,0.7)";
    ctx.font = "700 9px 'Segoe UI', system-ui, sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("GAME OF SHAME", PAD + 16, y + shH - 42);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#fff";
    ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(input.shameGame.name, PAD + 16, y + shH - 24);
    ctx.fillStyle = "rgba(148,163,184,0.5)";
    ctx.font = "400 11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`${Math.round(input.shameGame.hours)}h of questionable life choices`, PAD + 16, y + shH - 9);

    y += shH + 14;
  }

  // ── Headline quote ──
  const headW = W - PAD * 2;
  ctx.font = "italic 700 19px 'Segoe UI', system-ui, sans-serif";
  const headLines = wrapText(ctx, `\u201C${input.roast.headline}\u201D`, headW - 52);
  const headH = Math.max(60, headLines.length * 26 + 28);

  roundRect(ctx, PAD, y, headW, headH, 14);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Left accent bar
  ctx.fillStyle = gc.border;
  roundRect(ctx, PAD, y, 3, headH, 14);
  ctx.fill();

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "italic 700 19px 'Segoe UI', system-ui, sans-serif";
  headLines.forEach((line, i) => {
    ctx.fillText(line, PAD + 22, y + 28 + i * 26);
  });

  y += headH + 16;

  // ── Roast lines ──
  ctx.font = "400 13px 'Segoe UI', system-ui, sans-serif";
  const maxLineW = W - PAD * 2 - 24;
  for (const line of input.roast.lines) {
    const wrapped = wrapText(ctx, line, maxLineW);
    // Diamond bullet
    ctx.fillStyle = gc.text;
    ctx.font = "400 10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("\u25C6", PAD, y + 12);
    ctx.font = "400 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(203,213,225,0.85)";
    wrapped.forEach((wl, i) => {
      ctx.fillText(wl, PAD + 20, y + 13 + i * 19);
    });
    y += wrapped.length * 19 + 6;
  }

  // ── Stats row ── (push to bottom area)
  const statsY = H - PAD - 75;
  const statW = (W - PAD * 2 - 32) / 5;
  const cph = input.totalHours > 0 ? input.libraryValueNum / input.totalHours : 0;
  const playedPct = input.totalGames > 0 ? Math.round(((input.totalGames - input.neverPlayed) / input.totalGames) * 100) : 0;
  const stats = [
    { label: "GAMES", value: input.totalGames.toLocaleString() },
    { label: "HOURS", value: Math.round(input.totalHours).toLocaleString() },
    { label: "UNPLAYED", value: `${input.neverPlayed} (${100 - playedPct}%)` },
    { label: "VALUE", value: input.libraryValue },
    { label: "COST/HR", value: cph > 0 ? `${input.currencySymbol}${cph.toFixed(2)}` : "\u2014" },
  ];

  stats.forEach((s, i) => {
    const sx = PAD + i * (statW + 8);
    roundRect(ctx, sx, statsY, statW, 52, 10);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(148,163,184,0.5)";
    ctx.font = "700 8px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.letterSpacing = "1.5px";
    ctx.fillText(s.label, sx + statW / 2, statsY + 17);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#fff";
    ctx.font = "800 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(s.value, sx + statW / 2, statsY + 38);
    ctx.textAlign = "left";
  });

  // ── Footer ──
  const footY = H - PAD + 2;
  // Verdict badge
  roundRect(ctx, PAD, footY - 18, 170, 28, 8);
  ctx.fillStyle = gc.bg;
  ctx.fill();
  ctx.strokeStyle = gc.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(148,163,184,0.6)";
  ctx.font = "600 10px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Verdict:", PAD + 10, footY);
  ctx.fillStyle = gc.text;
  ctx.font = "800 13px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(input.roast.rating, PAD + 60, footY);

  // Branding
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(96,165,250,0.5)";
  ctx.font = "800 13px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("SteamPicker", W - PAD - 115, footY);
  ctx.fillStyle = "rgba(148,163,184,0.2)";
  ctx.font = "400 11px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("|", W - PAD - 102, footY);
  ctx.fillStyle = "rgba(148,163,184,0.3)";
  ctx.font = "400 10px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("steampicker.plazor.xyz", W - PAD, footY);
  ctx.textAlign = "left";

  return canvas;
}
