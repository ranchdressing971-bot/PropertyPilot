"use client";

import { useEffect, useRef } from "react";

type OrbPhase =
  | "idle"
  | "listening_wake"
  | "listening_command"
  | "thinking"
  | "speaking";

interface NovaMeshOrbProps {
  phase: OrbPhase;
  onClick: () => void;
  onPointerDown?: () => void;
  ariaLabel: string;
}

type Vec3 = { x: number; y: number; z: number };

function rotateY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

function rotateX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): string {
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(a[0] + (b[0] - a[0]) * u);
  const g = Math.round(a[1] + (b[1] - a[1]) * u);
  const bl = Math.round(a[2] + (b[2] - a[2]) * u);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Animated neon mesh sphere inspired by the particle-wireframe reference —
 * not a still image. Cyan/pink dual glow, flowing surface distortion.
 */
export function NovaMeshOrb({
  phase,
  onClick,
  onPointerDown,
  ariaLabel,
}: NovaMeshOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLButtonElement | null>(null);
  const phaseRef = useRef(phase);
  const rafRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    // Sphere lattice
    const rings = 26;
    const segs = 42;
    const base: Vec3[][] = [];
    for (let i = 0; i <= rings; i++) {
      const v = i / rings;
      const theta = v * Math.PI;
      const row: Vec3[] = [];
      for (let j = 0; j <= segs; j++) {
        const u = j / segs;
        const phi = u * Math.PI * 2;
        row.push({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.cos(theta),
          z: Math.sin(theta) * Math.sin(phi),
        });
      }
      base.push(row);
    }

    // Ambient dust particles around the sphere
    const dust = Array.from({ length: 90 }, () => ({
      theta: Math.random() * Math.PI,
      phi: Math.random() * Math.PI * 2,
      r: 1.05 + Math.random() * 0.55,
      speed: 0.15 + Math.random() * 0.45,
      size: 0.6 + Math.random() * 1.8,
      tint: Math.random(),
    }));

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let t0 = performance.now();

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const p = phaseRef.current;

      let rotSpeed = 0.22;
      let waveAmp = 0.045;
      let waveFreq = 2.2;
      let glow = 0.55;
      let lineAlpha = 0.55;

      if (p === "listening_wake") {
        rotSpeed = 0.28;
        waveAmp = 0.055;
        glow = 0.7;
      } else if (p === "listening_command") {
        rotSpeed = 0.38;
        waveAmp = 0.08;
        waveFreq = 2.8;
        glow = 0.9;
        lineAlpha = 0.7;
      } else if (p === "thinking") {
        rotSpeed = 0.55;
        waveAmp = 0.1;
        waveFreq = 3.4;
        glow = 1;
        lineAlpha = 0.75;
      } else if (p === "speaking") {
        rotSpeed = 0.42;
        waveAmp = 0.12 + Math.sin(t * 8) * 0.04;
        waveFreq = 3.8;
        glow = 1.05;
        lineAlpha = 0.85;
      }

      const rotY = t * rotSpeed;
      const rotX = Math.sin(t * 0.35) * 0.35 + 0.25;
      const radius = Math.min(width, height) * 0.38;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Soft dual glow behind the mesh
      const g1 = ctx.createRadialGradient(
        cx - radius * 0.25,
        cy - radius * 0.2,
        radius * 0.1,
        cx,
        cy,
        radius * 1.35
      );
      g1.addColorStop(0, `rgba(86, 214, 255, ${0.22 * glow})`);
      g1.addColorStop(0.45, `rgba(124, 92, 255, ${0.1 * glow})`);
      g1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const g2 = ctx.createRadialGradient(
        cx + radius * 0.3,
        cy + radius * 0.25,
        radius * 0.05,
        cx,
        cy,
        radius * 1.2
      );
      g2.addColorStop(0, `rgba(255, 79, 216, ${0.2 * glow})`);
      g2.addColorStop(0.5, `rgba(255, 79, 216, ${0.05 * glow})`);
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      type Proj = { x: number; y: number; z: number; c: number };
      const projected: Proj[][] = [];

      for (let i = 0; i <= rings; i++) {
        const row: Proj[] = [];
        for (let j = 0; j <= segs; j++) {
          const b = base[i]![j]!;
          const n =
            Math.sin(b.x * waveFreq * 3 + t * 2.1) *
              Math.cos(b.y * waveFreq * 2.4 - t * 1.7) *
              Math.sin(b.z * waveFreq * 2.8 + t * 1.3);
          const bulge = 1 + waveAmp * n + waveAmp * 0.35 * Math.sin(t * 1.5 + i * 0.2);
          let p3 = { x: b.x * bulge, y: b.y * bulge, z: b.z * bulge };
          p3 = rotateY(p3, rotY);
          p3 = rotateX(p3, rotX);

          // Dual light: cyan from upper-left, pink from lower-right
          const cyan = Math.max(0, -p3.x * 0.55 - p3.y * 0.45 + p3.z * 0.15);
          const pink = Math.max(0, p3.x * 0.55 + p3.y * 0.35 - p3.z * 0.1);
          const mix = pink / (cyan + pink + 0.001);

          row.push({
            x: cx + p3.x * radius,
            y: cy + p3.y * radius,
            z: p3.z,
            c: mix,
          });
        }
        projected.push(row);
      }

      // Depth-sorted horizontal rings + vertical meridians
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const drawSeg = (a: Proj, b: Proj) => {
        const depth = (a.z + b.z) * 0.5;
        const alpha = (0.22 + (depth + 1) * 0.28) * lineAlpha;
        const mid = (a.c + b.c) * 0.5;
        const col = lerpColor([86, 214, 255], [255, 79, 216], mid);
        const m = col.match(/\d+/g);
        if (!m) return;
        ctx.strokeStyle = `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
        ctx.lineWidth = 0.7 + (depth + 1) * 0.55;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      };

      // Draw back-to-front by average z of each ring segment loosely
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
          const a = projected[i]![j]!;
          const b = projected[i]![j + 1]!;
          const c = projected[i + 1]![j]!;
          // Prefer drawing when facing camera-ish
          if ((a.z + b.z) * 0.5 > -0.15) drawSeg(a, b);
          if ((a.z + c.z) * 0.5 > -0.15) drawSeg(a, c);
        }
      }
      // Fill in far side faintly
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
          const a = projected[i]![j]!;
          const b = projected[i]![j + 1]!;
          const c = projected[i + 1]![j]!;
          if ((a.z + b.z) * 0.5 <= -0.15) drawSeg(a, b);
          if ((a.z + c.z) * 0.5 <= -0.15) drawSeg(a, c);
        }
      }
      ctx.globalAlpha = 1;

      // Vertex sparks on ridges
      for (let i = 0; i <= rings; i += 2) {
        for (let j = 0; j <= segs; j += 2) {
          const pt = projected[i]![j]!;
          if (pt.z < -0.2) continue;
          const col = lerpColor([170, 240, 255], [255, 160, 230], pt.c);
          const m = col.match(/\d+/g)!;
          const a = 0.25 + (pt.z + 1) * 0.35;
          ctx.fillStyle = `rgba(${m[0]},${m[1]},${m[2]},${a})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 0.8 + (pt.z + 1) * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Orbiting dust
      for (const d of dust) {
        const phi = d.phi + t * d.speed;
        let p3: Vec3 = {
          x: Math.sin(d.theta) * Math.cos(phi) * d.r,
          y: Math.cos(d.theta) * d.r * 0.85,
          z: Math.sin(d.theta) * Math.sin(phi) * d.r,
        };
        p3 = rotateY(p3, rotY * 0.6);
        p3 = rotateX(p3, rotX * 0.5);
        if (p3.z < -0.4) continue;
        const x = cx + p3.x * radius;
        const y = cy + p3.y * radius;
        const col = lerpColor([86, 214, 255], [255, 79, 216], d.tint);
        const m = col.match(/\d+/g)!;
        ctx.fillStyle = `rgba(${m[0]},${m[1]},${m[2]},${0.35 + (p3.z + 1) * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, d.size * (0.7 + (p3.z + 1) * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <button
      ref={wrapRef}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className="nova-orb"
      aria-label={ariaLabel}
    >
      <canvas ref={canvasRef} className="nova-orb-canvas" />
    </button>
  );
}
