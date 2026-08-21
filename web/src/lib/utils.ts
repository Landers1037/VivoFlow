import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "不可用";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatBps(bps: number | null | undefined): string {
  if (bps == null) return "不可用";
  return `${formatBytes(bps)}/s`;
}

export function formatMhz(mhz: number | null | undefined): string {
  if (mhz == null) return "不可用";
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
  return `${mhz} MHz`;
}

export function formatPercent(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "不可用";
  return `${v.toFixed(1)}%`;
}

export function formatTemp(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "不可用";
  return `${v.toFixed(0)}°C`;
}

export function na<T>(v: T | null | undefined, fmt: (x: T) => string = String): string {
  if (v == null || v === "") return "不可用";
  return fmt(v);
}
