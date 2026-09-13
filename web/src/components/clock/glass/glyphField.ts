export const GLYPH_SIZE = 256;
export const DISTANCE_RANGE = 24;

export interface GlyphField {
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
  pixels: Uint8Array;
}

// Squared Euclidean distance transform, separable lower envelope of parabolas.
function distanceTransform(mask: Uint8ClampedArray, width: number, height: number, inside: boolean) {
  const values = new Float64Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = (mask[i * 4 + 3] >= 128) === inside ? 0 : 1e12;
  const size = Math.max(width, height);
  const input = new Float64Array(size);
  const output = new Float64Array(size);
  const sites = new Int32Array(size);
  const limits = new Float64Array(size + 1);
  const transform = (length: number) => {
    let k = 0;
    sites[0] = 0;
    limits[0] = -Infinity;
    limits[1] = Infinity;
    for (let q = 1; q < length; q++) {
      let s = 0;
      do {
        const p = sites[k];
        s = ((input[q] + q * q) - (input[p] + p * p)) / (2 * (q - p));
        if (s > limits[k]) break;
        k--;
      } while (k >= 0);
      k++;
      sites[k] = q;
      limits[k] = s;
      limits[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < length; q++) {
      while (limits[k + 1] < q) k++;
      output[q] = (q - sites[k]) ** 2 + input[sites[k]];
    }
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) input[x] = values[y * width + x];
    transform(width);
    for (let x = 0; x < width; x++) values[y * width + x] = output[x];
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) input[y] = values[y * width + x];
    transform(height);
    for (let y = 0; y < height; y++) values[y * width + x] = Math.sqrt(output[y]);
  }
  return values;
}

export function createGlyphField(character: string, font: string): GlyphField {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Clock glyph canvas unavailable");
  context.font = font;
  const measure = context.measureText(character);
  const padding = 8;
  const left = Math.ceil(measure.actualBoundingBoxLeft) + padding;
  const top = Math.ceil(measure.actualBoundingBoxAscent) + padding;
  const width = Math.ceil(measure.actualBoundingBoxLeft + measure.actualBoundingBoxRight) + padding * 2;
  const height = Math.ceil(measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent) + padding * 2;
  canvas.width = width;
  canvas.height = height;
  context.font = font;
  context.fillStyle = "white";
  // Canvas rasterizes the union of contours; internal font overlaps never become glass seams.
  context.fillText(character, left, top);
  const alpha = context.getImageData(0, 0, width, height).data;
  const toInside = distanceTransform(alpha, width, height, true);
  const toOutside = distanceTransform(alpha, width, height, false);
  const distance = new Float32Array(width * height);
  for (let i = 0; i < distance.length; i++) {
    distance[i] = alpha[i * 4 + 3] >= 128 ? toOutside[i] - 0.5 : 0.5 - toInside[i];
  }
  // GlassSurface blurs its displacement image. Smooth the distance gradient too,
  // otherwise pixel stair steps in a font outline turn into ridges in the glass.
  const kernel = Array.from({ length: 19 }, (_, i) => Math.exp(-((i - 9) ** 2) / 18));
  const sum = kernel.reduce((a, b) => a + b, 0);
  const horizontal = new Float32Array(width * height);
  const smooth = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let k = -9; k <= 9; k++) horizontal[y * width + x] += distance[y * width + Math.max(0, Math.min(width - 1, x + k))] * kernel[k + 9] / sum;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let k = -9; k <= 9; k++) smooth[y * width + x] += horizontal[Math.max(0, Math.min(height - 1, y + k)) * width + x] * kernel[k + 9] / sum;
  }
  const at = (x: number, y: number) => smooth[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = at(x - 2, y) - at(x + 2, y);
      const ny = at(x, y - 2) - at(x, y + 2);
      // Keep the gradient's magnitude: displacement tends to zero at the medial
      // axis instead of flipping abruptly where the two sides of a stroke meet.
      const length = Math.max(4, Math.hypot(nx, ny));
      pixels[i * 4] = Math.round((nx / length * 0.5 + 0.5) * 255);
      pixels[i * 4 + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      pixels[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, smooth[i] / DISTANCE_RANGE * 0.5 + 0.5)) * 255);
      pixels[i * 4 + 3] = alpha[i * 4 + 3];
    }
  }
  return { width, height, left, top, advance: Math.max(measure.width, width - padding * 2), pixels };
}
