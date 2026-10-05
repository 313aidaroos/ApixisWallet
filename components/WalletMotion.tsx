"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

export function GoldCoinRain({ motion }: { motion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let frame = 0,
      width = 0,
      height = 0,
      last = 0;
    const coins = Array.from({ length: 22 }, (_, i) => ({
      x: (i * 0.61803398875) % 1,
      y: (i * 0.38196601125) % 1,
      r: 14 + ((i * 11) % 22),
      turn: i * 1.97,
      speed: 0.018 + (i % 7) * 0.003,
    }));
    function draw(time: number) {
      if (!ctx) return;
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      ctx.clearRect(0, 0, width, height);
      for (const c of coins) {
        if (motion && !document.hidden) {
          c.y += dt * c.speed;
          c.turn += dt * 0.3;
          if (c.y > 1.1) c.y = -0.1;
        }
        ctx.save();
        ctx.translate(c.x * width + Math.sin(c.turn) * 18, c.y * height);
        ctx.rotate(c.turn * 0.28);
        ctx.scale(Math.max(0.16, Math.abs(Math.cos(c.turn))), 1);
        ctx.globalAlpha = 0.25;
        const gradient = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r);
        [
          [0, "#fff3b3"],
          [0.22, "#d2a13e"],
          [0.43, "#8d5b16"],
          [0.64, "#f8d978"],
          [1, "#be8828"],
        ].forEach(([stop, color]) =>
          gradient.addColorStop(Number(stop), String(color)),
        );
        ctx.beginPath();
        ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = "#f9e39b";
        ctx.lineWidth = 1;
        ctx.stroke();
        for (const radius of [0.83, 0.72]) {
          ctx.beginPath();
          ctx.arc(0, 0, c.r * radius, 0, Math.PI * 2);
          ctx.strokeStyle = radius === 0.83 ? "#7d531c" : "#ffe5a2";
          ctx.stroke();
        }
        ctx.font = `700 ${c.r * 0.45}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#79521c";
        ctx.fillText("IXIS", 0, 0);
        ctx.restore();
      }
      if (motion && !document.hidden) frame = requestAnimationFrame(draw);
    }
    const resize = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = 0;
        frame = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [motion]);
  return <canvas ref={canvas} id="ix-rain" aria-hidden="true" />;
}
