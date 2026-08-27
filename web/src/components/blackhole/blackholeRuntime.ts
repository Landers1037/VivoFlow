import { DEFAULT_BLACKHOLE_COLOR } from "@/types";

export const LOOK = [
  4500, 1.52, 0.1, 2.2, 7.0, 0.85, 0.35, 2.0, 1.4, 0.5, 7.0, 5.0, 1.2, 0.7,
] as const;

export const DEFAULT_INCL: number = LOOK[1];
export const DEFAULT_ROLL: number = LOOK[2];
export const DEFAULT_DISK_SPEED: number = LOOK[11];
export const HOLE_RADIUS = 0.22;
export const MIN_RADIUS = 0.1;
export const MAX_RADIUS = 0.42;
export const SPIN = 0.6;
export const SPIN_OMEGA = 0.05;
export const TARGET_DT = 1 / 30;
export const UNIFORM_FLOATS = 100;
export const UNIFORM_CORE_BYTES = 28 * 4;

const DEFAULT_RGB = hexToRgb(DEFAULT_BLACKHOLE_COLOR);

export type BlackholeGpuParams = {
  color: string;
  spinSpeed: number;
  interactive: boolean;
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : DEFAULT_BLACKHOLE_COLOR;
  return [
    Number.parseInt(n.slice(1, 3), 16) / 255,
    Number.parseInt(n.slice(3, 5), 16) / 255,
    Number.parseInt(n.slice(5, 7), 16) / 255,
  ];
}

export function tintFromColor(color: string): [number, number, number] {
  const [r, g, b] = hexToRgb(color);
  return [
    Math.min(4, r / Math.max(DEFAULT_RGB[0], 1e-3)),
    Math.min(4, g / Math.max(DEFAULT_RGB[1], 1e-3)),
    Math.min(4, b / Math.max(DEFAULT_RGB[2], 1e-3)),
  ];
}

export function writeUniforms(
  out: Float32Array,
  width: number,
  height: number,
  time: number,
  spinPhase: number,
  incl: number,
  roll: number,
  holeRadius: number,
  diskSpeed: number,
  tint: [number, number, number],
) {
  out[0] = width;
  out[1] = height;
  out[2] = time;
  out[3] = 0;
  for (let i = 0; i < LOOK.length; i++) out[4 + i] = LOOK[i];
  out[5] = incl;
  out[6] = roll;
  out[15] = diskSpeed;
  out[18] = holeRadius;
  out[19] = 0.5;
  out[20] = 0.5;
  out[21] = SPIN;
  out[22] = spinPhase;
  out[23] = 0;
  out[24] = tint[0];
  out[25] = tint[1];
  out[26] = tint[2];
  out[27] = 1;
}

export function canvasPixelSize(canvas: HTMLCanvasElement, maxShortSide: number) {
  const cssW = Math.max(1, canvas.clientWidth);
  const cssH = Math.max(1, canvas.clientHeight);
  const short = Math.min(cssW, cssH);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const scale = Math.min(dpr, maxShortSide / short);
  return {
    width: Math.max(1, Math.round(cssW * scale)),
    height: Math.max(1, Math.round(cssH * scale)),
  };
}

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createBlackholeView(params: { current: BlackholeGpuParams }) {
  let incl = DEFAULT_INCL;
  let roll = DEFAULT_ROLL;
  let holeRadius = HOLE_RADIUS;
  const pointers = new Map<number, { x: number; y: number }>();
  let dragLast: { x: number; y: number } | null = null;
  let pinchStartDist = 0;
  let pinchStartRadius = HOLE_RADIUS;

  const onPointerDown = (event: PointerEvent) => {
    if (!params.current.interactive) return;
    const canvas = event.currentTarget as HTMLCanvasElement;
    event.preventDefault();
    event.stopPropagation();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      dragLast = { x: event.clientX, y: event.clientY };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStartDist = Math.max(1, pointerDistance(a, b));
      pinchStartRadius = holeRadius;
      dragLast = null;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!params.current.interactive || !pointers.has(event.pointerId)) return;
    const canvas = event.currentTarget as HTMLCanvasElement;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.max(1, pointerDistance(a, b));
      holeRadius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, pinchStartRadius * (dist / pinchStartDist)));
      return;
    }
    if (!dragLast) return;
    const dx = event.clientX - dragLast.x;
    const dy = event.clientY - dragLast.y;
    dragLast = { x: event.clientX, y: event.clientY };
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    roll += (dx / cssW) * Math.PI * 1.15;
    incl = Math.min(1.55, Math.max(0.12, incl - (dy / cssH) * 1.35));
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size === 0) dragLast = null;
    else if (pointers.size === 1) dragLast = { ...[...pointers.values()][0] };
  };

  const onWheel = (event: WheelEvent) => {
    if (!params.current.interactive) return;
    event.preventDefault();
    holeRadius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, holeRadius * Math.exp(-event.deltaY * 0.0016)));
  };

  function attach(canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }

  function sample() {
    const interactive = params.current.interactive;
    const speed = Number.isFinite(params.current.spinSpeed) ? params.current.spinSpeed : 1;
    return {
      speed,
      incl: interactive ? incl : DEFAULT_INCL,
      roll: interactive ? roll : DEFAULT_ROLL,
      holeRadius: interactive ? holeRadius : HOLE_RADIUS,
      tint: tintFromColor(params.current.color),
      diskSpeed: DEFAULT_DISK_SPEED * speed,
    };
  }

  return { attach, sample };
}
