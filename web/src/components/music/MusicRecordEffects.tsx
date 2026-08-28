import { useEffect, useId, useRef, type RefObject } from "react";
import type { MusicAlbumEffect } from "@/types";
import { useTrackAnalyser } from "@/components/music/useTrackAnalyser";

const BAR_COUNT = 84;
const PARTICLE_COUNT = 108;
const NEEDS_ANALYSER: MusicAlbumEffect[] = ["ripple", "bars", "particles"];

type Ripple = { born: number; strength: number };
type Particle = { angle: number; orbit: number; speed: number; size: number; phase: number; bin: number };

function seedParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 7) * 0.11,
    orbit: 1.04 + (i % 9) * 0.028 + (i % 5) * 0.012,
    speed: 0.18 + (i % 11) * 0.035,
    size: 1.1 + (i % 6) * 0.35,
    phase: i * 1.37,
    bin: i % 64,
  }));
}

export function MusicRecordEffects({
  effect,
  playing,
  audioRef,
  recordRef,
}: {
  effect: MusicAlbumEffect;
  playing: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  recordRef: RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const needsAnalyser = NEEDS_ANALYSER.includes(effect);
  const { readBins } = useTrackAnalyser(audioRef, needsAnalyser, playing);
  const playingRef = useRef(playing);
  const effectRef = useRef(effect);
  playingRef.current = playing;
  effectRef.current = effect;

  useEffect(() => {
    if (!needsAnalyser) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bars = new Float32Array(BAR_COUNT);
    const particles = seedParticles();
    const ripples: Ripple[] = [];
    let prevBass = 0;
    let lastRipple = 0;
    let last = performance.now();
    let raf = 0;

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

    const geometry = () => {
      const record = recordRef.current;
      const rect = canvas.getBoundingClientRect();
      if (!record) {
        return { cx: rect.width / 2, cy: rect.height / 2, radius: Math.min(rect.width, rect.height) * 0.32 };
      }
      const rr = record.getBoundingClientRect();
      return {
        cx: rr.left - rect.left + rr.width / 2,
        cy: rr.top - rect.top + rr.height / 2,
        radius: rr.width / 2,
      };
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = now / 1000;
      const isPlaying = playingRef.current;
      const mode = effectRef.current;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const bins = readBins(time);
      const { cx, cy, radius } = geometry();
      const bass = bins.slice(0, 8).reduce((sum, value) => sum + value, 0) / 8;

      if (mode === "ripple") {
        if (isPlaying && !reduced) {
          const beat = bass > 0.42 && bass > prevBass + 0.07;
          if (beat || time - lastRipple > 1.15) {
            ripples.push({ born: time, strength: 0.55 + bass * 0.7 });
            lastRipple = time;
            if (ripples.length > 8) ripples.shift();
          }
        }
        drawRipples(ctx, cx, cy, radius, time, isPlaying, reduced, bass, ripples);
      } else if (mode === "bars") {
        drawBars(ctx, cx, cy, radius, bins, bars, isPlaying, reduced);
      } else if (mode === "particles") {
        drawParticles(ctx, cx, cy, radius, bins, particles, dt, isPlaying, reduced);
      }
      prevBass = bass;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [needsAnalyser, readBins, recordRef]);

  if (effect === "off") return null;

  return (
    <>
      {needsAnalyser ? <canvas ref={canvasRef} className="music-record-fx" aria-hidden="true" /> : null}
      {effect === "turntable" ? (
        <>
          <div className="music-record-platter" aria-hidden="true" />
          <div className={`music-tonearm ${playing ? "is-playing" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 100 280" className="music-tonearm-svg">
              <defs>
                <linearGradient id={`${gradientId}-metal`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#7b8190" />
                  <stop offset="0.45" stopColor="#e8eaee" />
                  <stop offset="1" stopColor="#5c6370" />
                </linearGradient>
                <radialGradient id={`${gradientId}-base`} cx="35%" cy="30%" r="70%">
                  <stop offset="0" stopColor="#f7f7f8" />
                  <stop offset="1" stopColor="#c4c7ce" />
                </radialGradient>
              </defs>
              <path
                d="M50 48 C52 108 62 158 40 222"
                stroke={`url(#${gradientId}-metal)`}
                strokeWidth="7.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="50" cy="28" r="20" fill={`url(#${gradientId}-base)`} />
              <circle cx="50" cy="28" r="13" fill="#f4f4f5" stroke="#111" strokeWidth="1.2" />
              <circle cx="50" cy="28" r="4.2" fill="#27272a" />
              <g transform="translate(28 214) rotate(-28)">
                <rect x="0" y="0" width="30" height="16" rx="3.5" fill="#f4f4f5" stroke="#d4d4d8" />
                <rect x="20" y="4" width="8" height="8" rx="1.5" fill="#3f3f46" />
                <path d="M2 16 L-6 28" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
              </g>
            </svg>
          </div>
        </>
      ) : null}
    </>
  );
}

function drawRipples(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  time: number,
  playing: boolean,
  reduced: boolean,
  bass: number,
  ripples: Ripple[],
) {
  const life = 1.7;
  for (let i = ripples.length - 1; i >= 0; i--) {
    const age = time - ripples[i].born;
    if (age > life) {
      ripples.splice(i, 1);
      continue;
    }
    const t = age / life;
    const r = radius + t * radius * (0.55 + ripples[i].strength * 0.25);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(236, 252, 255, ${Math.max(0, (1 - t) * (0.22 + ripples[i].strength * 0.28))})`;
    ctx.lineWidth = Math.max(1.2, radius * 0.012 * (1 - t * 0.4));
    ctx.stroke();
  }
  if (reduced || !playing) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (1.04 + bass * 0.04), 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(236, 252, 255, 0.16)";
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  bins: Float32Array,
  bars: Float32Array,
  playing: boolean,
  reduced: boolean,
) {
  const smoothing = reduced ? 0.88 : playing ? 0.62 : 0.84;
  const maxLen = radius * (reduced ? 0.12 : 0.3);
  const inner = radius + Math.max(3, radius * 0.018);
  const width = Math.max(1.6, (Math.PI * 2 * inner) / BAR_COUNT * 0.42);
  ctx.lineCap = "round";
  for (let i = 0; i < BAR_COUNT; i++) {
    const bin = bins[Math.floor((i / BAR_COUNT) * bins.length)] ?? 0;
    const target = playing ? Math.pow(bin, 0.85) : 0;
    bars[i] = bars[i] * smoothing + target * (1 - smoothing);
    const value = bars[i];
    if (value < 0.004 && !playing) continue;
    const shown = reduced ? Math.max(0.04, value) : value;
    const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
    const outer = inner + shown * maxLen;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + shown * 0.62})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(cx + cos * inner, cy + sin * inner);
    ctx.lineTo(cx + cos * outer, cy + sin * outer);
    ctx.stroke();
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  bins: Float32Array,
  particles: Particle[],
  dt: number,
  playing: boolean,
  reduced: boolean,
) {
  ctx.globalCompositeOperation = "lighter";
  for (const particle of particles) {
    const energy = bins[particle.bin] ?? 0;
    if (playing && !reduced) {
      particle.angle += particle.speed * dt * (0.35 + energy * 1.1);
    }
    const dist = radius * particle.orbit + (playing ? energy * radius * 0.12 : 0) * Math.sin(particle.phase);
    const x = cx + Math.cos(particle.angle) * dist;
    const y = cy + Math.sin(particle.angle) * dist;
    const alpha = playing ? 0.18 + energy * 0.7 : 0.07;
    const size = particle.size * (playing ? 1 + energy * 1.4 : 0.85);
    ctx.fillStyle = `rgba(210, 245, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}
