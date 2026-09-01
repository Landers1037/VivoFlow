import { describe, expect, it } from "vitest";
import { audioBinForUv, depthForMode, particleBudget } from "./particleData";

describe("particle data helpers", () => {
  it("uses bounded device budgets", () => {
    expect(particleBudget(true, false)).toBe(12_000);
    expect(particleBudget(false, true)).toBe(24_000);
    expect(particleBudget(false, false)).toBe(65_536);
  });

  it("maps horizontal image coordinates to all 64 audio bins", () => {
    expect(audioBinForUv(-1)).toBe(0);
    expect(audioBinForUv(0.5)).toBe(32);
    expect(audioBinForUv(1)).toBe(63);
  });

  it("keeps plane flat and gives relief and cloud distinct depth", () => {
    expect(depthForMode("plane", 1, 1, 1, 2)).toBe(0);
    expect(depthForMode("relief", 1, 0, 0, 1)).toBeCloseTo(0.4);
    expect(depthForMode("cloud", 0.5, 0, 1, 1)).toBeCloseTo(0.7);
  });
});
