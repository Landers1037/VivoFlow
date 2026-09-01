/// <reference lib="webworker" />
import type { ParticleWorkerRequest, ParticleWorkerResponse } from "./particleData";

self.onmessage = async (event: MessageEvent<ParticleWorkerRequest>) => {
  const { requestId, url, density, maxParticles } = event.data;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Image request failed (${response.status})`);
    const bitmap = await createImageBitmap(await response.blob());
    const safeDensity = Math.min(1, Math.max(0.2, density));
    const scale = Math.min(1, Math.sqrt(maxParticles / safeDensity / Math.max(1, bitmap.width * bitmap.height)));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image sampling is unavailable");
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, width, height).data;
    const selected: number[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = (y * width + x) * 4;
        if (pixels[pixel + 3] < 20) continue;
        if (hash01(x, y) <= safeDensity) selected.push(y * width + x);
      }
    }
    if (selected.length > maxParticles) selected.length = maxParticles;
    const count = selected.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const luminance = new Float32Array(count);
    const edges = new Float32Array(count);
    const random = new Float32Array(count);
    const imageAspect = width / height;
    const extentX = imageAspect >= 1 ? 1 : imageAspect;
    const extentY = imageAspect >= 1 ? 1 / imageAspect : 1;
    for (let i = 0; i < count; i += 1) {
      const index = selected[i];
      const x = index % width;
      const y = Math.floor(index / width);
      const pixel = index * 4;
      const u = width === 1 ? 0.5 : x / (width - 1);
      const v = height === 1 ? 0.5 : y / (height - 1);
      positions[i * 3] = (u - 0.5) * 2 * extentX;
      positions[i * 3 + 1] = (0.5 - v) * 2 * extentY;
      positions[i * 3 + 2] = 0;
      colors[i * 3] = srgb(pixels[pixel] / 255);
      colors[i * 3 + 1] = srgb(pixels[pixel + 1] / 255);
      colors[i * 3 + 2] = srgb(pixels[pixel + 2] / 255);
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
      luminance[i] = lightAt(pixels, width, height, x, y);
      edges[i] = Math.min(1, Math.abs(lightAt(pixels, width, height, x + 1, y) - lightAt(pixels, width, height, x - 1, y)) + Math.abs(lightAt(pixels, width, height, x, y + 1) - lightAt(pixels, width, height, x, y - 1)));
      random[i] = hash01(x + 17, y + 31);
    }
    const data = { positions, colors, uvs, luminance, edges, random, count, imageAspect };
    const message: ParticleWorkerResponse = { requestId, data };
    self.postMessage(message, [positions.buffer, colors.buffer, uvs.buffer, luminance.buffer, edges.buffer, random.buffer]);
  } catch (error) {
    const message: ParticleWorkerResponse = { requestId, error: error instanceof Error ? error.message : String(error) };
    self.postMessage(message);
  }
};

function lightAt(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const safeX = Math.min(width - 1, Math.max(0, x));
  const safeY = Math.min(height - 1, Math.max(0, y));
  const i = (safeY * width + safeX) * 4;
  return (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) / 255;
}

function hash01(x: number, y: number) {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function srgb(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}
