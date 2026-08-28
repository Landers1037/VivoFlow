import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
} from "three/webgpu";
import type { TownDensity, TownPopulation, TownTime } from "@/types";
import {
  createTownLayout,
  type TownBuilding,
  type TownLayout,
  type TownRoute,
  type TownTileKind,
  type TownTree,
} from "@/components/models3d/townGenerator";

const BLOCK = 1;

export interface TownLook {
  seed: string;
  generatorVersion: number;
  population: TownPopulation;
  density: TownDensity;
  time: TownTime;
}

export interface VoxelTownHandle {
  scene: Scene;
  camera: PerspectiveCamera;
  orbitTarget: Vector3;
  minDistance: number;
  maxDistance: number;
  update: (time: number, reduced: boolean) => void;
  dispose: () => void;
}

type Block = {
  x: number;
  y: number;
  z: number;
  color: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
};
type MaterialWithDispose = MeshStandardMaterial;
type Mover = { group: Group; route: TownRoute; offset: number; y: number; bob?: number };

export function createVoxelTown(preview: boolean, look: TownLook): VoxelTownHandle {
  const layout = createTownLayout(
    look.seed,
    look.generatorVersion,
    look.population,
    look.density,
    look.time,
  );
  const scene = new Scene();
  const night = layout.time === "night";
  const palette = makePalette(night);
  scene.background = new Color(night ? 0x071526 : 0x8fc9e6);
  scene.fog = null;

  const camera = new PerspectiveCamera(preview ? 45 : 52, 1, 0.1, 220);
  camera.position.set(0, preview ? 44 : 64, preview ? 42 : 60);
  camera.lookAt(0, 0, 0);

  scene.add(new AmbientLight(night ? 0x8ba6d1 : 0xfff3d9, night ? 0.96 : 0.82));
  scene.add(new HemisphereLight(night ? 0x4d6d9e : 0xc4e8ff, night ? 0x26364d : 0x5f6b46, night ? 1.05 : 0.76));
  const sun = new DirectionalLight(night ? 0xb8d1ff : 0xffefc2, night ? 1.05 : 1.25);
  sun.position.set(-24, 60, 28);
  scene.add(sun);
  if (night) {
    const moon = new PointLight(0x9bc5ff, 34, 100, 1.6);
    moon.position.set(-12, 34, -18);
    scene.add(moon);
  }

  const flatGeometry = new BoxGeometry(0.98, 1, 0.98);
  const blockGeometry = new BoxGeometry(0.92, 0.92, 0.92);
  const terrainBlocks = groupTerrainBlocks(layout, palette, preview);
  const buildingBlocks = groupBuildingBlocks(preview ? layout.buildings.filter((_, index) => index % 2 === 0) : layout.buildings, palette, night);
  const treeBlocks = groupTreeBlocks(preview ? layout.trees.filter((_, index) => index % 2 === 0) : layout.trees, palette);
  const waterfrontBlocks = groupWaterfrontBlocks(layout, palette);
  const meshes: InstancedMesh[] = [];
  const materials: MaterialWithDispose[] = [];
  addInstancedGroups(scene, flatGeometry, terrainBlocks, meshes, materials);
  addInstancedGroups(scene, blockGeometry, [...buildingBlocks, ...treeBlocks, ...waterfrontBlocks], meshes, materials);

  const dynamicMaterials = makeDynamicMaterials(palette, night);
  materials.push(...Object.values(dynamicMaterials));
  const movers: Mover[] = [];
  const dynamicGroups: Group[] = [];

  const carCount = preview ? 4 : 7;
  for (let i = 0; i < carCount; i++) {
    const route = layout.carRoutes[i % layout.carRoutes.length]!;
    const group = makeCar(blockGeometry, dynamicMaterials.car, dynamicMaterials.carRoof, i % 3);
    scene.add(group);
    dynamicGroups.push(group);
    movers.push({ group, route, offset: i / carCount, y: 0.72 });
  }

  const people = preview ? layout.people.slice(0, 18) : layout.people;
  people.forEach((route, index) => {
    const group = makePerson(blockGeometry, dynamicMaterials.person, dynamicMaterials.skin, index % 3);
    scene.add(group);
    dynamicGroups.push(group);
    movers.push({ group, route, offset: route.phase, y: 0.24, bob: 0.035 });
  });

  if (layout.trainRoute) {
    const trainCars = preview ? 2 : 4;
    for (let i = 0; i < trainCars; i++) {
      const group = makeTrainCar(blockGeometry, dynamicMaterials.train, dynamicMaterials.trainRoof, i === 0);
      scene.add(group);
      dynamicGroups.push(group);
      movers.push({ group, route: layout.trainRoute, offset: i / trainCars, y: 0.86 });
    }
  }

  layout.boatRoutes.forEach((route, index) => {
    const group = makeBoat(blockGeometry, dynamicMaterials.boat, dynamicMaterials.boatCabin, layout.theme === "lake" && index % 2 === 0);
    scene.add(group);
    dynamicGroups.push(group);
    movers.push({ group, route, offset: route.phase, y: 0.55, bob: 0.025 });
  });

  const startedAt = typeof performance !== "undefined" ? performance.now() / 1000 : 0;
  const orbitTarget = new Vector3(0, 0, 0);
  const update = (time: number, reduced: boolean) => {
    const elapsed = Math.max(0, time - startedAt);
    const motion = reduced ? 0.08 : 1;
    movers.forEach((mover) => {
      const state = positionOnRoute(mover.route, elapsed * motion, mover.offset);
      mover.group.position.set(state.x, mover.y + (mover.bob ?? 0) * Math.sin(elapsed * 2.5 * motion), state.z);
      mover.group.rotation.y = state.angle;
    });
  };

  const dispose = () => {
    for (const group of dynamicGroups) scene.remove(group);
    for (const mesh of meshes) scene.remove(mesh);
    flatGeometry.dispose();
    blockGeometry.dispose();
    for (const material of materials) material.dispose();
  };

  return {
    scene,
    camera,
    orbitTarget,
    minDistance: preview ? 42 : 42,
    maxDistance: preview ? 88 : 128,
    update,
    dispose,
  };
}

