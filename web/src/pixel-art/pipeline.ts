import type { PixelArtPreset, PixelArtSettings } from "@/types";
import type { ImageStats, PixelArtResult, RGBColor } from "./types";

const PALETTE_SIZES = [8, 12, 16, 24, 32, 40, 48, 64];
const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

type Lab = [number, number, number];

export function clampSettings(settings: PixelArtSettings): PixelArtSettings {
  const dithering = ["none", "ordered", "floyd_steinberg"].includes(settings.dithering)
    ? settings.dithering
    : "ordered";
  const paletteSize = PALETTE_SIZES.includes(Math.round(settings.palette_size))
    ? Math.round(settings.palette_size)
    : 32;
  return {
    interval_s: Math.min(60, Math.max(2, Math.round(Number(settings.interval_s) || 8))),
    shuffle: Boolean(settings.shuffle),
    preset: settings.preset,
    target_short_edge: Math.min(256, Math.max(80, Math.round(Number(settings.target_short_edge) || 128))),
    palette_size: paletteSize,
    smoothing: finiteClamp(settings.smoothing, 0, 0.5, 0.18),
    contrast: finiteClamp(settings.contrast, -0.3, 0.5, 0.08),
    saturation: finiteClamp(settings.saturation, -0.3, 0.5, 0.08),
    gamma: finiteClamp(settings.gamma, 0.5, 1.5, 1),
    dithering,
    dithering_strength: finiteClamp(settings.dithering_strength, 0, dithering === "floyd_steinberg" ? 0.35 : 0.5, 0.2),
    edge_enhancement: finiteClamp(settings.edge_enhancement, 0, 0.25, 0.12),
    sharpen: finiteClamp(settings.sharpen, 0, 0.25, 0.12),
  };
}

function finiteClamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
}

export const PRESET_SETTINGS: Record<Exclude<PixelArtPreset, "auto" | "custom">, Partial<PixelArtSettings>> = {
  balanced: {
    target_short_edge: 128, palette_size: 32, smoothing: 0.18, contrast: 0.08,
    saturation: 0.08, gamma: 1, dithering: "ordered", dithering_strength: 0.2,
    edge_enhancement: 0.12, sharpen: 0.12,
  },
  detailed: {
    target_short_edge: 192, palette_size: 48, smoothing: 0.1, contrast: 0.12,
    saturation: 0.1, gamma: 1, dithering: "ordered", dithering_strength: 0.1,
    edge_enhancement: 0.16, sharpen: 0.18,
  },
  retro: {
    target_short_edge: 96, palette_size: 24, smoothing: 0.22, contrast: 0.14,
    saturation: 0.16, gamma: 0.95, dithering: "ordered", dithering_strength: 0.25,
    edge_enhancement: 0.1, sharpen: 0.1,
  },
  painting: {
    target_short_edge: 144, palette_size: 40, smoothing: 0.28, contrast: 0.04,
    saturation: 0.12, gamma: 1.05, dithering: "none", dithering_strength: 0,
    edge_enhancement: 0.08, sharpen: 0.06,
  },
  "8bit": {
    target_short_edge: 80, palette_size: 16, smoothing: 0.08, contrast: 0.2,
    saturation: 0.2, gamma: 1, dithering: "ordered", dithering_strength: 0.35,
    edge_enhancement: 0.18, sharpen: 0.18,
  },
};

export function settingsForPreset(base: PixelArtSettings, preset: PixelArtPreset): PixelArtSettings {
  if (preset === "custom") return clampSettings({ ...base, preset });
  if (preset === "auto") return clampSettings({ ...base, preset });
  return clampSettings({ ...base, ...PRESET_SETTINGS[preset], preset });
}

export function resolveAutoSettings(base: PixelArtSettings, stats: ImageStats): PixelArtSettings {
  const complexity = Math.min(1, stats.edgeDensity * 1.8 + stats.gradientP90 * 0.35 + stats.colorVariance * 0.25);
  const target = Math.round((96 + complexity * 96) / 8) * 8;
  const palette = PALETTE_SIZES.reduce((best, size) =>
    Math.abs(size - (16 + stats.colorVariance * 48)) < Math.abs(best - (16 + stats.colorVariance * 48)) ? size : best,
  32);
  return clampSettings({
    ...base,
    preset: "auto",
    target_short_edge: target,
    palette_size: palette,
    contrast: Math.min(0.25, base.contrast + Math.max(0, 0.18 - stats.luminanceStdDev) * 0.5),
    saturation: Math.min(0.25, base.saturation + Math.max(0, 0.3 - stats.saturationMean) * 0.15),
    dithering_strength: Math.min(0.35, base.dithering_strength + Math.max(0, 0.35 - stats.colorVariance) * 0.12),
  });
}

