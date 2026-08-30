import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
} from "three/webgpu";
import type { Model3dFlowerPotShape, Model3dFlowerType } from "@/types";
import { createFlowerLayout, FLOWER_PROFILES, type FlowerStemLayout } from "@/components/models3d/flowerGenerator";

export interface FlowerLook {
  flowerType: Model3dFlowerType;
  petalColor: string;
  foliageColor: string;
  potShape: Model3dFlowerPotShape;
  potColor: string;
  seed: string;
  generatorVersion: number;
}

export interface VoxelFlowerHandle {
  scene: Scene;
  camera: PerspectiveCamera;
  orbitTarget: Vector3;
  minDistance: number;
  maxDistance: number;
  update: (time: number, reduced: boolean) => void;
  dispose: () => void;
}

interface PotResult {
  topY: number;
}

export function createVoxelFlower(preview: boolean, look: FlowerLook): VoxelFlowerHandle {
  const scene = new Scene();
  scene.background = new Color(0xf3eee4);

  const layout = createFlowerLayout(look.flowerType, look.seed, look.generatorVersion);
  const profile = FLOWER_PROFILES[look.flowerType];
  const geometries: Array<{ dispose: () => void }> = [];
  const materials: MeshLambertMaterial[] = [];
  const meshes: Mesh[] = [];
  const materialCache = new Map<string, MeshLambertMaterial>();
  const geometryCache = {
    petal: trackGeometry(new SphereGeometry(1, preview ? 6 : 8, preview ? 4 : 5)),
    center: trackGeometry(new SphereGeometry(1, preview ? 6 : 8, preview ? 4 : 5)),
    leaf: trackGeometry(new SphereGeometry(1, 6, 4)),
    stem: trackGeometry(new CylinderGeometry(1, 1.12, 1, 6)),
  };

  function trackGeometry<T extends { dispose: () => void }>(geometry: T): T {
    geometries.push(geometry);
    return geometry;
  }

  function materialFor(raw: string | number | Color): MeshLambertMaterial {
    const color = new Color(raw);
    const key = color.getHexString();
    const cached = materialCache.get(key);
    if (cached) return cached;
    const material = new MeshLambertMaterial({ color: color.getHex(), flatShading: true });
    materialCache.set(key, material);
    materials.push(material);
    return material;
  }

  const petalColor = new Color(look.petalColor);
  const foliageColor = new Color(look.foliageColor);
  const potColor = new Color(look.potColor);
  const petalMaterial = materialFor(petalColor);
  const petalLightMaterial = materialFor(shift(petalColor, 0.08, 0.01));
  const petalDarkMaterial = materialFor(shift(petalColor, -0.08, -0.01));
  const foliageMaterial = materialFor(foliageColor);
  const foliageLightMaterial = materialFor(shift(foliageColor, 0.09, 0));
  const potMaterial = materialFor(potColor);
  const potLightMaterial = materialFor(shift(potColor, 0.1, 0));
  const potDarkMaterial = materialFor(shift(potColor, -0.12, 0));
  const soilMaterial = materialFor(0x3d2d23);
  const centerMaterial = materialFor(0xe7ab37);

  scene.add(new AmbientLight(0xfff7ed, 0.86));
  scene.add(new HemisphereLight(0xfff9f0, 0xc0a98d, 0.56));
  const sun = new DirectionalLight(0xfff0d5, 1.3);
  sun.position.set(-6, 12, 7);
  scene.add(sun);

  const pot = createPot(
    scene,
    look.potShape,
    potMaterial,
    potLightMaterial,
    potDarkMaterial,
    soilMaterial,
    trackGeometry,
    meshes,
  );
  const baseY = pot.topY + 0.12;

  for (const stem of layout.stems) {
    addStem(
      scene,
      stem,
      baseY,
      geometryCache.stem,
      foliageMaterial,
      meshes,
    );
    addLeaves(
      scene,
      stem,
      baseY,
      geometryCache.leaf,
      foliageMaterial,
      foliageLightMaterial,
      meshes,
    );
    addBloom(
      scene,
      look.flowerType,
      stem,
      baseY,
      geometryCache.petal,
      geometryCache.center,
      petalMaterial,
      petalLightMaterial,
      petalDarkMaterial,
      centerMaterial,
      meshes,
    );
  }

  const targetY = baseY + (profile.heightScale > 1.15 ? 2.9 : 2.55);
  const distance = preview ? 8.8 : 9.8;
  const camera = new PerspectiveCamera(preview ? 37 : 42, 1, 0.1, 80);
  camera.position.set(distance, distance * 0.82, distance);
  camera.lookAt(0, targetY, 0);

  const dispose = () => {
    for (const mesh of meshes) scene.remove(mesh);
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
  };

  return {
    scene,
    camera,
    orbitTarget: new Vector3(0, targetY, 0),
    minDistance: preview ? 6.8 : 5.8,
    maxDistance: preview ? 18 : 24,
    update: () => {},
    dispose,
  };
}