function groupTerrainBlocks(layout: TownLayout, palette: Record<TownTileKind, number>, preview: boolean): Block[] {
  if (!preview) {
    return layout.tiles.map((tile) => ({
      x: tile.x,
      y: tile.height / 2 - 0.04,
      z: tile.z,
      color: palette[tile.kind],
    }));
  }

  // The card still shows the complete outline, but merges each 2×2 tile block
  // into one instance so preview GPU work is roughly a quarter of full-screen.
  const tileMap = new Map(layout.tiles.map((tile) => [`${tile.x},${tile.z}`, tile]));
  const priority: TownTileKind[] = ["rail", "road", "water", "sand", "farm", "city", "forest", "grass"];
  const blocks: Block[] = [];
  for (let x = -32; x < 32; x += 2) {
    for (let z = -32; z < 32; z += 2) {
      const members = [
        tileMap.get(`${x},${z}`),
        tileMap.get(`${x + 1},${z}`),
        tileMap.get(`${x},${z + 1}`),
        tileMap.get(`${x + 1},${z + 1}`),
      ].filter((tile): tile is TownLayout["tiles"][number] => tile != null);
      if (members.length === 0) continue;
      const kind = priority.find((candidate) => members.some((tile) => tile.kind === candidate)) ?? "grass";
      const height = Math.max(...members.map((tile) => tile.height));
      blocks.push({
        x: x + 0.5,
        y: height / 2 - 0.04,
        z: z + 0.5,
        color: palette[kind],
        scaleX: 2,
        scaleZ: 2,
      });
    }
  }
  return blocks;
}

function groupBuildingBlocks(buildings: TownBuilding[], palette: Palette, night: boolean): Block[] {
  const blocks: Block[] = [];
  buildings.forEach((building) => {
    const body = palette.buildings[building.palette % palette.buildings.length]!;
    for (let dx = 0; dx < building.width; dx++) {
      for (let dz = 0; dz < building.depth; dz++) {
        for (let y = 0; y < building.height; y++) {
          const edge = dx === 0 || dz === 0 || dx === building.width - 1 || dz === building.depth - 1;
          if (y > 0 && !edge && (dx + dz + y) % 3 === 0) continue;
          blocks.push({ x: building.x + dx, y: 0.58 + y, z: building.z + dz, color: body });
        }
        if (night && building.height >= 2 && (dx + dz) % 2 === 0) {
          blocks.push({
            x: building.x + dx,
            y: 0.9 + Math.min(2, building.height - 1),
            z: building.z - 0.03,
            color: palette.window,
          });
        }
      }
    }
    for (let dx = -1; dx <= building.width; dx++) {
      blocks.push({ x: building.x + dx, y: 0.5, z: building.z - 1, color: palette.road });
    }
  });
  return blocks;
}

