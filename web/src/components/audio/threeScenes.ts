import * as THREE from "three";
import type { ThreeAudioVisualizerMode } from "@/types";

export interface ThreeFrameData {
  bins: number[];
  rms: number;
  peak: number;
  beat: boolean;
  seq: number;
  time: number;
  primary: string;
  secondary: string;
  dark: boolean;
  reduced: boolean;
}

export interface AudioThreeScene {
  cameraPosition: THREE.Vector3;
  update(data: ThreeFrameData): void;
  setTheme(dark: boolean): void;
  dispose(): void;
}

const themeBackground = (dark: boolean) => new THREE.Color(dark ? "#050711" : "#f2f6fb");
const themeFog = (dark: boolean) => new THREE.Color(dark ? "#070a16" : "#eaf0f7");

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) material.dispose();
  });
}

export function createAudioThreeScene(mode: ThreeAudioVisualizerMode, scene: THREE.Scene, mobile: boolean, preview: boolean): AudioThreeScene {
  if (mode === "nebula3d") return createNebula(scene, mobile, preview);
  if (mode === "terrain3d") return createTerrain(scene, mobile, preview);
  if (mode === "crystal3d") return createCrystal(scene, mobile, preview);
  return createCity(scene, mobile, preview);
}

function createCity(scene: THREE.Scene, mobile: boolean, preview: boolean): AudioThreeScene {
  const size = preview ? 12 : mobile ? 14 : 20;
  const count = size * size;
  const group = new THREE.Group();
  scene.add(group);
  const geometry = new THREE.BoxGeometry(0.72, 1, 0.72);
  const normals = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const faceShading = new Float32Array(normals.count * 3);
  for (let index = 0; index < normals.count; index++) {
    const shade = normals.getY(index) > 0.5 ? 1 : Math.abs(normals.getX(index)) > 0.5 ? 0.72 : 0.56;
    faceShading[index * 3] = shade;
    faceShading[index * 3 + 1] = shade;
    faceShading[index * 3 + 2] = shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(faceShading, 3));
  const material = new THREE.MeshBasicMaterial({ color: "#ffffff", vertexColors: true });
  const buildings = new THREE.InstancedMesh(geometry, material, count);
  buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const bandMap = new Uint8Array(count);
  const seed = new Float32Array(count);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const index = z * size + x;
    const nx = (x - (size - 1) / 2) / size;
    const nz = (z - (size - 1) / 2) / size;
    bandMap[index] = Math.min(63, Math.floor(Math.hypot(nx, nz) * 100 + (index * 13) % 9));
    seed[index] = 0.35 + ((index * 37) % 100) / 150;
  }
  group.add(buildings);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: "#0c1324", roughness: 0.55, metalness: 0.72, transparent: true, opacity: 0.82 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.25, size * 1.25), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.04;
  group.add(floor);
  const grid = new THREE.GridHelper(size * 1.2, size, "#3bdcf6", "#344056");
  grid.position.y = 0.015;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.22;
  const gridPositions = grid.geometry.getAttribute("position") as THREE.BufferAttribute;
  const gridColors = grid.geometry.getAttribute("color") as THREE.BufferAttribute;
  group.add(grid);
  scene.add(new THREE.AmbientLight("#ffffff", 0.55));
  scene.add(new THREE.HemisphereLight("#d9f8ff", "#11152a", 0.85));
  const key = new THREE.DirectionalLight("#ffffff", 1.15);
  key.position.set(7, 12, 5);
  scene.add(key);
  let dark = true;
  return {
    cameraPosition: preview ? new THREE.Vector3(8.3, 7.2, 10.4) : new THREE.Vector3(11, 10, 15),
    update(data) {
      const colorA = new THREE.Color(data.primary), colorB = new THREE.Color(data.secondary);
      const gridColor = new THREE.Color();
      for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
        const index = z * size + x;
        const energy = data.bins[bandMap[index]] ?? 0;
        const center = 1 - Math.min(1, Math.hypot(x - size / 2, z - size / 2) / (size * 0.65));
        const height = 0.18 + seed[index] + energy * (4.8 + center * 4.2) + (data.beat ? center * 0.7 : 0);
        dummy.position.set((x - (size - 1) / 2) * 0.94, height / 2, (z - (size - 1) / 2) * 0.94);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        buildings.setMatrixAt(index, dummy.matrix);
        buildings.setColorAt(index, colorA.clone().lerp(colorB, bandMap[index] / 63).multiplyScalar(dark ? 0.36 + energy * 0.58 : 0.62 + energy * 0.28));
      }
      for (let index = 0; index < gridPositions.count; index++) {
        const distance = Math.hypot(gridPositions.getX(index), gridPositions.getZ(index));
        gridColor.copy(colorA).lerp(colorB, Math.min(1, distance / (size * 0.62)));
        gridColors.setXYZ(index, gridColor.r, gridColor.g, gridColor.b);
      }
      buildings.instanceMatrix.needsUpdate = true;
      if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
      gridColors.needsUpdate = true;
      floorMaterial.color.copy(colorA).lerp(colorB, 0.45).multiplyScalar(dark ? 0.09 : 0.38);
      if (!data.reduced) group.rotation.y = Math.sin(data.time * 0.08) * 0.055;
    },
    setTheme(nextDark) {
      dark = nextDark;
      scene.background = themeBackground(nextDark);
      scene.fog = new THREE.FogExp2(themeFog(nextDark), nextDark ? 0.028 : 0.022);
      floorMaterial.opacity = nextDark ? 0.72 : 0.58;
      (grid.material as THREE.Material).opacity = nextDark ? 0.34 : 0.2;
    },
    dispose() { disposeObject(group); scene.remove(group); },
  };
}

