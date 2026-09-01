export interface ParticleData {
  positions: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  luminance: Float32Array;
  edges: Float32Array;
  random: Float32Array;
  count: number;
  imageAspect: number;
}

export interface ParticleWorkerRequest {
  requestId: number;
  url: string;
  density: number;
  maxParticles: number;
}

export interface ParticleWorkerResponse {
  requestId: number;
  data?: ParticleData;
  error?: string;
}

export function particleBudget(preview: boolean, mobile: boolean) {
  return preview ? 12_000 : mobile ? 24_000 : 65_536;
}

export function audioBinForUv(u: number) {
  return Math.min(63, Math.max(0, Math.floor(u * 64)));
}

export function depthForMode(mode: "relief" | "plane" | "cloud", light: number, edge: number, random: number, depth: number) {
  if (mode === "plane") return 0;
  if (mode === "cloud") return ((random - 0.5) * 1.4 + (light - 0.5) * 0.2) * depth;
  return ((light - 0.5) * 0.8 + edge * 0.25) * depth;
}