function groupTreeBlocks(trees: TownTree[], palette: Palette): Block[] {
  const blocks: Block[] = [];
  trees.forEach((tree) => {
    blocks.push({ x: tree.x, y: 0.66, z: tree.z, color: palette.trunk });
    for (let y = 0; y < tree.height; y++) {
      const radius = y === tree.height - 1 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
          blocks.push({ x: tree.x + dx, y: 1.2 + y, z: tree.z + dz, color: palette.leaves[tree.palette % palette.leaves.length]! });
        }
      }
    }
  });
  return blocks;
}

function groupWaterfrontBlocks(layout: TownLayout, palette: Palette): Block[] {
  if (layout.theme !== "coast") return [];
  const water = layout.tiles.filter((tile) => tile.kind === "water");
  if (water.length === 0) return [];
  const side = water.reduce((sum, tile) => sum + tile.z, 0) > 0 ? 1 : -1;
  const blocks: Block[] = [];
  for (let x = -8; x <= 8; x++) {
    for (let depth = 0; depth < 7; depth++) {
      blocks.push({ x, y: 0.42, z: side * (22 + depth), color: palette.rail });
    }
    blocks.push({ x, y: 0.8, z: side * 22, color: palette.trunk });
    blocks.push({ x, y: 0.8, z: side * 28, color: palette.trunk });
  }
  return blocks;
}

function addInstancedGroups(
  scene: Scene,
  geometry: BoxGeometry,
  blocks: Block[],
  meshes: InstancedMesh[],
  materials: MaterialWithDispose[],
) {
  const groups = new Map<number, Block[]>();
  blocks.forEach((block) => {
    const current = groups.get(block.color) ?? [];
    current.push(block);
    groups.set(block.color, current);
  });
  const dummy = new Object3D();
  groups.forEach((items, color) => {
    const material = new MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02, flatShading: true });
    const mesh = new InstancedMesh(geometry, material, items.length);
    items.forEach((block, index) => {
      dummy.position.set(block.x * BLOCK, block.y * BLOCK, block.z * BLOCK);
      dummy.scale.set(block.scaleX ?? 1, block.scaleY ?? 1, block.scaleZ ?? 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshes.push(mesh);
    materials.push(material);
  });
}

function makeDynamicMaterials(palette: Palette, night: boolean) {
  const windowMaterial = new MeshStandardMaterial({
    color: palette.window,
    emissive: night ? palette.window : 0x000000,
    emissiveIntensity: night ? 1.8 : 0,
    roughness: 0.36,
    flatShading: true,
  });
  return {
    car: new MeshStandardMaterial({ color: palette.car, roughness: 0.55, flatShading: true }),
    carRoof: new MeshStandardMaterial({ color: palette.carRoof, roughness: 0.62, flatShading: true }),
    person: new MeshStandardMaterial({ color: palette.person, roughness: 0.9, flatShading: true }),
    skin: new MeshStandardMaterial({ color: palette.skin, roughness: 0.9, flatShading: true }),
    train: new MeshStandardMaterial({ color: palette.train, roughness: 0.55, flatShading: true }),
    trainRoof: new MeshStandardMaterial({ color: palette.trainRoof, roughness: 0.65, flatShading: true }),
    boat: new MeshStandardMaterial({ color: palette.boat, roughness: 0.6, flatShading: true }),
    boatCabin: new MeshStandardMaterial({ color: palette.boatCabin, roughness: 0.7, flatShading: true }),
    window: windowMaterial,
  };
}

function makeCar(geometry: BoxGeometry, body: MeshStandardMaterial, roof: MeshStandardMaterial, variant: number): Group {
  const group = new Group();
  const bodyMesh = new Mesh(geometry, body);
  bodyMesh.scale.set(1.3, 0.42, 0.72);
  bodyMesh.position.y = 0.08;
  group.add(bodyMesh);
  const roofMesh = new Mesh(geometry, roof);
  roofMesh.scale.set(0.65, 0.28, 0.58);
  roofMesh.position.set(variant === 1 ? -0.1 : 0.08, 0.42, 0);
  group.add(roofMesh);
  return group;
}

function makePerson(geometry: BoxGeometry, body: MeshStandardMaterial, skin: MeshStandardMaterial, variant: number): Group {
  const group = new Group();
  const bodyMesh = new Mesh(geometry, body);
  bodyMesh.scale.set(0.34, 0.72 + variant * 0.04, 0.34);
  bodyMesh.position.y = 0.37;
  group.add(bodyMesh);
  const head = new Mesh(geometry, skin);
  head.scale.set(0.36, 0.36, 0.36);
  head.position.y = 0.92 + variant * 0.02;
  group.add(head);
  return group;
}

function makeTrainCar(geometry: BoxGeometry, body: MeshStandardMaterial, roof: MeshStandardMaterial, engine: boolean): Group {
  const group = new Group();
  const bodyMesh = new Mesh(geometry, body);
  bodyMesh.scale.set(engine ? 1.8 : 1.55, 0.58, 0.86);
  bodyMesh.position.y = 0.28;
  group.add(bodyMesh);
  const roofMesh = new Mesh(geometry, roof);
  roofMesh.scale.set(engine ? 1.86 : 1.62, 0.16, 0.9);
  roofMesh.position.y = 0.66;
  group.add(roofMesh);
  return group;
}

function makeBoat(geometry: BoxGeometry, hull: MeshStandardMaterial, cabin: MeshStandardMaterial, fishing: boolean): Group {
  const group = new Group();
  const hullMesh = new Mesh(geometry, hull);
  hullMesh.scale.set(fishing ? 1.5 : 2.4, 0.28, fishing ? 0.72 : 1.05);
  hullMesh.position.y = 0.03;
  group.add(hullMesh);
  const cabinMesh = new Mesh(geometry, cabin);
  cabinMesh.scale.set(fishing ? 0.54 : 0.9, fishing ? 0.48 : 0.72, fishing ? 0.5 : 0.72);
  cabinMesh.position.set(fishing ? -0.16 : 0.18, 0.42, 0);
  group.add(cabinMesh);
  return group;
}

function positionOnRoute(route: TownRoute, elapsed: number, offset: number) {
  const points = route.points;
  if (points.length === 0) return { x: 0, z: 0, angle: 0 };
  if (points.length === 1) return { x: points[0]!.x, z: points[0]!.z, angle: 0 };
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    lengths.push(length);
    total += length;
  }
  const distance = ((route.phase + offset + elapsed * route.speed) % 1 + 1) % 1 * total;
  let cursor = 0;
  for (let i = 0; i < points.length; i++) {
    const length = lengths[i]!;
    if (distance <= cursor + length || i === points.length - 1) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const t = length ? (distance - cursor) / length : 0;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        angle: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    cursor += length;
  }
  return { x: points[0]!.x, z: points[0]!.z, angle: 0 };
}

