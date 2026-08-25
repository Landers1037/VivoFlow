import { useEffect, useRef } from "react";
import type { AudioFrame, AudioVisualizerMode } from "@/types";

interface Props {
  frame: AudioFrame | null;
  mode: AudioVisualizerMode;
  primary: string;
  secondary: string;
  gradient: boolean;
  amplitude: number;
  smoothing: number;
  preview?: boolean;
  className?: string;
}

const syntheticBins = (time: number) => Array.from({ length: 64 }, (_, i) => {
  const envelope = Math.exp(-i / 62);
  return Math.max(0.025, (0.34 + Math.sin(time * 2.2 + i * 0.31) * 0.18 + Math.sin(time * 0.8 + i * 0.09) * 0.16) * envelope);
});

export function AudioCanvas({ frame, mode, primary, secondary, gradient, amplitude, smoothing, preview = false, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const valuesRef = useRef(Array(64).fill(0) as number[]);
  const propsRef = useRef({ frame, mode, primary, secondary, gradient, amplitude, smoothing, preview });
  propsRef.current = { frame, mode, primary, secondary, gradient, amplitude, smoothing, preview };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const draw = (ms: number) => {
      const p = propsRef.current;
      const t = ms / 1000;
      const target = p.frame?.bins?.length === 64 ? p.frame.bins : p.preview ? syntheticBins(t) : Array(64).fill(0);
      const smoothingValue = reduced ? Math.max(0.78, p.smoothing) : p.smoothing;
      valuesRef.current = valuesRef.current.map((value, i) => value * smoothingValue + Math.min(1, (target[i] ?? 0) * p.amplitude) * (1 - smoothingValue));
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawMode(ctx, rect.width, rect.height, valuesRef.current, t, p.mode, p.primary, p.gradient ? p.secondary : p.primary, reduced, Boolean(p.frame?.beat));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

function colorAt(a: string, b: string, t: number, alpha = 1) {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const ca = parse(a), cb = parse(b);
  const rgb = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function drawMode(ctx: CanvasRenderingContext2D, w: number, h: number, bins: number[], time: number, mode: AudioVisualizerMode, a: string, b: string, reduced: boolean, beat: boolean) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  if (mode === "grid") drawGrid(ctx, w, h, bins, a, b);
  else if (mode === "aurora") drawAurora(ctx, w, h, bins, a, b, reduced);
  else if (mode === "radial") drawRadial(ctx, w, h, bins, time, a, b, reduced);
  else drawParticles(ctx, w, h, bins, time, a, b, reduced, beat);
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, bins: number[], a: string, b: string) {
  const columns = Math.min(32, bins.length);
  const paddingX = Math.min(32, Math.max(12, w * 0.025));
  const innerWidth = Math.max(1, w - paddingX * 2);
  const gap = Math.max(2, innerWidth * 0.006);
  const cell = Math.max(3, (innerWidth - gap * (columns - 1)) / columns);
  const rows = Math.max(5, Math.floor(h * 0.72 / (cell + gap)));
  const baseY = h * 0.86;
  for (let col = 0; col < columns; col++) {
    const value = bins[Math.floor(col / columns * bins.length)];
    const lit = Math.max(1, Math.round(value * rows));
    for (let row = 0; row < rows; row++) {
      const active = row < lit;
      ctx.fillStyle = colorAt(a, b, col / (columns - 1), active ? 0.25 + 0.75 * (1 - row / rows) : 0.045);
      const x = paddingX + col * (cell + gap);
      const y = baseY - (row + 1) * (cell + gap);
      ctx.beginPath(); ctx.roundRect(x, y, cell, cell, Math.min(3, cell * 0.2)); ctx.fill();
    }
  }
}

function drawAurora(ctx: CanvasRenderingContext2D, w: number, h: number, bins: number[], a: string, b: string, reduced: boolean) {
  ctx.globalCompositeOperation = "lighter";
  for (let layer = 0; layer < 3; layer++) {
    const baseline = h * (0.44 + layer * 0.11);
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, colorAt(a, b, 0, 0.04)); gradient.addColorStop(0.5, colorAt(a, b, 0.5, 0.38 - layer * 0.07)); gradient.addColorStop(1, colorAt(a, b, 1, 0.04));
    ctx.beginPath(); ctx.moveTo(0, baseline);
    bins.forEach((value, i) => {
      const x = i / (bins.length - 1) * w;
      const drift = reduced ? 0 : Math.sin(i * 0.23 + layer) * h * 0.018;
      const y = baseline - value * h * (0.32 - layer * 0.04) + drift;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, baseline + h * 0.16); ctx.lineTo(0, baseline + h * 0.16); ctx.closePath();
    ctx.fillStyle = gradient; ctx.shadowBlur = 28; ctx.shadowColor = colorAt(a, b, 0.5, 0.5); ctx.fill();
  }
}

function drawRadial(ctx: CanvasRenderingContext2D, w: number, h: number, bins: number[], time: number, a: string, b: string, reduced: boolean) {
  const cx = w / 2, cy = h / 2, min = Math.min(w, h), radius = min * 0.18;
  const rotation = reduced ? -Math.PI / 2 : time * 0.08;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 96; i++) {
    const bin = bins[Math.floor(i / 96 * bins.length)];
    const angle = i / 96 * Math.PI * 2 + rotation;
    const inner = radius, outer = radius + min * (0.04 + bin * 0.25);
    ctx.strokeStyle = colorAt(a, b, i / 95, 0.3 + bin * 0.7); ctx.lineWidth = Math.max(1.5, min * 0.004); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner); ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer); ctx.stroke();
  }
  const bass = bins.slice(0, 10).reduce((s, v) => s + v, 0) / 10;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * (1.3 + bass));
  glow.addColorStop(0, colorAt(a, b, 0.2, 0.32)); glow.addColorStop(0.6, colorAt(a, b, 0.7, 0.12)); glow.addColorStop(1, colorAt(a, b, 1, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, radius * (1.3 + bass), 0, Math.PI * 2); ctx.fill();
}

function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, bins: number[], time: number, a: string, b: string, reduced: boolean, beat: boolean) {
  ctx.globalCompositeOperation = "lighter";
  const count = reduced ? 64 : 144;
  for (let i = 0; i < count; i++) {
    const binIndex = (i * 17) % bins.length;
    const energy = bins[binIndex];
    const x = ((i * 0.618033 + (reduced ? 0 : time * (0.004 + energy * 0.007))) % 1) * w;
    const lane = (i % 9) / 9;
    const y = h * (0.84 - lane * 0.28) - energy * h * (0.2 + lane * 0.45) + Math.sin(i * 2.1 + time) * (reduced ? 0 : 7);
    const radius = 1.2 + energy * 5 + (beat && i % 7 === 0 ? 2 : 0);
    ctx.fillStyle = colorAt(a, b, binIndex / 63, 0.25 + energy * 0.75); ctx.shadowBlur = radius * 3; ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  }
  const bass = bins.slice(0, 10).reduce((s, v) => s + v, 0) / 10;
  ctx.strokeStyle = colorAt(a, b, 0.35, 0.14 + bass * 0.45); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(w / 2, h * 0.84, w * (0.13 + bass * 0.34), h * (0.025 + bass * 0.06), 0, 0, Math.PI * 2); ctx.stroke();
}
