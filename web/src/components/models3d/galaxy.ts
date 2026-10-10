import {
  AmbientLight,
  BackSide,
  Color,
  DirectionalLight,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  type Material,
} from "three/webgpu";
import { makeStarTexture, type SolarSystemHandle } from "@/components/models3d/solarSystem";
import type { Model3dGalaxyRotationSpeed, Model3dGalaxyStarCount } from "@/types";

const ARM_COUNT = 4;
const GALAXY_RADIUS = 12;
const CORE = new Color("#fff4e0");
const DUST = new Color("#c4784a");
const STAR_COUNTS: Record<Model3dGalaxyStarCount, number> = {
  low: 4_000,
  medium: 8_000,
  high: 14_000,
};
const ROTATION_SPEEDS: Record<Model3dGalaxyRotationSpeed, number> = {
  slow: 0.035,
  medium: 0.08,
  fast: 0.16,
};

export interface GalaxyLook {
  armColor: string;
  starCount: Model3dGalaxyStarCount;
  rotationSpeed: Model3dGalaxyRotationSpeed;
}

export async function createGalaxy(preview: boolean, look: GalaxyLook): Promise<SolarSystemHandle> {
  const scene = new Scene();
  scene.background = new Color(0x02040a);

  const camera = new PerspectiveCamera(preview ? 38 : 42, 1, 0.1, 280);
  camera.position.set(0, preview ? 14 : 18, preview ? 26 : 32);
  camera.lookAt(0, 0, 0);

  const starFieldTexture = makeStarTexture();
  const starField = new Mesh(
    new SphereGeometry(90, 32, 24),
    new MeshBasicMaterial({
      map: starFieldTexture,
      side: BackSide,
      depthWrite: false,
    }),
  );
  scene.add(starField);

  const count = Math.round(STAR_COUNTS[look.starCount] * (preview ? 0.5 : 1));
  const built = buildGalaxy(count, look.armColor, preview ? 1.05 : 1);
  const geometry = new SphereGeometry(1, 8, 6);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.06,
  });
  const stars = new InstancedMesh(geometry, material, count);
  const matrix = new Matrix4();
  const starPosition = new Vector3();
  const starScale = new Vector3();
  const starRotation = new Quaternion();
  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    starPosition.set(built.positions[offset], built.positions[offset + 1], built.positions[offset + 2]);
    starScale.set(built.sizes[i], built.sizes[i], built.sizes[i]);
    matrix.compose(starPosition, starRotation, starScale);
    stars.setMatrixAt(i, matrix);
  }
  stars.instanceColor = new InstancedBufferAttribute(built.colors, 3);
  stars.frustumCulled = false;

  const galaxy = new Group();
  galaxy.add(stars);
  scene.add(galaxy);
  scene.add(new AmbientLight(0xb7c6dc, 0.72));
  const keyLight = new DirectionalLight(0xfff6ea, 2.4);
  keyLight.position.set(6, 14, 10);
  const fillLight = new DirectionalLight(0x7f97e8, 0.85);
  fillLight.position.set(-12, -3, -8);
  scene.add(keyLight, fillLight);

  const speed = ROTATION_SPEEDS[look.rotationSpeed];
  const update = (time: number, reduced: boolean) => {
    const motion = reduced ? 0.08 : 1;
    galaxy.rotation.y = time * speed * motion;
    starField.rotation.y = time * 0.004 * motion;
  };

  const dispose = () => {
    stars.geometry.dispose();
    material.dispose();
    disposeMaterial(starField.material);
    starField.geometry.dispose();
    starFieldTexture.dispose();
  };

  return {
    scene,
    camera,
    orbitTarget: new Vector3(0, 0, 0),
    minDistance: preview ? 16 : 12,
    maxDistance: preview ? 52 : 86,
    update,
    dispose,
  };
}

function buildGalaxy(count: number, armColorHex: string, sizeScale: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const random = mulberry32(0x9e3779b9 ^ count);
  const arm = new Color(armColorHex);
  const white = new Color("#ffffff");
  const scratch = new Color();
  const bulgeCount = Math.floor(count * 0.22);
  const dustCount = Math.floor(count * 0.12);

  for (let i = 0; i < count; i += 1) {
    const roll = random();
    const kind = i < bulgeCount ? "bulge" : i < bulgeCount + dustCount ? "dust" : "arm";
    let radius = 0;
    let angle = 0;
    let height = 0;
    let size = 0.08;

    if (kind === "bulge") {
      radius = Math.pow(random(), 0.55) * 2.35;
      angle = random() * Math.PI * 2;
      height = gaussian(random) * 0.42 * (1 - radius / 3.2);
      size = 0.16 + random() * 0.12;
      const warmth = 0.82 + random() * 0.28;
      scratch.copy(CORE).lerp(arm, radius / 8);
      writeColor(colors, i, scratch, warmth);
    } else {
      const armIndex = Math.floor(random() * ARM_COUNT);
      const along = Math.pow(random(), 0.62);
      radius = 1.15 + along * (GALAXY_RADIUS - 1.15);
      const winding = Math.log(radius) * 3.15 + armIndex * ((Math.PI * 2) / ARM_COUNT);
      const spread = 0.16 + radius * 0.03;
      radius += gaussian(random) * spread;
      angle = winding + gaussian(random) * (0.07 + radius * 0.012);
      height = gaussian(random) * (0.05 + Math.exp(-radius / 5) * 0.16);
      const edge = clamp((radius - 1.1) / (GALAXY_RADIUS - 1.1), 0, 1);
      if (kind === "dust") {
        radius *= 0.94;
        angle -= 0.2;
        size = 0.07 + random() * 0.05;
        scratch.copy(DUST).lerp(arm, 0.35 + edge * 0.4);
        writeColor(colors, i, scratch, 0.22 + random() * 0.16);
      } else {
        const bright = roll > 0.965;
        size = bright ? 0.2 + random() * 0.08 : 0.09 + random() * 0.07;
        scratch.copy(CORE).lerp(arm, Math.pow(edge, 0.72));
        if (bright) scratch.lerp(white, 0.65);
        const channel = (random() - 0.5) * 0.08;
        scratch.r = clamp(scratch.r + channel, 0, 1);
        scratch.g = clamp(scratch.g + (random() - 0.5) * 0.06, 0, 1);
        scratch.b = clamp(scratch.b + (random() - 0.5) * 0.08, 0, 1);
        writeColor(colors, i, scratch, bright ? 1 : 0.62 + random() * 0.4);
      }
    }

    radius = clamp(radius, 0.02, GALAXY_RADIUS + 1.4);
    const offset = i * 3;
    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = clamp(height, -1.3, 1.3);
    positions[offset + 2] = Math.sin(angle) * radius;
    sizes[i] = size * sizeScale;
  }

  return { positions, colors, sizes };
}

function writeColor(colors: Float32Array, index: number, color: Color, gain: number) {
  const offset = index * 3;
  colors[offset] = color.r * gain;
  colors[offset + 1] = color.g * gain;
  colors[offset + 2] = color.b * gain;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number) {
  const u = Math.max(1e-9, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function disposeMaterial(material: Material | Material[]) {
  if (Array.isArray(material)) material.forEach((item) => item.dispose());
  else material.dispose();
}