function createNebula(scene: THREE.Scene, mobile: boolean, preview: boolean): AudioThreeScene {
  const count = preview ? 1200 : mobile ? 2200 : 6000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const phases = new Float32Array(count);
  const heights = new Float32Array(count);
  const bands = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const arm = i % 4;
    const progress = ((i * 97) % count) / count;
    radii[i] = 0.45 + progress * 6.8 + ((i * 31) % 100) / 180;
    phases[i] = arm * Math.PI / 2 + progress * Math.PI * 5.2 + ((i * 17) % 29) / 80;
    heights[i] = (((i * 53) % 100) / 100 - 0.5) * (0.45 + progress * 1.5);
    bands[i] = (i * 23) % 64;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: preview ? 0.055 : 0.075, vertexColors: true, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  let dark = true;
  return {
    cameraPosition: new THREE.Vector3(0, 3.2, 11.5),
    update(data) {
      const a = new THREE.Color(data.primary), b = new THREE.Color(data.secondary);
      for (let i = 0; i < count; i++) {
        const energy = data.bins[bands[i]] ?? 0;
        const pulse = 1 + energy * 0.32 + (data.beat && !data.reduced ? 0.08 : 0);
        const angle = phases[i] + (data.reduced ? 0 : data.time * (0.055 + bands[i] / 3000));
        const radius = radii[i] * pulse;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = heights[i] + Math.sin(angle * 2.2 + data.time) * energy * 0.34;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
        const color = a.clone().lerp(b, bands[i] / 63).multiplyScalar(dark ? 0.38 + energy * 0.72 : 0.52 + energy * 0.42);
        color.toArray(colors, i * 3);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      if (!data.reduced) points.rotation.z = Math.sin(data.time * 0.11) * 0.1;
      material.size = (preview ? 0.055 : 0.075) * (1 + data.peak * 0.4);
    },
    setTheme(nextDark) {
      dark = nextDark;
      scene.background = themeBackground(nextDark);
      scene.fog = new THREE.FogExp2(themeFog(nextDark), nextDark ? 0.045 : 0.035);
      material.blending = nextDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      material.opacity = nextDark ? 0.86 : 0.72;
      material.needsUpdate = true;
    },
    dispose() { geometry.dispose(); material.dispose(); scene.remove(points); },
  };
}

function createTerrain(scene: THREE.Scene, mobile: boolean, preview: boolean): AudioThreeScene {
  const columns = 64, rows = preview ? 24 : mobile ? 32 : 48;
  const geometry = new THREE.PlaneGeometry(15, 11, columns - 1, rows - 1);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const history = new Float32Array(columns * rows);
  const surfaceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.24, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const wireMaterial = new THREE.MeshBasicMaterial({ color: "#76e5ff", wireframe: true, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending });
  const group = new THREE.Group();
  const surface = new THREE.Mesh(geometry, surfaceMaterial);
  const wire = new THREE.Mesh(geometry, wireMaterial);
  wire.position.y = 0.025;
  group.add(surface, wire);
  group.position.z = -1.5;
  scene.add(group);
  scene.add(new THREE.HemisphereLight("#ffffff", "#253354", 0.95));
  const light = new THREE.DirectionalLight("#ffffff", 1.15);
  light.position.set(-5, 9, 5);
  scene.add(light);
  let lastSeq = -1, dark = true;
  return {
    cameraPosition: new THREE.Vector3(0, 6.2, 9.4),
    update(data) {
      if (data.seq !== lastSeq) {
        lastSeq = data.seq;
        history.copyWithin(columns, 0, columns * (rows - 1));
        for (let x = 0; x < columns; x++) history[x] = data.bins[x] ?? 0;
      }
      const a = new THREE.Color(data.primary), b = new THREE.Color(data.secondary);
      for (let row = 0; row < rows; row++) for (let x = 0; x < columns; x++) {
        const index = row * columns + x;
        const energy = history[index];
        position.setY(index, energy * (3.6 - row / rows * 0.8));
        a.clone().lerp(b, x / (columns - 1)).multiplyScalar(dark ? 0.34 + energy * 0.52 : 0.62 + energy * 0.32).toArray(colors, index * 3);
      }
      position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      if (!preview) geometry.computeVertexNormals();
      if (!data.reduced) group.position.y = Math.sin(data.time * 0.45) * 0.035;
    },
    setTheme(nextDark) {
      dark = nextDark;
      scene.background = themeBackground(nextDark);
      scene.fog = new THREE.FogExp2(themeFog(nextDark), nextDark ? 0.055 : 0.042);
      surfaceMaterial.opacity = nextDark ? 0.68 : 0.62;
      surfaceMaterial.metalness = nextDark ? 0.28 : 0.08;
      wireMaterial.opacity = nextDark ? 0.26 : 0.18;
      wireMaterial.blending = nextDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      wireMaterial.needsUpdate = true;
    },
    dispose() { disposeObject(group); scene.remove(group); },
  };
}

function createCrystal(scene: THREE.Scene, mobile: boolean, preview: boolean): AudioThreeScene {
  const geometry = new THREE.IcosahedronGeometry(2.65, preview ? 2 : mobile ? 3 : 4);
  const uniforms = {
    uBins: { value: new Float32Array(64) },
    uTime: { value: 0 },
    uPrimary: { value: new THREE.Color("#22d3ee") },
    uSecondary: { value: new THREE.Color("#a855f7") },
    uDark: { value: 1 },
    uReduced: { value: 0 },
  };
  const vertexShader = `
    uniform float uBins[64]; uniform float uTime; uniform float uReduced;
    varying vec3 vNormal; varying float vEnergy; varying float vBand;
    void main() {
      vec3 n = normalize(position);
      float angle = atan(n.z, n.x) / 6.2831853 + 0.5;
      int band = int(clamp(floor(angle * 64.0), 0.0, 63.0));
      float energy = uBins[band];
      float facets = sin((n.x + n.y + n.z) * 8.0 + uTime * (1.0 - uReduced));
      vec3 displaced = position + n * (energy * 1.15 + facets * 0.055 * (1.0 - uReduced));
      vNormal = normalize(normalMatrix * n); vEnergy = energy; vBand = angle;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }`;
  const fragmentShader = `
    uniform vec3 uPrimary; uniform vec3 uSecondary; uniform float uDark;
    varying vec3 vNormal; varying float vEnergy; varying float vBand;
    void main() {
      vec3 color = mix(uPrimary, uSecondary, vBand);
      float light = max(0.12, dot(normalize(vNormal), normalize(vec3(0.4, 0.8, 0.6))));
      float rim = pow(1.0 - abs(vNormal.z), 2.4);
      vec3 shaded = color * (mix(0.68, 0.32, uDark) + light * mix(0.38, 0.52, uDark) + rim * (0.18 + vEnergy * 0.32));
      gl_FragColor = vec4(shaded, mix(0.88, 0.96, uDark));
    }`;
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
  const crystal = new THREE.Mesh(geometry, material);
  const wireMaterial = material.clone();
  wireMaterial.uniforms = uniforms;
  wireMaterial.wireframe = true;
  wireMaterial.transparent = true;
  wireMaterial.opacity = 0.23;
  const wire = new THREE.Mesh(geometry, wireMaterial);
  wire.scale.setScalar(1.012);
  const group = new THREE.Group();
  group.add(crystal, wire);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5 + i * 0.42, 0.018 + i * 0.006, 6, 120), new THREE.MeshBasicMaterial({ color: i % 2 ? "#a855f7" : "#22d3ee", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending }));
    ring.rotation.set(Math.PI * (0.26 + i * 0.18), i * 0.72, i * 0.4);
    rings.push(ring); group.add(ring);
  }
  scene.add(group);
  return {
    cameraPosition: new THREE.Vector3(0, 0.6, 10.5),
    update(data) {
      (uniforms.uBins.value as Float32Array).set(data.bins);
      uniforms.uTime.value = data.time;
      uniforms.uPrimary.value.set(data.primary);
      uniforms.uSecondary.value.set(data.secondary);
      uniforms.uReduced.value = data.reduced ? 1 : 0;
      if (!data.reduced) {
        group.rotation.y = data.time * 0.12;
        group.rotation.x = Math.sin(data.time * 0.22) * 0.12;
        rings.forEach((ring, i) => { ring.rotation.z += 0.0015 * (i + 1) * (1 + data.rms * 3); });
      }
      const pulse = 1 + data.rms * 0.08 + (data.beat && !data.reduced ? 0.035 : 0);
      crystal.scale.setScalar(pulse); wire.scale.setScalar(pulse * 1.012);
    },
    setTheme(dark) {
      scene.background = themeBackground(dark);
      scene.fog = new THREE.FogExp2(themeFog(dark), dark ? 0.025 : 0.018);
      uniforms.uDark.value = dark ? 1 : 0;
      wireMaterial.opacity = dark ? 0.3 : 0.16;
      rings.forEach((ring) => {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = dark ? 0.22 : 0.16;
        mat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        mat.needsUpdate = true;
      });
    },
    dispose() { disposeObject(group); scene.remove(group); },
  };
}
