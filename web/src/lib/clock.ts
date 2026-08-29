import type { ClockTimezoneOffsetMinutes, Lang } from "@/types";

const WEEKDAYS_LCD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export interface ClockParts {
  h: string;
  m: string;
  s: string;
  day: string;
  month: string;
  weekdayLcd: (typeof WEEKDAYS_LCD)[number];
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toClockDate(now: Date, timezoneOffsetMinutes: ClockTimezoneOffsetMinutes) {
  return new Date(now.getTime() + timezoneOffsetMinutes * 60_000);
}

export function getClockParts(now: Date, timezoneOffsetMinutes: ClockTimezoneOffsetMinutes): ClockParts {
  const clockDate = toClockDate(now, timezoneOffsetMinutes);
  return {
    h: pad2(clockDate.getUTCHours()),
    m: pad2(clockDate.getUTCMinutes()),
    s: pad2(clockDate.getUTCSeconds()),
    day: pad2(clockDate.getUTCDate()),
    month: pad2(clockDate.getUTCMonth() + 1),
    weekdayLcd: WEEKDAYS_LCD[clockDate.getUTCDay()] ?? "SUN",
  };
}

export function formatClockWeek(now: Date, lang: Lang, timezoneOffsetMinutes: ClockTimezoneOffsetMinutes) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", {
    weekday: "short",
    timeZone: "UTC",
  }).format(toClockDate(now, timezoneOffsetMinutes));
}

export function formatClockDate(now: Date, lang: Lang, timezoneOffsetMinutes: ClockTimezoneOffsetMinutes) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(toClockDate(now, timezoneOffsetMinutes));
}

export function formatClockFullDate(now: Date, lang: Lang, timezoneOffsetMinutes: ClockTimezoneOffsetMinutes) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(toClockDate(now, timezoneOffsetMinutes));
}