function createPot(
  scene: Scene,
  shape: Model3dFlowerPotShape,
  potMaterial: MeshLambertMaterial,
  lightMaterial: MeshLambertMaterial,
  darkMaterial: MeshLambertMaterial,
  soilMaterial: MeshLambertMaterial,
  trackGeometry: <T extends { dispose: () => void }>(geometry: T) => T,
  meshes: Mesh[],
): PotResult {
  const add = (mesh: Mesh) => {
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  };

  if (shape === "square") {
    const body = add(new Mesh(trackGeometry(new BoxGeometry(2.75, 1.35, 2.75)), potMaterial));
    body.position.y = 0.68;
    const rim = add(new Mesh(trackGeometry(new BoxGeometry(2.95, 0.22, 2.95)), lightMaterial));
    rim.position.y = 1.37;
    const soil = add(new Mesh(trackGeometry(new BoxGeometry(2.35, 0.08, 2.35)), soilMaterial));
    soil.position.y = 1.5;
    return { topY: 1.54 };
  }

  if (shape === "pedestal") {
    const foot = add(new Mesh(trackGeometry(new CylinderGeometry(1.58, 1.7, 0.48, 8)), darkMaterial));
    foot.position.y = 0.24;
    const stem = add(new Mesh(trackGeometry(new CylinderGeometry(0.82, 1.02, 1.08, 8)), lightMaterial));
    stem.position.y = 1.02;
    const body = add(new Mesh(trackGeometry(new CylinderGeometry(1.08, 1.32, 1.28, 8)), potMaterial));
    body.position.y = 1.8;
    const rim = add(new Mesh(trackGeometry(new CylinderGeometry(1.22, 1.22, 0.2, 8)), lightMaterial));
    rim.position.y = 2.48;
    const soil = add(new Mesh(trackGeometry(new CylinderGeometry(0.98, 0.98, 0.08, 8)), soilMaterial));
    soil.position.y = 2.62;
    return { topY: 2.66 };
  }

  const body = add(new Mesh(trackGeometry(new CylinderGeometry(1.28, 1.5, 1.45, 10)), potMaterial));
  body.position.y = 0.73;
  const rim = add(new Mesh(trackGeometry(new CylinderGeometry(1.45, 1.45, 0.22, 10)), lightMaterial));
  rim.position.y = 1.47;
  const soil = add(new Mesh(trackGeometry(new CylinderGeometry(1.2, 1.2, 0.08, 10)), soilMaterial));
  soil.position.y = 1.62;
  return { topY: 1.66 };
}