interface Palette {
  grass: number;
  water: number;
  sand: number;
  road: number;
  farm: number;
  city: number;
  forest: number;
  rail: number;
  buildings: number[];
  trunk: number;
  leaves: number[];
  window: number;
  car: number;
  carRoof: number;
  person: number;
  skin: number;
  train: number;
  trainRoof: number;
  boat: number;
  boatCabin: number;
}

function makePalette(night: boolean): Palette {
  const base: Palette = {
    grass: 0x729c58,
    water: 0x3d93b1,
    sand: 0xd4bd79,
    road: 0x5d5c58,
    farm: 0xb7a25d,
    city: 0x8c8e89,
    forest: 0x4d7549,
    rail: 0x71685d,
    buildings: [0xd7b777, 0xb67662, 0x82a5a1, 0xc1a2ca, 0xd0d2c0],
    trunk: 0x664329,
    leaves: [0x3f7045, 0x54874b, 0x6f9a4f],
    window: 0xffd36a,
    car: 0xb84d45,
    carRoof: 0xd5d4c7,
    person: 0x4c67a8,
    skin: 0xd4a37a,
    train: 0xd7a34d,
    trainRoof: 0x4e5560,
    boat: 0x365f7d,
    boatCabin: 0xe6dfc5,
  };
  if (!night) return base;
  const darken = (color: number, amount: number) => new Color(color).multiplyScalar(amount).getHex();
  return {
    ...base,
    grass: darken(base.grass, 0.88),
    water: darken(base.water, 0.92),
    sand: darken(base.sand, 0.88),
    road: darken(base.road, 0.78),
    farm: darken(base.farm, 0.86),
    city: darken(base.city, 0.82),
    forest: darken(base.forest, 0.82),
    rail: darken(base.rail, 0.82),
    buildings: base.buildings.map((color) => darken(color, 0.86)),
    trunk: darken(base.trunk, 0.82),
    leaves: base.leaves.map((color) => darken(color, 0.82)),
    car: 0x7b3c54,
    carRoof: 0x8b9099,
    person: 0x4a5589,
    train: 0xb86d3c,
    trainRoof: 0x363b4d,
    boat: 0x284a67,
    boatCabin: 0xb4b3a5,
  };
}
