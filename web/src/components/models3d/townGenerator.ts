import { MODEL3D_TOWN_GENERATOR_VERSION } from "@/types";
import type { TownDensity, TownPopulation, TownTime } from "@/types";

export const TOWN_GENERATOR_VERSION = MODEL3D_TOWN_GENERATOR_VERSION;
export const TOWN_SIZE = 64;
const HALF = TOWN_SIZE / 2;

export type TownTheme = "coast" | "lake" | "forest" | "plain" | "city";
export type TownTileKind = "grass" | "water" | "sand" | "road" | "farm" | "city" | "forest" | "rail";

export interface TownTile {
  x: number;
  z: number;
  kind: TownTileKind;
  height: number;
}

export interface TownBuilding {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  palette: number;
}

export interface TownTree {
  x: number;
  z: number;
  height: number;
  palette: number;
}

export interface TownRoute {
  points: Array<{ x: number; z: number }>;
  phase: number;
  speed: number;
  scale: number;
}

export interface TownLayout {
  seed: string;
  seedNumber: number;
  generatorVersion: number;
  theme: TownTheme;
  time: TownTime;
  size: number;
  tiles: TownTile[];
  buildings: TownBuilding[];
  trees: TownTree[];
  carRoutes: TownRoute[];
  people: TownRoute[];
  trainRoute: TownRoute | null;
  boatRoutes: TownRoute[];
}

const POPULATION_COUNTS: Record<TownPopulation, number> = { low: 12, medium: 28, high: 48 };
const DENSITY_RATIOS: Record<TownDensity, number> = { low: 0.35, medium: 0.6, high: 0.8 };

export function createTownLayout(
  seed: string,
  generatorVersion: number,
  population: TownPopulation,
  density: TownDensity,
  time: TownTime,
): TownLayout {
  const seedNumber = parseSeed(seed);
  const version = Number.isFinite(generatorVersion) && generatorVersion > 0 ? Math.floor(generatorVersion) : TOWN_GENERATOR_VERSION;
  const themeRng = mulberry32(mixSeed(seedNumber, version, 0x9e3779b9));
  const theme = (['coast', 'lake', 'forest', 'plain', 'city'] as const)[Math.floor(themeRng() * 5)] ?? "plain";
  const rng = mulberry32(mixSeed(seedNumber, version, 0x243f6a88));
  const coastSide = seedNumber & 1 ? 1 : -1;
  const tiles = makeTiles(theme, rng, coastSide);
  const buildings = makeBuildings(theme, density, rng, tiles);
  const trees = makeTrees(theme, rng, tiles);
  const carRoutes = makeCarRoutes(rng);
  const people = makePeople(population, rng, tiles);
  const trainRoute = hasRail(theme) ? makeTrainRoute(rng) : null;
  const boatRoutes = theme === "coast" || theme === "lake" ? makeBoatRoutes(theme, rng, coastSide) : [];
  return {
    seed: normalizeSeed(seed),
    seedNumber,
    generatorVersion: version,
    theme,
    time,
    size: TOWN_SIZE,
    tiles,
    buildings,
    trees,
    carRoutes,
    people,
    trainRoute,
    boatRoutes,
  };
}

export function normalizeSeed(seed: string | null | undefined): string {
  const value = (seed ?? "").trim();
  return /^[0-9a-fA-F]{8}$/.test(value) ? value.toLowerCase() : "6f3a9c21";
}

export function parseSeed(seed: string): number {
  const value = Number.parseInt(normalizeSeed(seed), 16);
  return Number.isFinite(value) ? value >>> 0 : 0x6f3a9c21;
}

export function populationCount(population: TownPopulation): number {
  return POPULATION_COUNTS[population];
}

export function densityRatio(density: TownDensity): number {
  return DENSITY_RATIOS[density];
}

