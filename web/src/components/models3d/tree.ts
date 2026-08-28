import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three/webgpu";
import type { Model3dTreeBaseShape, Model3dTreeCanopyShape } from "@/types";

const BLOCK = 0.4;
const BASE_HALF = 6;

export interface TreeLook {
  canopyShape: Model3dTreeCanopyShape;
  canopyColor: string;
  baseShape: Model3dTreeBaseShape;
  baseColor: string;
  trunkColor: string;
  variation: number;
}

export interface VoxelTreeHandle {
  scene: Scene;
  camera: PerspectiveCamera;
  orbitTarget: Vector3;
  minDistance: number;
  maxDistance: number;
  update: (time: number, reduced: boolean) => void;
  dispose: () => void;
}

type Kind = "trunk" | "leafA" | "leafB" | "leafC" | "stoneA" | "stoneB" | "accent";

export function createVoxelTree(preview: boolean, look: TreeLook): VoxelTreeHandle {
  const rng = mulberry32(look.variation >>> 0);
  const scale = pickCanopyScale(rng);
  const pagoda = look.canopyShape === "layered";
  const layers = pagoda ? 3 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 6);
  const scene = new Scene();
  scene.background = new Color(0xf3eee4);

  const targetY = pagoda ? 1.45 + scale * 1.05 : 1.55 + scale * 1.35;
  const distance = (preview ? 6.8 : 7.4) + scale * (pagoda ? 2.7 : 2.35);
  const camera = new PerspectiveCamera(preview ? 38 : 42, 1, 0.1, 80 + scale * 50);
  camera.position.set(distance, distance * (pagoda ? 0.7 : 0.86), distance);
  camera.lookAt(0, targetY, 0);

  scene.add(new AmbientLight(0xfff6ea, 0.82));
  scene.add(new HemisphereLight(0xfff8ee, 0xc4b49a, 0.55));
  const sun = new DirectionalLight(0xfff1d2, 1.35);
  sun.position.set(-6.5, 12 + scale * 3, 7.5);
  scene.add(sun);

  const voxels = buildVoxels(look, rng, scale, layers);
  const box = new BoxGeometry(BLOCK * 0.98, BLOCK * 0.98, BLOCK * 0.98);
  const dummy = new Object3D();
  const meshes: InstancedMesh[] = [];
  const palette = paletteFor(look);

  for (const [kind, color] of Object.entries(palette) as [Kind, number][]) {
    const cells = voxels.filter((voxel) => voxel.kind === kind);
    if (!cells.length) continue;
    const mesh = new InstancedMesh(box, new MeshLambertMaterial({ color }), cells.length);
    cells.forEach((voxel, index) => {
      dummy.position.set(voxel.x * BLOCK, voxel.y * BLOCK + BLOCK / 2, voxel.z * BLOCK);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshes.push(mesh);
  }

  const dispose = () => {
    box.dispose();
    for (const mesh of meshes) {
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
      scene.remove(mesh);
    }
  };

  return {
    scene,
    camera,
    orbitTarget: new Vector3(0, targetY, 0),
    minDistance: preview ? 6 + scale : 5 + scale,
    maxDistance: preview ? 16 + scale * 5 : 22 + scale * 8,
    update: () => {},
    dispose,
  };
}

function buildVoxels(look: TreeLook, rng: () => number, scale: number, layers: number) {
  const voxels: { x: number; y: number; z: number; kind: Kind }[] = [];
  const occupied = new Set<string>();
  const put = (x: number, y: number, z: number, kind: Kind) => {
    const key = `${x},${y},${z}`;
    if (occupied.has(key)) return;
    occupied.add(key);
    voxels.push({ x, y, z, kind });
  };

  const leafHalf = look.canopyShape === "layered" ? Math.max(3, Math.round(3 * scale)) : 0;
  const baseHalf =
    look.canopyShape === "layered"
      ? Math.max(BASE_HALF, leafHalf + 2)
      : BASE_HALF + Math.round((scale - 1) * 2);
  for (let x = -baseHalf; x <= baseHalf; x++) {
    for (let z = -baseHalf; z <= baseHalf; z++) {
      if (!inBase(x, z, baseHalf, look.baseShape)) continue;
      put(x, 0, z, ((x + z) & 1) === 0 ? "stoneA" : "stoneB");
    }
  }

  for (let x = -baseHalf; x <= baseHalf; x++) {
    for (let z = -baseHalf; z <= baseHalf; z++) {
      if (!occupied.has(`${x},0,${z}`)) continue;
      if (Math.abs(x) <= 1 && Math.abs(z) <= 1) continue;
      const onEdge = !inBase(x, z, baseHalf - 1, look.baseShape);
      if (onEdge && rng() > 0.48) put(x, 1, z, "accent");
      else if (!onEdge && rng() > 0.9) put(x, 1, z, rng() > 0.5 ? "leafA" : "leafB");
    }
  }

  if (look.canopyShape === "layered") {
    fillCanopy(look.canopyShape, rng, put, scale, layers, 0);
    return voxels;
  }

  const trunkTop = Math.round(6 + 2.4 * scale);
  for (const y of [1, 2]) {
    put(0, y, 0, "trunk");
    put(-1, y, 0, "trunk");
    put(0, y, -1, "trunk");
    put(-1, y, -1, "trunk");
  }
  for (let y = 3; y <= trunkTop; y++) put(0, y, 0, "trunk");
  put(1, trunkTop - 1, 0, "trunk");
  put(2, trunkTop - 1, 0, "trunk");
  put(-1, trunkTop, 0, "trunk");
  put(0, trunkTop - 1, 1, "trunk");
  put(0, trunkTop, -1, "trunk");
  put(1, trunkTop, -1, "trunk");
  if (scale > 1.2) {
    put(3, trunkTop - 1, 0, "trunk");
    put(-2, trunkTop, 0, "trunk");
    put(0, trunkTop - 1, 2, "trunk");
  }

  fillCanopy(look.canopyShape, rng, put, scale, layers, trunkTop);
  return voxels;
}

function fillCanopy(
  shape: Model3dTreeCanopyShape,
  rng: () => number,
  put: (x: number, y: number, z: number, kind: Kind) => void,
  scale: number,
  layers: number,
  trunkTop: number,
) {
  const leaf = (): Kind => {
    const roll = rng();
    if (roll > 0.66) return "leafA";
    if (roll > 0.33) return "leafB";
    return "leafC";
  };

  if (shape === "cone") {
    const y0 = Math.max(5, trunkTop - 1);
    const y1 = y0 + Math.round(10 * scale);
    const baseR = 4.4 * scale;
    const reach = Math.ceil(baseR);
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const radius = baseR * (1 - t) + 0.35;
      for (let x = -reach; x <= reach; x++) {
        for (let z = -reach; z <= reach; z++) {
          if (x * x + z * z <= radius * radius + 0.15) put(x, y, z, leaf());
        }
      }
    }
    return;
  }

  if (shape === "round") {
    const rx = 4.3 * scale;
    const ry = 3.4 * scale;
    const cy = trunkTop + 2.2 * scale;
    const reachX = Math.ceil(rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let x = -reachX; x <= reachX; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = -reachX; z <= reachX; z++) {
          const nx = x / rx;
          const ny = (y - cy) / ry;
          const nz = z / rx;
          if (nx * nx + ny * ny + nz * nz <= 1) put(x, y, z, leaf());
        }
      }
    }
    return;
  }

  fillLayered(put, scale, layers, leaf);
}

