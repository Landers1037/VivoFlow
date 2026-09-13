import type { ClockFont } from "@/types";

export const CLOCK_FONT_STACKS: Record<Exclude<ClockFont, "default">, string> = {
  outfit: 'Outfit, "Noto Sans SC", system-ui, sans-serif',
  jua: 'Jua, "Noto Sans SC", system-ui, sans-serif',
  monomaniac_one: '"Monomaniac One", "Noto Sans SC", system-ui, sans-serif',
  bungee_shade: '"Bungee Shade", "Noto Sans SC", system-ui, sans-serif',
};

export function getSelectedClockFontStack(font: ClockFont): string | undefined {
  return font === "default" ? undefined : CLOCK_FONT_STACKS[font];
}

export function getLiquidGlassClockFontStack(font: ClockFont): string {
  return getSelectedClockFontStack(font) ?? CLOCK_FONT_STACKS.jua;
}