function makeTiles(theme: TownTheme, rng: () => number, coastSide: number): TownTile[] {
  const tiles: TownTile[] = [];
  const lakeX = Math.round((rng() - 0.5) * 10);
  const lakeZ = Math.round((rng() - 0.5) * 8);
  const lakeRx = 8 + Math.floor(rng() * 5);
  const lakeRz = 7 + Math.floor(rng() * 4);
  const rail = hasRail(theme);

  for (let x = -HALF; x < HALF; x++) {
    for (let z = -HALF; z < HALF; z++) {
      let kind: TownTileKind = theme === "city" && Math.hypot(x, z) < 27 ? "city" : "grass";
      const distance = Math.hypot(x, z);
      if (theme === "plain" && distance > 17 && ((Math.floor((x + 32) / 8) + Math.floor((z + 32) / 8)) & 1) === 0) {
        kind = "farm";
      }
      if (theme === "forest" && distance > 13 && rng() > 0.52) kind = "forest";

      if (theme === "coast") {
        const shore = coastSide > 0 ? z > 23 : z < -23;
        const beach = coastSide > 0 ? z > 20 : z < -20;
        if (shore) kind = "water";
        else if (beach) kind = "sand";
      }
      if (theme === "lake") {
        const nx = (x - lakeX) / lakeRx;
        const nz = (z - lakeZ) / lakeRz;
        const inside = nx * nx + nz * nz < 1;
        const near = nx * nx + nz * nz < 1.28;
        if (inside) kind = "water";
        else if (near) kind = "sand";
      }

      if (rail && isRailCell(x, z)) kind = "rail";
      if (kind !== "water" && kind !== "sand" && kind !== "rail" && isRoadCell(x, z)) kind = "road";
      tiles.push({ x, z, kind, height: tileHeight(kind, rng) });
    }
  }
  return tiles;
}

function makeBuildings(theme: TownTheme, density: TownDensity, rng: () => number, tiles: TownTile[]): TownBuilding[] {
  const result: TownBuilding[] = [];
  const ratio = densityRatio(density);
  const tileMap = new Map(tiles.map((tile) => [`${tile.x},${tile.z}`, tile.kind]));
  for (let x = -25; x <= 24; x += 5) {
    for (let z = -25; z <= 24; z += 5) {
      if (Math.hypot(x, z) > 27 || rng() > ratio) continue;
      if (!lotIsBuildable(x, z, tileMap)) continue;
      const width = 2 + Math.floor(rng() * 3);
      const depth = 2 + Math.floor(rng() * 3);
      const height = theme === "city" ? 4 + Math.floor(rng() * 6) : 2 + Math.floor(rng() * 5);
      result.push({ x, z, width, depth, height, palette: Math.floor(rng() * 5) });
    }
  }
  if (result.length < 8) {
    const fallback = [
      [-9, -9],
      [6, -9],
      [-9, 6],
      [6, 6],
      [0, -14],
      [14, 0],
      [-14, 0],
      [0, 14],
    ];
    for (const [x, z] of fallback) {
      if (lotIsBuildable(x, z, tileMap) && !result.some((building) => building.x === x && building.z === z)) {
        result.push({ x, z, width: 3, depth: 3, height: 3 + Math.floor(rng() * 3), palette: Math.floor(rng() * 5) });
      }
    }
    for (let x = -22; x <= 18 && result.length < 8; x += 3) {
      for (let z = -22; z <= 18 && result.length < 8; z += 3) {
        if (!lotIsBuildable(x, z, tileMap) || result.some((building) => building.x === x && building.z === z)) continue;
        result.push({ x, z, width: 3, depth: 3, height: 3 + Math.floor(rng() * 3), palette: Math.floor(rng() * 5) });
      }
    }
  }
  return result;
}

function makeTrees(theme: TownTheme, rng: () => number, tiles: TownTile[]): TownTree[] {
  const result: TownTree[] = [];
  const tileMap = new Map(tiles.map((tile) => [`${tile.x},${tile.z}`, tile.kind]));
  const probability = theme === "forest" ? 0.37 : theme === "plain" ? 0.12 : 0.08;
  for (let x = -29; x <= 28; x += 2) {
    for (let z = -29; z <= 28; z += 2) {
      if (Math.hypot(x, z) < 18 || rng() > probability) continue;
      const kind = tileMap.get(`${x},${z}`);
      if (kind === "water" || kind === "sand" || kind === "road" || kind === "rail" || kind === "city") continue;
      result.push({ x, z, height: 2 + Math.floor(rng() * 3), palette: Math.floor(rng() * 3) });
    }
  }
  return result;
}

