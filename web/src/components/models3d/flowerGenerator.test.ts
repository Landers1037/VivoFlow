import { describe, expect, it } from "vitest";
import { createFlowerLayout, FLOWER_PROFILES } from "@/components/models3d/flowerGenerator";
import { MODEL3D_FLOWER_TYPES } from "@/types";

describe("flower layout generator", () => {
  it("repeats the same layout for the same flower and seed", () => {
    const first = createFlowerLayout("rose", "A1B2C3D4");
    const second = createFlowerLayout("rose", "a1b2c3d4");

    expect(second).toEqual(first);
    expect(first.stems.length).toBeGreaterThanOrEqual(3);
    expect(first.stems.length).toBeLessThanOrEqual(7);
  });

  it("changes the layout when the seed changes", () => {
    const first = createFlowerLayout("rose", "11111111");
    const second = createFlowerLayout("rose", "22222222");

    expect(second).not.toEqual(first);
  });

  it("supports every catalog flower with valid stem values", () => {
    for (const flowerType of MODEL3D_FLOWER_TYPES) {
      const layout = createFlowerLayout(flowerType, "7c4a2f91");
      expect(layout.flowerType).toBe(flowerType);
      expect(layout.stems.length).toBeGreaterThanOrEqual(3);
      expect(layout.stems.length).toBeLessThanOrEqual(7);
      expect(FLOWER_PROFILES[flowerType]).toBeDefined();
      for (const stem of layout.stems) {
        expect(Number.isFinite(stem.x)).toBe(true);
        expect(Number.isFinite(stem.z)).toBe(true);
        expect(Number.isFinite(stem.height)).toBe(true);
        expect(stem.height).toBeGreaterThan(0);
        expect(stem.leafCount).toBeGreaterThanOrEqual(2);
        expect(stem.leafCount).toBeLessThanOrEqual(4);
      }
    }
  });

  it("normalizes malformed seeds to the stable default", () => {
    const malformed = createFlowerLayout("tulip", "not-a-seed");
    const fallback = createFlowerLayout("tulip", "7c4a2f91");

    expect(malformed).toEqual(fallback);
  });
});
