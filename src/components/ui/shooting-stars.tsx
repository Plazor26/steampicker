"use client";
import { cn } from "@/lib/utils";
import React, { useEffect, useState, useRef } from "react";

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  speed: number;
  distance: number;
}

interface ShootingStarsProps {
  minSpeed?: number;
  maxSpeed?: number;
  minDelay?: number;
  maxDelay?: number;
  starColor?: string;
  trailColor?: string;
  starWidth?: number;
  starHeight?: number;
  className?: string;
}

const getRandomStartPoint = () => {
  const side = Math.floor(Math.random() * 4);
  const offset = Math.random() * (typeof window !== "undefined" ? window.innerWidth : 1200);
  switch (side) {
    case 0: return { x: offset, y: 0, angle: 45 };
    case 1: return { x: typeof window !== "undefined" ? window.innerWidth : 1200, y: offset, angle: 135 };
    case 2: return { x: offset, y: typeof window !== "undefined" ? window.innerHeight : 800, angle: 225 };
    case 3: return { x: 0, y: offset, angle: 315 };
    default: return { x: 0, y: 0, angle: 45 };
  }
};

export const ShootingStars: React.FC<ShootingStarsProps> = ({
  minSpeed = 10,
  maxSpeed = 30,
  minDelay = 1200,
  maxDelay = 4200,
  starColor = "#9E00FF",
  trailColor = "#2EB9DF",
  starWidth = 10,
  starHeight = 1,
  className,
}) => {
  const [star, setStar] = useState<ShootingStar | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const createStar = () => {
      const { x, y, angle } = getRandomStartPoint();
      setStar({
        id: Date.now(),
        x, y, angle,
        scale: 1,
        speed: Math.random() * (maxSpeed - minSpeed) + minSpeed,
        distance: 0,
      });
      timeout = setTimeout(createStar, Math.random() * (maxDelay - minDelay) + minDelay);
    };
    createStar();
    return () => clearTimeout(timeout);
  }, [minSpeed, maxSpeed, minDelay, maxDelay]);

  useEffect(() => {
    let frame: number;
    const moveStar = () => {
      setStar((prev) => {
        if (!prev) return null;
        const newX = prev.x + prev.speed * Math.cos((prev.angle * Math.PI) / 180);
        const newY = prev.y + prev.speed * Math.sin((prev.angle * Math.PI) / 180);
        const newDistance = prev.distance + prev.speed;
        const w = typeof window !== "undefined" ? window.innerWidth : 1200;
        const h = typeof window !== "undefined" ? window.innerHeight : 800;
        if (newX < -20 || newX > w + 20 || newY < -20 || newY > h + 20) return null;
        return { ...prev, x: newX, y: newY, distance: newDistance, scale: 1 + newDistance / 100 };
      });
      frame = requestAnimationFrame(moveStar);
    };
    frame = requestAnimationFrame(moveStar);
    return () => cancelAnimationFrame(frame);
  }, [star]);

  const gradId = `grad-${starColor.replace("#", "")}-${trailColor.replace("#", "")}`;

  return (
    <svg ref={svgRef} className={cn("w-full h-full absolute inset-0 pointer-events-none", className)}>
      {star && (
        <rect
          key={star.id}
          x={star.x}
          y={star.y}
          width={starWidth * star.scale}
          height={starHeight}
          fill={`url(#${gradId})`}
          transform={`rotate(${star.angle}, ${star.x + (starWidth * star.scale) / 2}, ${star.y + starHeight / 2})`}
        />
      )}
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: trailColor, stopOpacity: 0 }} />
          <stop offset="100%" style={{ stopColor: starColor, stopOpacity: 1 }} />
        </linearGradient>
      </defs>
    </svg>
  );
};