function addStem(
  scene: Scene,
  stem: FlowerStemLayout,
  baseY: number,
  geometry: SphereGeometry | CylinderGeometry,
  material: MeshLambertMaterial,
  meshes: Mesh[],
) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(
    stem.x + stem.leanX * 0.5,
    baseY + stem.height * 0.5,
    stem.z + stem.leanZ * 0.5,
  );
  mesh.scale.set(0.09, stem.height, 0.09);
  mesh.rotation.z = -stem.leanX;
  mesh.rotation.x = stem.leanZ;
  scene.add(mesh);
  meshes.push(mesh);
}

function addLeaves(
  scene: Scene,
  stem: FlowerStemLayout,
  baseY: number,
  geometry: SphereGeometry,
  material: MeshLambertMaterial,
  lightMaterial: MeshLambertMaterial,
  meshes: Mesh[],
) {
  for (let index = 0; index < stem.leafCount; index += 1) {
    const progress = (index + 1) / (stem.leafCount + 1);
    const angle = stem.leafPhase + index * 2.35;
    const side = index % 2 === 0 ? 1 : -1;
    const leaf = new Mesh(geometry, index % 3 === 0 ? lightMaterial : material);
    leaf.position.set(
      stem.x + stem.leanX * progress + Math.cos(angle) * 0.22 * side,
      baseY + stem.height * progress,
      stem.z + stem.leanZ * progress + Math.sin(angle) * 0.22 * side,
    );
    leaf.scale.set(0.16, 0.07, 0.52);
    leaf.rotation.y = angle;
    leaf.rotation.z = side * 0.26;
    leaf.rotation.x = -0.18 + progress * 0.12;
    scene.add(leaf);
    meshes.push(leaf);
  }
}

