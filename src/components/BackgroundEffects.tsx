"use client";

import { useEffect, useRef } from "react";

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
}

function createBeam(w: number, h: number): Beam {
  return {
    x: Math.random() * w * 1.2 - w * 0.1,
    y: Math.random() * h * 1.2 - h * 0.1,
    width: 80 + Math.random() * 120,
    length: h * 1.4,
    angle: -35 + Math.random() * 10,
    speed: 0.3 + Math.random() * 0.5,
    opacity: 0.06 + Math.random() * 0.08,
    hue: 190 + Math.random() * 70,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.01 + Math.random() * 0.02,
  };
}

export default function BackgroundEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamsRef = useRef<Beam[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Cap resolution — no need for retina on a blurred background
    const SCALE = 0.5;
    const BEAM_COUNT = 8;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * SCALE);
      canvas.height = Math.round(h * SCALE);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      beamsRef.current = Array.from({ length: BEAM_COUNT }, () => createBeam(w, h));
    };

    const resetBeam = (beam: Beam, index: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const col = index % 3;
      const spacing = w / 3;
      beam.y = h + 80;
      beam.x = col * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      beam.width = 80 + Math.random() * 120;
      beam.speed = 0.3 + Math.random() * 0.5;
      beam.hue = 190 + (index * 70) / BEAM_COUNT;
      beam.opacity = 0.06 + Math.random() * 0.08;
    };

    const drawBeam = (beam: Beam) => {
      ctx.save();
      ctx.translate(beam.x * SCALE, beam.y * SCALE);
      ctx.rotate((beam.angle * Math.PI) / 180);
      const op = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2);
      const bw = beam.width * SCALE;
      const bl = beam.length * SCALE;
      const g = ctx.createLinearGradient(0, 0, 0, bl);
      g.addColorStop(0, `hsla(${beam.hue},85%,65%,0)`);
      g.addColorStop(0.15, `hsla(${beam.hue},85%,65%,${op * 0.5})`);
      g.addColorStop(0.45, `hsla(${beam.hue},85%,65%,${op})`);
      g.addColorStop(0.55, `hsla(${beam.hue},85%,65%,${op})`);
      g.addColorStop(0.85, `hsla(${beam.hue},85%,65%,${op * 0.5})`);
      g.addColorStop(1, `hsla(${beam.hue},85%,65%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-bw / 2, 0, bw, bl);
      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // No ctx.filter blur — CSS handles it once, not per-frame
      beamsRef.current.forEach((beam, i) => {
        beam.y -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -80) resetBeam(beam, i);
        drawBeam(beam);
      });
      animRef.current = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        filter: "blur(30px)",
      }}
    />
  );
}
