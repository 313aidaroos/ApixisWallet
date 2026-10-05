"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoryItem } from "@/lib/wallet-client";

const ranges = [
  { key: "24H", days: 1, label: "Last 24 hours" },
  { key: "1W", days: 7, label: "Last week" },
  { key: "1M", days: 30, label: "Last month" },
  { key: "6M", days: 183, label: "Last 6 months" },
  { key: "1Y", days: 365, label: "Last year" },
  { key: "ALL", days: 0, label: "All time" },
];
export function transactionAmount(item: HistoryItem) {
  return item.kind === "spend" ? item.held : item.amount;
}
export function visibleTransactions(items: HistoryItem[]) {
  return items.filter(
    (item) => item.kind !== "reserve" && item.kind !== "release",
  );
}

export function WalletChart({
  history,
  total,
  updatedAt,
  connected,
  loadOlder,
  loadingOlder,
}: {
  history: HistoryItem[];
  total: number;
  updatedAt: number;
  connected: boolean;
  loadOlder: () => void;
  loadingOlder: boolean;
}) {
  const [range, setRange] = useState(ranges[0]);
  const [mode, setMode] = useState<"price" | "activity">("activity");
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; index: number } | null>(null);
  const data = useMemo(() => {
    const end = updatedAt || 86400000;
    const start = range.days
      ? end - range.days * 86400000
      : Math.min(
          end - 86400000,
          ...history.map((item) => new Date(item.createdAt).getTime()),
        );
    const items = visibleTransactions(history).filter(
      (item) =>
        new Date(item.createdAt).getTime() >= start &&
        new Date(item.createdAt).getTime() <= end,
    );
    const bars = Array<number>(40).fill(0);
    for (const item of items) {
      const index = Math.max(
        0,
        Math.min(
          39,
          Math.floor(
            ((new Date(item.createdAt).getTime() - start) / (end - start)) * 40,
          ),
        ),
      );
      bars[index] += Math.abs(transactionAmount(item));
    }
    return {
      start,
      end,
      bars,
      volume: bars.reduce((a, b) => a + b, 0),
      count: items.length,
    };
  }, [history, updatedAt, range]);
  useEffect(() => {
    const el = canvas.current,
      ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const draw = () => {
      const { width: w, height: h } = el.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 2);
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const left = 10,
        right = w - 60,
        top = 24,
        bottom = h - 50,
        plotBottom = bottom - 48,
        max = Math.max(1, ...data.bars),
        span = right - left;
      ctx.font = "10px sans-serif";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 5; i++) {
        const y = top + ((plotBottom - top) * i) / 4;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.strokeStyle = "#283650";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#94a7c7";
        ctx.fillText(
          mode === "price"
            ? (0.0105 - i * 0.00025).toFixed(4)
            : Math.round(max * (1 - i / 4)).toLocaleString(),
          right + 7,
          y,
        );
      }
      const priceY = top + (plotBottom - top) / 2;
      if (mode === "price") {
        const fill = ctx.createLinearGradient(0, priceY, 0, plotBottom);
        fill.addColorStop(0, "#e9c56725");
        fill.addColorStop(1, "#e9c56700");
        ctx.fillStyle = fill;
        ctx.fillRect(left, priceY, span, plotBottom - priceY);
        ctx.beginPath();
        ctx.moveTo(left, priceY);
        ctx.lineTo(right, priceY);
        ctx.strokeStyle = "#ffd68a";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (connected) {
        const points = data.bars.map((value, i) => ({
          x: left + ((i + 0.5) * span) / 40,
          y: plotBottom - (value / max) * (plotBottom - top),
        }));
        const fill = ctx.createLinearGradient(0, top, 0, plotBottom);
        fill.addColorStop(0, "#63e9ff50");
        fill.addColorStop(1, "#63e9ff00");
        ctx.beginPath();
        points.forEach((point, i) =>
          i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
        );
        ctx.lineTo(points[points.length - 1].x, plotBottom);
        ctx.lineTo(points[0].x, plotBottom);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.beginPath();
        points.forEach((point, i) =>
          i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
        );
        ctx.strokeStyle = "#67ffe6";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#67ffe6";
        ctx.shadowBlur = 7;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      data.bars.forEach((value, i) => {
        const barHeight = (value / max) * 32;
        ctx.fillStyle =
          i === hover?.index ? "#c1ffff" : i % 3 ? "#57e6d85f" : "#b383fbc0";
        ctx.fillRect(
          left + (i * span) / 40 + 1,
          bottom - barHeight,
          Math.max(1, span / 40 - 3),
          barHeight,
        );
      });
      for (let i = 0; i < 5; i++) {
        const date = new Date(data.start + ((data.end - data.start) * i) / 4);
        ctx.fillStyle = "#94a7c7";
        ctx.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
        ctx.fillText(
          !updatedAt
            ? ["Start", "25%", "50%", "75%", "Now"][i]
            : range.key === "24H"
              ? date.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : date.toLocaleDateString([], { month: "short", day: "numeric" }),
          left + (span * i) / 4,
          h - 18,
        );
      }
      ctx.textAlign = "left";
      if (hover) {
        const x = left + ((hover.index + 0.5) * span) / 40;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = "#b9c8df";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    draw();
    return () => observer.disconnect();
  }, [data, mode, range, hover, updatedAt, connected]);
  const partial = history.length < total;
  return (
    <section
      className="ix-chart ix-panel"
      aria-label="Ixis price and your wallet activity"
    >
      <div className="ix-chart-title">
        <div className="ix-chart-asset">
          <span className="ix-coin">IX</span>
          <div>
            <strong>{mode === "price" ? "Ixis / USD" : "Ixis activity"}</strong>
            <small>Apixis platform credit</small>
          </div>
        </div>
        <span className="ix-peg">FIXED PLATFORM RATE</span>
      </div>
      <div className="ix-chart-summary">
        <div>
          <div className="ix-chart-price">
            {mode === "price"
              ? "$0.01000"
              : connected
                ? `${data.volume.toLocaleString()} Ixis`
                : "—"}
          </div>
          <div className="ix-change">
            {mode === "price"
              ? "0.00% · fixed rate"
              : "Your wallet · credits and redemptions"}
          </div>
        </div>
        <span className="ix-status">IXIS</span>
      </div>
      <div className="ix-chart-controls">
        <div className="ix-modes" aria-label="Chart metric">
          {(["price", "activity"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={mode === value}
              className={mode === value ? "ix-selected" : ""}
              onClick={() => {
                setMode(value);
                setHover(null);
              }}
            >
              {value === "price" ? "Price" : "Activity"}
            </button>
          ))}
        </div>
        <div className="ix-ranges" aria-label="Chart time range">
          {ranges.map((value) => (
            <button
              key={value.key}
              aria-label={value.label}
              aria-pressed={range.key === value.key}
              className={range.key === value.key ? "ix-selected" : ""}
              onClick={() => {
                setRange(value);
                setHover(null);
              }}
            >
              {value.key}
            </button>
          ))}
        </div>
      </div>
      <div className="ix-plot">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${range.label}: fixed reference price $0.01. ${connected ? `${data.count} loaded transactions; ${data.volume} Ixis activity.` : "Sign in for wallet activity."}`}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            setHover({
              x,
              index: Math.max(
                0,
                Math.min(39, Math.floor(((x - 10) / (rect.width - 70)) * 40)),
              ),
            });
          }}
          onPointerLeave={() => setHover(null)}
        />
        {hover && (
          <div
            className="ix-tooltip"
            style={{
              left: `clamp(0px, ${hover.x}px, calc(100% - 160px))`,
              top: 14,
            }}
          >
            $0.01000 · {data.bars[hover.index].toLocaleString()} Ixis activity
          </div>
        )}
      </div>
      <p className="ix-chart-source">
        {range.label} · Fixed rate reference, not a traded market price.
        Activity shows your {partial ? "loaded" : "recorded"} transactions.
      </p>
      {partial && (
        <p className="ix-note">
          {history.length} of {total} ledger records loaded.{" "}
          <button
            className="ix-text-button"
            onClick={loadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Loading…" : "Load older history"}
          </button>
        </p>
      )}
      <div className="ix-period-stats">
        <div>
          <span>Activity · Ixis</span>
          <b>{connected ? data.volume.toLocaleString() : "—"}</b>
        </div>
        <div>
          <span>Transactions</span>
          <b>{connected ? data.count.toLocaleString() : "—"}</b>
        </div>
        <div>
          <span>Price change</span>
          <b>0.00%</b>
        </div>
      </div>
    </section>
  );
}