export function processPixelArt(source: ImageData, rawSettings: PixelArtSettings): PixelArtResult {
  const stats = analyzeImage(source);
  let settings = clampSettings(rawSettings);
  if (settings.preset === "auto") settings = resolveAutoSettings(settings, stats);
  const work = downsample(source, settings.target_short_edge);
  const smoothed = gaussianBlur(work, settings.smoothing);
  const edges = sobel(smoothed);
  const palette = medianCutPalette(smoothed, settings.palette_size);
  const mapped = quantize(smoothed, palette, settings, edges);
  const graded = colorGrade(mapped, settings, edges);
  return {
    width: work.width,
    height: work.height,
    data: graded,
    palette,
    stats,
    background: backgroundFromPalette(palette),
    settings,
  };
}

export function analyzeImage(image: ImageData): ImageStats {
  const { data } = image;
  const sampleStep = Math.max(1, Math.floor((data.length / 4) / 12000));
  let count = 0;
  let lumSum = 0;
  let lumSq = 0;
  let satSum = 0;
  let satSq = 0;
  let colorSum = 0;
  let colorSq = 0;
  let dark = 0;
  let bright = 0;
  for (let p = 0, pixel = 0; p < data.length; p += 4, pixel += 1) {
    if (pixel % sampleStep !== 0) continue;
    const r = data[p] / 255;
    const g = data[p + 1] / 255;
    const b = data[p + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = max === 0 ? 0 : (max - min) / max;
    const chroma = max - min;
    count += 1;
    lumSum += lum; lumSq += lum * lum;
    satSum += sat; satSq += sat * sat;
    colorSum += chroma; colorSq += chroma * chroma;
    if (lum < 0.2) dark += 1;
    if (lum > 0.8) bright += 1;
  }
  const averageLuminance = count ? lumSum / count : 0;
  const saturationMean = count ? satSum / count : 0;
  const luminanceStdDev = Math.sqrt(Math.max(0, lumSq / Math.max(1, count) - averageLuminance ** 2));
  const saturationStdDev = Math.sqrt(Math.max(0, satSq / Math.max(1, count) - saturationMean ** 2));
  const colorMean = count ? colorSum / count : 0;
  const colorVariance = Math.min(1, Math.sqrt(Math.max(0, colorSq / Math.max(1, count) - colorMean ** 2)) * 2.5);
  const gradient = sobel(image);
  let gradientSum = 0;
  let gradientP90 = 0;
  let edgeCount = 0;
  const sorted = Array.from(gradient).sort((a, b) => a - b);
  for (const value of gradient) { gradientSum += value; if (value > 0.18) edgeCount += 1; }
  gradientP90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0;
  return {
    averageLuminance,
    luminanceStdDev,
    saturationMean,
    saturationStdDev,
    gradientMean: gradient.length ? gradientSum / gradient.length : 0,
    gradientP90,
    edgeDensity: gradient.length ? edgeCount / gradient.length : 0,
    colorVariance,
    darkRatio: count ? dark / count : 0,
    brightRatio: count ? bright / count : 0,
  };
}

function downsample(source: ImageData, targetShortEdge: number): ImageData {
  const scale = targetShortEdge / Math.min(source.width, source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const output = new ImageData(width, height);
  const sx = source.width / width;
  const sy = source.height / height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = Math.floor(x * sx);
      const right = Math.min(source.width, Math.max(left + 1, Math.ceil((x + 1) * sx)));
      const top = Math.floor(y * sy);
      const bottom = Math.min(source.height, Math.max(top + 1, Math.ceil((y + 1) * sy)));
      let r = 0; let g = 0; let b = 0; let count = 0;
      let strongestEdge = 0;
      let edgeR = 0; let edgeG = 0; let edgeB = 0;
      for (let yy = top; yy < bottom; yy += 1) for (let xx = left; xx < right; xx += 1) {
        const i = (yy * source.width + xx) * 4;
        r += source.data[i]; g += source.data[i + 1]; b += source.data[i + 2]; count += 1;
        // Preserve a small amount of the strongest local contrast in each
        // source tile so high-frequency edges do not disappear into a plain
        // area average when a phone photo is reduced to the pixel grid.
        const lum = (0.2126 * source.data[i] + 0.7152 * source.data[i + 1] + 0.0722 * source.data[i + 2]) / 255;
        const rightX = Math.min(source.width - 1, xx + 1);
        const downY = Math.min(source.height - 1, yy + 1);
        const rightIndex = (yy * source.width + rightX) * 4;
        const downIndex = (downY * source.width + xx) * 4;
        const rightLum = (0.2126 * source.data[rightIndex] + 0.7152 * source.data[rightIndex + 1] + 0.0722 * source.data[rightIndex + 2]) / 255;
        const downLum = (0.2126 * source.data[downIndex] + 0.7152 * source.data[downIndex + 1] + 0.0722 * source.data[downIndex + 2]) / 255;
        const edge = Math.abs(lum - rightLum) + Math.abs(lum - downLum);
        if (edge > strongestEdge) {
          strongestEdge = edge;
          edgeR = source.data[i]; edgeG = source.data[i + 1]; edgeB = source.data[i + 2];
        }
      }
      const i = (y * width + x) * 4;
      const edgeWeight = Math.min(0.3, strongestEdge * 0.9);
      const averageR = r / count; const averageG = g / count; const averageB = b / count;
      output.data[i] = averageR * (1 - edgeWeight) + edgeR * edgeWeight;
      output.data[i + 1] = averageG * (1 - edgeWeight) + edgeG * edgeWeight;
      output.data[i + 2] = averageB * (1 - edgeWeight) + edgeB * edgeWeight;
      output.data[i + 3] = 255;
    }
  }
  return output;
}