function makeCarRoutes(rng: () => number): TownRoute[] {
  const loops = [
    routeFromPoints([
      { x: -21, z: -16 },
      { x: 21, z: -16 },
      { x: 21, z: 16 },
      { x: -21, z: 16 },
    ], rng, 0.055, 0.7),
    routeFromPoints([
      { x: -16, z: -21 },
      { x: 16, z: -21 },
      { x: 16, z: 21 },
      { x: -16, z: 21 },
    ], rng, 0.047, 0.62),
  ];
  return loops;
}

function makePeople(population: TownPopulation, rng: () => number, tiles: TownTile[]): TownRoute[] {
  const count = populationCount(population);
  const available = tiles.filter((tile) => tile.kind !== "water" && tile.kind !== "rail");
  const routes: TownRoute[] = [];
  for (let i = 0; i < count; i++) {
    const start = available[Math.floor(rng() * available.length)] ?? { x: 0, z: 0 };
    const points = [
      { x: clampPersonCoordinate(start.x), z: clampPersonCoordinate(start.z) },
      {
        x: clampPersonCoordinate(start.x + Math.round((rng() - 0.5) * 6)),
        z: clampPersonCoordinate(start.z + Math.round((rng() - 0.5) * 6)),
      },
      {
        x: clampPersonCoordinate(start.x + Math.round((rng() - 0.5) * 6)),
        z: clampPersonCoordinate(start.z + Math.round((rng() - 0.5) * 6)),
      },
    ];
    routes.push(routeFromPoints(points, rng, 0.012 + rng() * 0.008, 0.14 + rng() * 0.05));
  }
  return routes;
}

function makeTrainRoute(rng: () => number): TownRoute {
  const radius = HALF - 5;
  return routeFromPoints([
    { x: -radius, z: -radius },
    { x: radius, z: -radius },
    { x: radius, z: radius },
    { x: -radius, z: radius },
  ], rng, 0.023, 1.4);
}

function makeBoatRoutes(theme: TownTheme, rng: () => number, coastSide: number): TownRoute[] {
  if (theme === "coast") {
    return [
      routeFromPoints(
        coastSide > 0
          ? [{ x: -18, z: 27 }, { x: 18, z: 27 }]
          : [{ x: 18, z: -27 }, { x: -18, z: -27 }],
        rng,
        0.015,
        1.4,
      ),
    ];
  }
  return [
    routeFromPoints([
      { x: -6, z: 0 },
      { x: 0, z: -5 },
      { x: 7, z: 0 },
      { x: 0, z: 5 },
    ], rng, 0.012, 1),
  ];
}

function routeFromPoints(points: Array<{ x: number; z: number }>, rng: () => number, speed: number, scale: number): TownRoute {
  return { points, phase: rng(), speed, scale };
}

function tileHeight(kind: TownTileKind, rng: () => number): number {
  if (kind === "water") return 0.08;
  if (kind === "road") return 0.14;
  if (kind === "rail") return 0.16;
  if (kind === "sand") return 0.12;
  return 0.2 + rng() * 0.12;
}

function clampPersonCoordinate(value: number): number {
  return Math.max(-HALF + 1, Math.min(HALF - 2, value));
}

function isRoadCell(x: number, z: number): boolean {
  const inside = Math.abs(x) <= 23 && Math.abs(z) <= 23;
  return inside && (x % 8 === 0 || z % 8 === 0 || (Math.abs(x) < 2 && Math.abs(z) < 24) || (Math.abs(z) < 2 && Math.abs(x) < 24));
}

function isRailCell(x: number, z: number): boolean {
  const radius = HALF - 5;
  return (Math.abs(x) === radius && Math.abs(z) <= radius) || (Math.abs(z) === radius && Math.abs(x) <= radius);
}

function lotIsBuildable(x: number, z: number, tileMap: Map<string, TownTileKind>): boolean {
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) {
      const kind = tileMap.get(`${x + dx},${z + dz}`);
      if (!kind || kind === "water" || kind === "sand" || kind === "road" || kind === "rail" || kind === "forest") return false;
    }
  }
  return true;
}

function hasRail(theme: TownTheme): boolean {
  return theme === "forest" || theme === "plain" || theme === "city";
}

function mixSeed(seed: number, version: number, salt: number): number {
  let value = (seed ^ Math.imul(version, 0x45d9f3b) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
