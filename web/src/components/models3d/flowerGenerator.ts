import { MODEL3D_FLOWER_GENERATOR_VERSION, type Model3dFlowerType } from "@/types";

const DEFAULT_SEED = 0x7c4a2f91;

export interface FlowerProfile {
  heightScale: number;
  bloomScale: number;
  petalCount: number;
  rings: number;
  style: "rosette" | "cup" | "ray" | "star" | "orchid" | "spike" | "cluster";
}

export const FLOWER_PROFILES: Record<Model3dFlowerType, FlowerProfile> = {
  rose: { heightScale: 1, bloomScale: 1.05, petalCount: 8, rings: 3, style: "rosette" },
  tulip: { heightScale: 1.08, bloomScale: 1.08, petalCount: 6, rings: 1, style: "cup" },
  sunflower: { heightScale: 1.2, bloomScale: 1.3, petalCount: 14, rings: 1, style: "ray" },
  daisy: { heightScale: 0.94, bloomScale: 0.9, petalCount: 12, rings: 1, style: "ray" },
  lily: { heightScale: 1.12, bloomScale: 1.08, petalCount: 6, rings: 1, style: "star" },
  orchid: { heightScale: 0.92, bloomScale: 1, petalCount: 5, rings: 1, style: "orchid" },
  carnation: { heightScale: 0.98, bloomScale: 1.12, petalCount: 10, rings: 3, style: "rosette" },
  peony: { heightScale: 1, bloomScale: 1.3, petalCount: 10, rings: 4, style: "rosette" },
  lavender: { heightScale: 1.28, bloomScale: 0.72, petalCount: 6, rings: 4, style: "spike" },
  hydrangea: { heightScale: 0.9, bloomScale: 1.18, petalCount: 4, rings: 2, style: "cluster" },
};

export interface FlowerStemLayout {
  x: number;
  z: number;
  height: number;
  leanX: number;
  leanZ: number;
  bloomScale: number;
  bloomTilt: number;
  rotation: number;
  leafCount: number;
  leafPhase: number;
}

export interface FlowerLayout {
  seed: string;
  generatorVersion: number;
  flowerType: Model3dFlowerType;
  stems: FlowerStemLayout[];
}

export function createFlowerLayout(
  flowerType: Model3dFlowerType,
  seed: string,
  generatorVersion = MODEL3D_FLOWER_GENERATOR_VERSION,
): FlowerLayout {
  const normalizedSeed = normalizeFlowerSeed(seed);
  const version = Number.isFinite(generatorVersion) && generatorVersion > 0
    ? Math.floor(generatorVersion)
    : MODEL3D_FLOWER_GENERATOR_VERSION;
  const rng = mulberry32(mixSeed(parseInt(normalizedSeed, 16), version));
  const profile = FLOWER_PROFILES[flowerType];
  const stemCount = 3 + Math.floor(rng() * 5);
  const stems: FlowerStemLayout[] = [];

  for (let index = 0; index < stemCount; index += 1) {
    const angle = (index / stemCount) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    const radius = index === 0 ? 0.15 : 0.45 + rng() * 1.65;
    const height = (3.05 + rng() * 2.35) * profile.heightScale;
    stems.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      height,
      leanX: (rng() - 0.5) * 0.42,
      leanZ: (rng() - 0.5) * 0.42,
      bloomScale: profile.bloomScale * (0.88 + rng() * 0.25),
      bloomTilt: (rng() - 0.5) * 0.34,
      rotation: rng() * Math.PI * 2,
      leafCount: 2 + Math.floor(rng() * 3),
      leafPhase: rng() * Math.PI * 2,
    });
  }

  return { seed: normalizedSeed, generatorVersion: version, flowerType, stems };
}

export function normalizeFlowerSeed(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  return /^[0-9a-fA-F]{8}$/.test(value) ? value.toLowerCase() : DEFAULT_SEED.toString(16);
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(seed: number, version: number): number {
  return (seed ^ Math.imul(version >>> 0, 0x9e3779b9)) >>> 0;
}