function gaussianBlur(source: ImageData, strength: number): ImageData {
  if (strength <= 0.01) return source;
  const output = new ImageData(source.width, source.height);
  const mix = Math.min(0.45, strength);
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    let r = 0; let g = 0; let b = 0; let weight = 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const xx = Math.min(source.width - 1, Math.max(0, x + dx));
      const yy = Math.min(source.height - 1, Math.max(0, y + dy));
      const w = dx === 0 && dy === 0 ? 4 : (dx === 0 || dy === 0 ? 2 : 1);
      const i = (yy * source.width + xx) * 4;
      r += source.data[i] * w; g += source.data[i + 1] * w; b += source.data[i + 2] * w; weight += w;
    }
    const i = (y * source.width + x) * 4;
    output.data[i] = source.data[i] * (1 - mix) + (r / weight) * mix;
    output.data[i + 1] = source.data[i + 1] * (1 - mix) + (g / weight) * mix;
    output.data[i + 2] = source.data[i + 2] * (1 - mix) + (b / weight) * mix;
    output.data[i + 3] = 255;
  }
  return output;
}

function sobel(source: ImageData): Float32Array {
  const width = source.width;
  const height = source.height;
  const luminance = new Float32Array(width * height);
  for (let i = 0; i < luminance.length; i += 1) {
    const p = i * 4;
    luminance[i] = (0.2126 * source.data[p] + 0.7152 * source.data[p + 1] + 0.0722 * source.data[p + 2]) / 255;
  }
  const output = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const i = y * width + x;
    const gx = -luminance[i - width - 1] + luminance[i - width + 1] - 2 * luminance[i - 1] + 2 * luminance[i + 1] - luminance[i + width - 1] + luminance[i + width + 1];
    const gy = -luminance[i - width - 1] - 2 * luminance[i - width] - luminance[i - width + 1] + luminance[i + width - 1] + 2 * luminance[i + width] + luminance[i + width + 1];
    output[i] = Math.min(1, Math.abs(gx) + Math.abs(gy));
  }
  return output;
}

function sampleColors(source: ImageData): RGBColor[] {
  const bins = new Map<number, RGBColor[]>();
  const maxPerBin = 24;
  const total = source.width * source.height;
  const step = Math.max(1, Math.ceil(total / 12000));
  for (let index = 0; index < total; index += step) {
    const p = index * 4;
    const color = { r: source.data[p], g: source.data[p + 1], b: source.data[p + 2] };
    const key = ((color.r >> 4) << 8) | ((color.g >> 4) << 4) | (color.b >> 4);
    const values = bins.get(key) ?? [];
    if (values.length < maxPerBin) values.push(color);
    bins.set(key, values);
  }
  const result: RGBColor[] = [];
  bins.forEach((values) => result.push(...values));
  return result;
}