function fillLayered(
  put: (x: number, y: number, z: number, kind: Kind) => void,
  scale: number,
  layers: number,
  leaf: () => Kind,
) {
  const tiers = Math.max(3, Math.min(4, layers));
  const largest = Math.max(3, Math.round(3 * scale));
  const step = Math.max(1, Math.round((largest - 1) / Math.max(1, tiers - 1)));
  const thickness = 2;
  const y0 = 4 + Math.round(scale);

  const halves: number[] = [];
  for (let i = 0; i < tiers; i++) halves.push(Math.max(1, largest - i * step));

  const slabHeights = halves.map((half, i) => (i === tiers - 1 ? Math.max(2, half + 1) : thickness));

  for (let y = 1; y < y0; y++) put(0, y, 0, "trunk");

  let cursor = y0;
  for (let i = 0; i < tiers; i++) {
    const half = halves[i]!;
    const height = slabHeights[i]!;
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        for (let dy = 0; dy < height; dy++) put(x, cursor + dy, z, leaf());
      }
    }
    cursor += height;
  }
}

function pickCanopyScale(rng: () => number) {
  const roll = rng();
  if (roll < 0.34) return 1;
  if (roll < 0.67) return 1.5;
  return 2;
}

function inBase(x: number, z: number, half: number, shape: Model3dTreeBaseShape): boolean {
  if (shape === "square") return Math.abs(x) <= half && Math.abs(z) <= half;
  if (shape === "circle") return x * x + z * z <= half * half + 0.35;
  const nx = x / (half * 0.84);
  const ny = -z / (half * 0.84) + 0.12;
  const a = nx * nx + ny * ny - 1;
  return a * a * a - nx * nx * ny * ny * ny <= 0;
}

function paletteFor(look: TreeLook): Record<Kind, number> {
  const canopy = new Color(look.canopyColor);
  const base = new Color(look.baseColor);
  const trunk = new Color(look.trunkColor);
  return {
    trunk: trunk.getHex(),
    leafA: shift(canopy, 0.08, 0.04).getHex(),
    leafB: canopy.getHex(),
    leafC: shift(canopy, -0.07, -0.03).getHex(),
    stoneA: shift(base, 0.1, 0).getHex(),
    stoneB: shift(base, -0.08, 0).getHex(),
    accent: shift(canopy, 0.05, 0.06).getHex(),
  };
}

function shift(color: Color, lightness: number, hue: number) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return new Color().setHSL(
    (hsl.h + hue + 1) % 1,
    Math.min(1, Math.max(0.08, hsl.s * 0.92)),
    Math.min(0.86, Math.max(0.1, hsl.l + lightness)),
  );
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
