import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FALLBACK_NA = "N/A";

export function formatBytes(
  bytes: number | null | undefined,
  unavailable: string = FALLBACK_NA,
): string {
  if (bytes == null || Number.isNaN(bytes)) return unavailable;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatBps(
  bps: number | null | undefined,
  unavailable: string = FALLBACK_NA,
): string {
  if (bps == null) return unavailable;
  return `${formatBytes(bps, unavailable)}/s`;
}

export function formatMhz(
  mhz: number | null | undefined,
  unavailable: string = FALLBACK_NA,
): string {
  if (mhz == null) return unavailable;
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
  return `${mhz} MHz`;
}

export function formatPercent(
  v: number | null | undefined,
  unavailable: string = FALLBACK_NA,
): string {
  if (v == null || Number.isNaN(v)) return unavailable;
  return `${v.toFixed(1)}%`;
}

export function formatTemp(
  v: number | null | undefined,
  unavailable: string = FALLBACK_NA,
): string {
  if (v == null || Number.isNaN(v)) return unavailable;
  return `${v.toFixed(0)}°C`;
}

export function na<T>(
  v: T | null | undefined,
  unavailable: string = FALLBACK_NA,
  fmt: (x: T) => string = String,
): string {
  if (v == null || v === "") return unavailable;
  return fmt(v);
}