function medianCutPalette(source: ImageData, size: number): RGBColor[] {
  let boxes: RGBColor[][] = [sampleColors(source)];
  while (boxes.length < size) {
    let index = -1;
    let range = -1;
    for (let i = 0; i < boxes.length; i += 1) {
      if (boxes[i].length < 2) continue;
      const current = channelRanges(boxes[i]);
      const largest = Math.max(current.r, current.g, current.b);
      if (largest > range) { range = largest; index = i; }
    }
    if (index < 0) break;
    const box = boxes[index];
    const ranges = channelRanges(box);
    const channel = ranges.r >= ranges.g && ranges.r >= ranges.b ? "r" : ranges.g >= ranges.b ? "g" : "b";
    box.sort((a, b) => a[channel] - b[channel]);
    const middle = Math.floor(box.length / 2);
    boxes.splice(index, 1, box.slice(0, middle), box.slice(middle));
  }
  return boxes.map((box) => {
    let r = 0; let g = 0; let b = 0;
    box.forEach((color) => { r += color.r; g += color.g; b += color.b; });
    const count = Math.max(1, box.length);
    return { r: r / count, g: g / count, b: b / count };
  });
}

function channelRanges(colors: RGBColor): never;
function channelRanges(colors: RGBColor[]): { r: number; g: number; b: number };
function channelRanges(colors: RGBColor[] | RGBColor): { r: number; g: number; b: number } {
  if (!Array.isArray(colors)) throw new Error("invalid color box");
  let rMin = 255; let rMax = 0; let gMin = 255; let gMax = 0; let bMin = 255; let bMax = 0;
  colors.forEach((color) => { rMin = Math.min(rMin, color.r); rMax = Math.max(rMax, color.r); gMin = Math.min(gMin, color.g); gMax = Math.max(gMax, color.g); bMin = Math.min(bMin, color.b); bMax = Math.max(bMax, color.b); });
  return { r: rMax - rMin, g: gMax - gMin, b: bMax - bMin };
}

function quantize(source: ImageData, palette: RGBColor[], settings: PixelArtSettings, edges: Float32Array): ImageData {
  const output = new ImageData(source.width, source.height);
  const labs = palette.map(toLab);
  const errors = settings.dithering === "floyd_steinberg" ? new Float32Array(source.width * source.height * 3) : null;
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    const pixel = y * source.width + x;
    const p = pixel * 4;
    let color = { r: source.data[p], g: source.data[p + 1], b: source.data[p + 2] };
    if (errors) { color.r += errors[pixel * 3]; color.g += errors[pixel * 3 + 1]; color.b += errors[pixel * 3 + 2]; }
    if (settings.dithering === "ordered") {
      const threshold = ((BAYER_4[(y % 4) * 4 + (x % 4)] / 15) - 0.5) * settings.dithering_strength * 48;
      color = { r: color.r + threshold, g: color.g + threshold, b: color.b + threshold };
    }
    const nearest = nearestPalette(color, palette, labs);
    const edge = edges[pixel] ?? 0;
    const adjusted = edge > 0.2 && settings.edge_enhancement > 0
      ? { r: nearest.r * (1 - settings.edge_enhancement * edge), g: nearest.g * (1 - settings.edge_enhancement * edge), b: nearest.b * (1 - settings.edge_enhancement * edge) }
      : nearest;
    output.data[p] = Math.max(0, Math.min(255, adjusted.r)); output.data[p + 1] = Math.max(0, Math.min(255, adjusted.g)); output.data[p + 2] = Math.max(0, Math.min(255, adjusted.b)); output.data[p + 3] = 255;
    if (errors) {
      const er = (color.r - nearest.r) * settings.dithering_strength;
      const eg = (color.g - nearest.g) * settings.dithering_strength;
      const eb = (color.b - nearest.b) * settings.dithering_strength;
      distributeError(errors, source.width, source.height, x + 1, y, er, eg, eb, 7 / 16);
      distributeError(errors, source.width, source.height, x - 1, y + 1, er, eg, eb, 3 / 16);
      distributeError(errors, source.width, source.height, x, y + 1, er, eg, eb, 5 / 16);
      distributeError(errors, source.width, source.height, x + 1, y + 1, er, eg, eb, 1 / 16);
    }
  }
  return output;
}

