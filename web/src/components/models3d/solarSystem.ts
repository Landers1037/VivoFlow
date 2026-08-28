import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Texture,
  Vector3,
} from "three/webgpu";
import type { Model3dId, Model3dOrbitStyle } from "@/types";
import { createVoxelTree, type TreeLook } from "@/components/models3d/tree";

const ASSET = "/models/solar-system";
const SUN_RADIUS = 2.4;
const EARTH_RADIUS = 0.55;
const MOON_RADIUS = 0.15;
const EARTH_ORBIT = 8;
const MOON_ORBIT = 1.4;

export interface SolarSystemOptions {
  orbitStyle: Model3dOrbitStyle;
  texturesEnabled: boolean;
  tree: TreeLook;
}

export interface SolarSystemHandle {
  scene: Scene;
  camera: PerspectiveCamera;
  orbitTarget: Vector3;
  minDistance: number;
  maxDistance: number;
  update: (time: number, reduced: boolean) => void;
  dispose: () => void;
}

export async function createModel3dScene(
  id: Model3dId,
  preview: boolean,
  options: SolarSystemOptions,
): Promise<SolarSystemHandle> {
  if (id === "tree") return createVoxelTree(preview, options.tree);
  return createSolarSystem(preview, options);
}

async function createSolarSystem(preview: boolean, options: SolarSystemOptions): Promise<SolarSystemHandle> {
  const scene = new Scene();
  scene.background = new Color(0x02040a);

  const camera = new PerspectiveCamera(preview ? 42 : 48, 1, 0.1, 220);
  camera.position.set(0, preview ? 5.4 : 6.2, preview ? 14.5 : 16.5);
  camera.lookAt(0, 0, 0);

  const textures = options.texturesEnabled ? await loadSolarTextures() : emptySolarTextures();
  const shared = {
    sun: new SphereGeometry(SUN_RADIUS, 64, 48),
    earth: new SphereGeometry(EARTH_RADIUS, 64, 48),
    clouds: new SphereGeometry(EARTH_RADIUS * 1.018, 64, 48),
    moon: new SphereGeometry(MOON_RADIUS, 32, 24),
    glow: new SphereGeometry(SUN_RADIUS * 1.28, 32, 24),
    stars: new SphereGeometry(80, 32, 24),
  };

  const stars = new Mesh(
    shared.stars,
    new MeshBasicMaterial({
      map: textures.stars,
      side: BackSide,
      depthWrite: false,
    }),
  );
  scene.add(stars);

  const sun = new Mesh(
    shared.sun,
    new MeshBasicMaterial({
      map: textures.sun ?? undefined,
      color: textures.sun ? 0xffffff : 0xffb14a,
    }),
  );
  const sunGlow = new Mesh(
    shared.glow,
    new MeshBasicMaterial({
      color: 0xff8a2a,
      transparent: true,
      opacity: 0.18,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  const sunLight = new PointLight(0xfff1c8, 48, 80, 1.4);
  sun.add(sunGlow, sunLight);
  scene.add(sun);
  scene.add(new AmbientLight(0x334155, 0.28));

  const earthOrbit = new Group();
  const earthPivot = new Group();
  earthPivot.position.set(EARTH_ORBIT, 0, 0);
  earthPivot.rotation.z = (23.4 * Math.PI) / 180;

  const earth = new Mesh(
    shared.earth,
    new MeshStandardMaterial({
      map: textures.earth ?? undefined,
      color: textures.earth ? 0xffffff : 0x2f6cad,
      roughness: 0.68,
      metalness: textures.earthSpecular ? 0.08 : 0.04,
      normalMap: textures.earthNormal ?? undefined,
      emissiveMap: textures.earthNight ?? undefined,
      emissive: textures.earthNight ? new Color(0xffffff) : new Color(0x000000),
      emissiveIntensity: textures.earthNight ? 0.55 : 0,
    }),
  );

  const clouds = textures.earthClouds
    ? new Mesh(
        shared.clouds,
        new MeshStandardMaterial({
          map: textures.earthClouds,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          roughness: 1,
          metalness: 0,
        }),
      )
    : null;

  const moonOrbit = new Group();
  const moon = new Mesh(
    shared.moon,
    new MeshStandardMaterial({
      map: textures.moon ?? undefined,
      color: textures.moon ? 0xffffff : 0xb8b3a8,
      roughness: 1,
      metalness: 0,
    }),
  );
  moon.position.set(MOON_ORBIT, 0, 0);
  moonOrbit.add(moon);
  earthPivot.add(earth);
  if (clouds) earthPivot.add(clouds);
  earthPivot.add(moonOrbit);
  earthOrbit.add(earthPivot);
  const earthOrbitLine = makeOrbitRing(EARTH_ORBIT, options.orbitStyle, 0.58);
  const moonOrbitLine = makeOrbitRing(MOON_ORBIT, options.orbitStyle, 0.42);
  if (earthOrbitLine) earthOrbit.add(earthOrbitLine);
  if (moonOrbitLine) earthPivot.add(moonOrbitLine);
  scene.add(earthOrbit);

  const toDispose: Object3D[] = [scene];

  const update = (time: number, reduced: boolean) => {
    const motion = reduced ? 0.08 : 1;
    sun.rotation.y = time * 0.04 * motion;
    earthOrbit.rotation.y = time * 0.085 * motion;
    earth.rotation.y = time * 0.55 * motion;
    if (clouds) clouds.rotation.y = time * 0.62 * motion;
    moonOrbit.rotation.y = time * 0.95 * motion;
    moon.rotation.y = time * 0.2 * motion;
    stars.rotation.y = time * 0.004 * motion;
  };

  const dispose = () => {
    for (const object of toDispose) {
      object.traverse((child) => {
        const mesh = child as Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
    }
    for (const texture of Object.values(textures)) texture?.dispose();
  };

  return {
    scene,
    camera,
    orbitTarget: new Vector3(0, 0, 0),
    minDistance: preview ? 10 : 7,
    maxDistance: preview ? 22 : 42,
    update,
    dispose,
  };
}

function makeOrbitRing(radius: number, style: Model3dOrbitStyle, opacity: number) {
  if (style === "hidden") return null;
  const material = new LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  if (style === "dashed") {
    const points: Vector3[] = [];
    const dash = 0.055;
    const gap = 0.038;
    for (let angle = 0; angle < Math.PI * 2; angle += dash + gap) {
      const end = angle + dash;
      points.push(
        new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
        new Vector3(Math.cos(end) * radius, 0, Math.sin(end) * radius),
      );
    }
    return new LineSegments(new BufferGeometry().setFromPoints(points), material);
  }
  const points: Vector3[] = [];
  const segments = 192;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return new Line(new BufferGeometry().setFromPoints(points), material);
}

interface SolarTextures {
  sun: Texture | null;
  earth: Texture | null;
  earthSpecular: Texture | null;
  earthNormal: Texture | null;
  earthClouds: Texture | null;
  earthNight: Texture | null;
  moon: Texture | null;
  stars: Texture;
}

function emptySolarTextures(): SolarTextures {
  return {
    sun: null,
    earth: null,
    earthSpecular: null,
    earthNormal: null,
    earthClouds: null,
    earthNight: null,
    moon: null,
    stars: makeStarTexture(),
  };
}

async function loadSolarTextures(): Promise<SolarTextures> {
  const [sun, earth, earthSpecular, earthNormal, earthClouds, earthNight, moon, stars] = await Promise.all([
    loadMap(["sun.jpg", "2k_sun.jpg"], true),
    loadMap(["earth.jpg", "2k_earth_daymap.jpg"], true),
    loadMap(["earth-specular.jpg", "2k_earth_specular_map.jpg"], false),
    loadMap(["earth-normal.jpg", "2k_earth_normal_map.jpg"], false),
    loadMap(["earth-clouds.jpg", "2k_earth_clouds.jpg"], true),
    loadMap(["earth-night.jpg", "2k_earth_nightmap.jpg"], true),
    loadMap(["moon.jpg", "2k_moon.jpg"], true),
    loadMap(["stars.jpg", "2k_stars.jpg"], true),
  ]);
  return {
    sun,
    earth,
    earthSpecular,
    earthNormal,
    earthClouds,
    earthNight,
    moon,
    stars: stars ?? makeStarTexture(),
  };
}

async function loadMap(names: string[], color: boolean) {
  for (const name of names) {
    const texture = await loadOne(`${ASSET}/${name}`, color);
    if (texture) return texture;
  }
  return null;
}

function loadOne(url: string, color: boolean) {
  return new Promise<Texture | null>((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.src = "";
      resolve(null);
    }, 2500);
    image.onload = () => {
      window.clearTimeout(timer);
      const texture = new Texture(image);
      if (color) texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    image.src = url;
  });
}

function makeStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }
  ctx.fillStyle = "#02040a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() > 0.94 ? 1.6 : 1;
    ctx.fillStyle = `rgba(255,255,255,${0.28 + Math.random() * 0.7})`;
    ctx.fillRect(x, y, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
