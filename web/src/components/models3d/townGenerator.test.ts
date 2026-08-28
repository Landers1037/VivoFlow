import { describe, expect, it } from "vitest";
import { createTownLayout, populationCount } from "@/components/models3d/townGenerator";

describe("town generator", () => {
  it("recreates the exact same layout for the same inputs", () => {
    const first = createTownLayout("A1B2C3D4", 1, "medium", "medium", "day");
    const second = createTownLayout("a1b2c3d4", 1, "medium", "medium", "day");
    expect(second).toEqual(first);
  });

  it("changes the generated town when the seed changes", () => {
    const first = createTownLayout("00000001", 1, "medium", "medium", "day");
    const second = createTownLayout("00000002", 1, "medium", "medium", "day");
    expect(second).not.toEqual(first);
  });

  it("keeps the layout unchanged when switching between day and night", () => {
    const day = createTownLayout("89abcdef", 1, "medium", "medium", "day");
    const night = createTownLayout("89abcdef", 1, "medium", "medium", "night");
    expect(night.tiles).toEqual(day.tiles);
    expect(night.buildings).toEqual(day.buildings);
    expect(night.trees).toEqual(day.trees);
    expect(night.people).toEqual(day.people);
    expect(night.carRoutes).toEqual(day.carRoutes);
    expect(night.trainRoute).toEqual(day.trainRoute);
    expect(night.boatRoutes).toEqual(day.boatRoutes);
  });

  it("supports all five seeded terrain themes and their signature features", () => {
    const layouts = Array.from({ length: 512 }, (_, index) =>
      createTownLayout(index.toString(16).padStart(8, "0"), 1, "medium", "medium", "day"),
    );
    const themes = new Set(layouts.map((layout) => layout.theme));
    expect(themes).toEqual(new Set(["coast", "lake", "forest", "plain", "city"]));
    layouts.forEach((layout) => {
      expect(layout.tiles.length).toBe(64 * 64);
      expect(layout.buildings.length).toBeGreaterThanOrEqual(8);
      expect(layout.people.length).toBe(populationCount("medium"));
      layout.people.forEach((route) => route.points.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(-31);
        expect(point.x).toBeLessThanOrEqual(30);
        expect(point.z).toBeGreaterThanOrEqual(-31);
        expect(point.z).toBeLessThanOrEqual(30);
      }));
      if (layout.theme === "coast" || layout.theme === "lake") {
        expect(layout.boatRoutes.length).toBeGreaterThan(0);
        expect(layout.trainRoute).toBeNull();
      } else {
        expect(layout.trainRoute).not.toBeNull();
        expect(layout.boatRoutes).toHaveLength(0);
      }
    });
  });

  it("keeps population deterministic and responds to building density", () => {
    const low = createTownLayout("12345678", 1, "low", "low", "day");
    const high = createTownLayout("12345678", 1, "high", "high", "day");
    expect(low.people).toHaveLength(12);
    expect(high.people).toHaveLength(48);
    expect(high.buildings.length).toBeGreaterThanOrEqual(low.buildings.length);
  });
});