function distributeError(errors: Float32Array, width: number, height: number, x: number, y: number, r: number, g: number, b: number, amount: number) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 3;
  errors[i] += r * amount; errors[i + 1] += g * amount; errors[i + 2] += b * amount;
}

function nearestPalette(color: RGBColor, palette: RGBColor[], labs: Lab[]): RGBColor {
  const lab = toLab(color);
  let best = palette[0] ?? { r: 0, g: 0, b: 0 };
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i += 1) {
    const candidate = labs[i];
    const dl = lab[0] - candidate[0]; const da = lab[1] - candidate[1]; const db = lab[2] - candidate[2];
    const next = dl * dl * 1.2 + da * da + db * db;
    if (next < distance) { distance = next; best = palette[i]; }
  }
  return best;
}

function colorGrade(source: ImageData, settings: PixelArtSettings, edges: Float32Array): Uint8ClampedArray {
  const output = new Uint8ClampedArray(source.data);
  const contrast = 1 + settings.contrast;
  const saturation = 1 + settings.saturation;
  const sharpened = settings.sharpen > 0.01 ? sharpenImage(source) : null;
  for (let i = 0; i < output.length; i += 4) {
    let r = output[i]; let g = output[i + 1]; let b = output[i + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
    g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
    b = ((b / 255 - 0.5) * contrast + 0.5) * 255;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * saturation; g = gray + (g - gray) * saturation; b = gray + (b - gray) * saturation;
    r = 255 * Math.pow(Math.max(0, Math.min(1, r / 255)), 1 / settings.gamma);
    g = 255 * Math.pow(Math.max(0, Math.min(1, g / 255)), 1 / settings.gamma);
    b = 255 * Math.pow(Math.max(0, Math.min(1, b / 255)), 1 / settings.gamma);
    if (sharpened) { r = r * (1 - settings.sharpen) + sharpened[i] * settings.sharpen; g = g * (1 - settings.sharpen) + sharpened[i + 1] * settings.sharpen; b = b * (1 - settings.sharpen) + sharpened[i + 2] * settings.sharpen; }
    const edge = edges[i / 4] ?? 0;
    if (edge > 0.35 && settings.edge_enhancement > 0) { const lift = settings.edge_enhancement * edge * (lum > 0.5 ? 0.9 : 1.1); r *= 1 - lift * 0.12; g *= 1 - lift * 0.12; b *= 1 - lift * 0.12; }
    output[i] = Math.max(0, Math.min(255, r)); output[i + 1] = Math.max(0, Math.min(255, g)); output[i + 2] = Math.max(0, Math.min(255, b)); output[i + 3] = 255;
  }
  return output;
}

function sharpenImage(source: ImageData): Uint8ClampedArray {
  const output = new Uint8ClampedArray(source.data.length);
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    const p = (y * source.width + x) * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      const center = source.data[p + channel] * 5;
      const left = source.data[(y * source.width + Math.max(0, x - 1)) * 4 + channel];
      const right = source.data[(y * source.width + Math.min(source.width - 1, x + 1)) * 4 + channel];
      const top = source.data[(Math.max(0, y - 1) * source.width + x) * 4 + channel];
      const bottom = source.data[(Math.min(source.height - 1, y + 1) * source.width + x) * 4 + channel];
      output[p + channel] = Math.max(0, Math.min(255, center - left - right - top - bottom));
    }
    output[p + 3] = 255;
  }
  return output;
}

function backgroundFromPalette(palette: RGBColor[]): string {
  const dark = [...palette].sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b))[0] ?? { r: 12, g: 18, b: 22 };
  return `rgb(${Math.round(dark.r * 0.55)}, ${Math.round(dark.g * 0.55)}, ${Math.round(dark.b * 0.55)})`;
}

function toLab(color: RGBColor): Lab {
  const convert = (value: number) => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = convert(color.r); const g = convert(color.g); const b = convert(color.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(Math.max(0, l)); const m3 = Math.cbrt(Math.max(0, m)); const s3 = Math.cbrt(Math.max(0, s));
  return [0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3, 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3, 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3];
}
