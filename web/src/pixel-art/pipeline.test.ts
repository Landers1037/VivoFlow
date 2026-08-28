import { describe, expect, it } from "vitest";
import { clampSettings, resolveAutoSettings, settingsForPreset } from "@/pixel-art/pipeline";
import type { ImageStats } from "@/pixel-art/types";
import type { PixelArtSettings } from "@/types";

const base: PixelArtSettings = {
  interval_s: 8,
  shuffle: false,
  preset: "balanced",
  target_short_edge: 128,
  palette_size: 32,
  smoothing: 0.18,
  contrast: 0.08,
  saturation: 0.08,
  gamma: 1,
  dithering: "ordered",
  dithering_strength: 0.2,
  edge_enhancement: 0.12,
  sharpen: 0.12,
};

describe("pixel-art settings", () => {
  it("clamps unsafe values and limits Floyd-Steinberg strength", () => {
    const result = clampSettings({ ...base, target_short_edge: 999, palette_size: 7, dithering: "floyd_steinberg", dithering_strength: 2, gamma: Number.NaN });
    expect(result.target_short_edge).toBe(256);
    expect(result.palette_size).toBe(32);
    expect(result.dithering_strength).toBe(0.35);
    expect(result.gamma).toBe(1);
  });

  it("applies the named presets without changing slideshow controls", () => {
    const result = settingsForPreset({ ...base, interval_s: 17, shuffle: true }, "8bit");
    expect(result.target_short_edge).toBe(80);
    expect(result.palette_size).toBe(16);
    expect(result.interval_s).toBe(17);
    expect(result.shuffle).toBe(true);
  });

  it("raises effective detail for an edge-rich image in auto mode", () => {
    const stats: ImageStats = {
      averageLuminance: 0.5,
      luminanceStdDev: 0.2,
      saturationMean: 0.4,
      saturationStdDev: 0.1,
      gradientMean: 0.4,
      gradientP90: 0.9,
      edgeDensity: 0.5,
      colorVariance: 0.9,
      darkRatio: 0.1,
      brightRatio: 0.1,
    };
    const result = resolveAutoSettings({ ...base, preset: "auto" }, stats);
    expect(result.preset).toBe("auto");
    expect(result.target_short_edge).toBeGreaterThan(base.target_short_edge);
    expect(result.palette_size).toBeGreaterThanOrEqual(base.palette_size);
  });
});
