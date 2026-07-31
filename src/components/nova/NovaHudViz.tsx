"use client";

import { useId } from "react";

type Point = { x: number; y: number };

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

export function NovaSparkline({
  values,
  width = 160,
  height = 36,
  stroke = "rgba(86,214,255,0.9)",
  fill = "rgba(86,214,255,0.12)",
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const pts = values.length >= 2 ? values : [0, ...(values.length ? values : [0])];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = Math.max(max - min, 1);
  const coords: Point[] = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * width,
    y: height - ((v - min) / span) * (height - 4) - 2,
  }));
  const line = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      className={`nova-spark ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`novaSparkFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#novaSparkFill-${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" />
      {coords.length > 0 && (
        <circle
          cx={coords[coords.length - 1].x}
          cy={coords[coords.length - 1].y}
          r="2.4"
          fill={stroke}
        />
      )}
    </svg>
  );
}

export function NovaBarChart({
  items,
  maxHint,
  height = 56,
}: {
  items: Array<{ label: string; value: number; tone?: "cyan" | "pink" | "violet" | "amber" }>;
  maxHint?: number;
  height?: number;
}) {
  const max = Math.max(maxHint ?? 0, ...items.map((i) => i.value), 1);
  return (
    <div className="nova-bars" style={{ height }} aria-hidden>
      {items.map((item) => {
        const h = clamp(item.value / max) * 100;
        return (
          <div key={item.label} className="nova-bar-col">
            <div className="nova-bar-track">
              <div
                className={`nova-bar-fill tone-${item.tone ?? "cyan"}`}
                style={{ height: `${h}%` }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function NovaDonut({
  segments,
  size = 72,
  centerLabel,
  centerSub,
}: {
  segments: Array<{ value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = Math.max(
    segments.reduce((s, seg) => s + Math.max(0, seg.value), 0),
    1
  );
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="nova-donut-wrap" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(120,140,180,0.15)"
          strokeWidth="7"
        />
        {segments.map((seg, i) => {
          const len = (Math.max(0, seg.value) / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="7"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="nova-donut-center">
        {centerLabel && <strong>{centerLabel}</strong>}
        {centerSub && <span>{centerSub}</span>}
      </div>
    </div>
  );
}

export function NovaGauge({
  value,
  max = 100,
  label,
  unit = "%",
}: {
  value: number;
  max?: number;
  label: string;
  unit?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const pct = clamp(value / Math.max(max, 1));
  const r = 28;
  const c = Math.PI * r;
  const dash = pct * c;

  return (
    <div className="nova-gauge" aria-hidden>
      <svg viewBox="0 0 72 44" width="72" height="44">
        <defs>
          <linearGradient id={`novaGaugeGrad-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#56d6ff" />
            <stop offset="100%" stopColor="#ff4fd8" />
          </linearGradient>
        </defs>
        <path
          d="M8 40 A28 28 0 0 1 64 40"
          fill="none"
          stroke="rgba(120,140,180,0.18)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M8 40 A28 28 0 0 1 64 40"
          fill="none"
          stroke={`url(#novaGaugeGrad-${gid})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="nova-gauge-readout">
        <strong>
          {Math.round(value)}
          {unit}
        </strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function NovaFunnel({
  steps,
}: {
  steps: Array<{ label: string; value: number; tone?: string }>;
}) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="nova-funnel" aria-hidden>
      {steps.map((step) => (
        <div key={step.label} className="nova-funnel-row">
          <span>{step.label}</span>
          <div className="nova-funnel-track">
            <div
              className={`nova-funnel-fill ${step.tone ?? ""}`}
              style={{ width: `${clamp(step.value / max) * 100}%` }}
            />
          </div>
          <strong>{step.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function NovaRadarBars({
  items,
}: {
  items: Array<{ label: string; value: number; max?: number }>;
}) {
  return (
    <div className="nova-radar" aria-hidden>
      {items.map((item) => {
        const max = Math.max(item.max ?? item.value, 1);
        const pct = clamp(item.value / max) * 100;
        return (
          <div key={item.label} className="nova-radar-row">
            <span>{item.label}</span>
            <div className="nova-radar-track">
              <div className="nova-radar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