function addBloom(
  scene: Scene,
  flowerType: Model3dFlowerType,
  stem: FlowerStemLayout,
  baseY: number,
  petalGeometry: SphereGeometry,
  centerGeometry: SphereGeometry,
  petalMaterial: MeshLambertMaterial,
  petalLightMaterial: MeshLambertMaterial,
  petalDarkMaterial: MeshLambertMaterial,
  centerMaterial: MeshLambertMaterial,
  meshes: Mesh[],
) {
  const profile = FLOWER_PROFILES[flowerType];
  const center = new Vector3(
    stem.x + stem.leanX,
    baseY + stem.height,
    stem.z + stem.leanZ,
  );
  const scale = stem.bloomScale;
  const addPetal = (
    angle: number,
    distance: number,
    width: number,
    length: number,
    thickness: number,
    yOffset = 0,
    tilt = stem.bloomTilt,
    material = petalMaterial,
  ) => {
    const petal = new Mesh(petalGeometry, material);
    petal.position.set(
      center.x + Math.sin(angle) * distance,
      center.y + yOffset,
      center.z + Math.cos(angle) * distance,
    );
    petal.scale.set(width * scale, thickness * scale, length * scale);
    petal.rotation.y = angle;
    petal.rotation.x = tilt;
    scene.add(petal);
    meshes.push(petal);
  };
  const addCenter = (radius: number, yOffset = 0, material = centerMaterial) => {
    const disk = new Mesh(centerGeometry, material);
    disk.position.set(center.x, center.y + yOffset, center.z);
    disk.scale.set(radius * scale, radius * scale * 0.78, radius * scale);
    scene.add(disk);
    meshes.push(disk);
  };

  switch (profile.style) {
    case "rosette":
      for (let ring = 0; ring < profile.rings; ring += 1) {
        const count = profile.petalCount + ring * 2;
        const ringRadius = 0.12 + ring * 0.13;
        for (let index = 0; index < count; index += 1) {
          const angle = (index / count) * Math.PI * 2 + ring * 0.38 + stem.rotation;
          addPetal(
            angle,
            ringRadius,
            0.2 + ring * 0.025,
            0.34 + ring * 0.06,
            0.16,
            -ring * 0.025,
            stem.bloomTilt + (ring - 1) * 0.16,
            ring % 3 === 0 ? petalLightMaterial : ring % 3 === 1 ? petalMaterial : petalDarkMaterial,
          );
        }
      }
      addCenter(0.2, 0.02, petalDarkMaterial);
      break;
    case "cup":
      for (let index = 0; index < profile.petalCount; index += 1) {
        const angle = (index / profile.petalCount) * Math.PI * 2 + stem.rotation;
        addPetal(angle, 0.22, 0.28, 0.56, 0.18, 0.08, -0.28, index % 2 ? petalMaterial : petalLightMaterial);
      }
      addCenter(0.22, 0.12, petalDarkMaterial);
      break;
    case "ray":
      for (let index = 0; index < profile.petalCount; index += 1) {
        const angle = (index / profile.petalCount) * Math.PI * 2 + stem.rotation;
        addPetal(angle, 0.32, 0.18, 0.66, 0.13, 0.02, -0.04, index % 3 ? petalMaterial : petalLightMaterial);
      }
      addCenter(flowerType === "sunflower" ? 0.34 : 0.23, 0.05, centerMaterial);
      break;
    case "star":
      for (let index = 0; index < profile.petalCount; index += 1) {
        const angle = (index / profile.petalCount) * Math.PI * 2 + stem.rotation;
        addPetal(angle, 0.18, 0.2, 0.7, 0.12, 0.04, 0.3, index % 2 ? petalMaterial : petalLightMaterial);
      }
      addCenter(0.15, 0.1, centerMaterial);
      break;
    case "orchid":
      for (let index = 0; index < profile.petalCount; index += 1) {
        const angle = (index / profile.petalCount) * Math.PI * 2 + stem.rotation;
        addPetal(angle, index === 0 ? 0.05 : 0.19, index === 0 ? 0.32 : 0.25, index === 0 ? 0.58 : 0.44, 0.14, index === 0 ? -0.02 : 0.04, index === 0 ? 0.16 : -0.06, index === 0 ? petalDarkMaterial : petalLightMaterial);
      }
      addCenter(0.12, 0.12, petalDarkMaterial);
      break;
    case "spike":
      for (let tier = 0; tier < 4; tier += 1) {
        for (let index = 0; index < profile.petalCount; index += 1) {
          const angle = (index / profile.petalCount) * Math.PI * 2 + stem.rotation + tier * 0.4;
          addPetal(angle, 0.1, 0.13, 0.27, 0.1, -0.72 + tier * 0.27, 0.12, index % 2 ? petalMaterial : petalLightMaterial);
        }
        addCenter(0.09, -0.72 + tier * 0.27, petalDarkMaterial);
      }
      break;
    case "cluster":
      for (let cluster = 0; cluster < 7; cluster += 1) {
        const clusterAngle = (cluster / 7) * Math.PI * 2 + stem.rotation;
        const clusterDistance = cluster === 0 ? 0 : 0.18;
        const offsetX = Math.sin(clusterAngle) * clusterDistance;
        const offsetZ = Math.cos(clusterAngle) * clusterDistance;
        for (let index = 0; index < profile.petalCount; index += 1) {
          const angle = (index / profile.petalCount) * Math.PI * 2 + clusterAngle;
          addPetal(angle, 0.07 + clusterDistance, 0.1, 0.22, 0.09, 0.03, 0.1, index % 2 ? petalMaterial : petalLightMaterial);
          const petal = meshes[meshes.length - 1];
          petal.position.x += offsetX;
          petal.position.z += offsetZ;
        }
        addCenter(0.07, 0.06, petalDarkMaterial);
        const disk = meshes[meshes.length - 1];
        disk.position.x += offsetX;
        disk.position.z += offsetZ;
      }
      break;
  }
}

function shift(color: Color, lightness: number, hue: number): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return new Color().setHSL(
    (hsl.h + hue + 1) % 1,
    Math.min(1, Math.max(0.08, hsl.s * 0.92)),
    Math.min(0.86, Math.max(0.1, hsl.l + lightness)),
  );
}
