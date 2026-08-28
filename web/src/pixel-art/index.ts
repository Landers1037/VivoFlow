export * from "./pipeline";
export * from "./types";
import type { PixelArtResult } from "./types";

export async function decodeImageFile(file: File, maxEdge: number): Promise<ImageData> {
  // Prefer the bitmap decoder when available so EXIF orientation is applied
  // explicitly. Older iOS Safari versions do not expose createImageBitmap;
  // the HTMLImageElement fallback still uses the browser's normal orientation
  // handling.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      try {
        return rasterize(bitmap, bitmap.width, bitmap.height, maxEdge);
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to the broadly supported <img> decoder.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return rasterize(image, image.naturalWidth || image.width, image.naturalHeight || image.height, maxEdge);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rasterize(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxEdge: number): ImageData {
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

export function renderPixelArt(canvas: HTMLCanvasElement, result: PixelArtResult): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = Math.min(canvas.width / result.width, canvas.height / result.height);
  const width = Math.max(1, Math.round(result.width * ratio));
  const height = Math.max(1, Math.round(result.height * ratio));
  const x = Math.round((canvas.width - width) / 2);
  const y = Math.round((canvas.height - height) / 2);
  const tiny = document.createElement("canvas");
  tiny.width = result.width; tiny.height = result.height;
  tiny.getContext("2d")?.putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
  context.fillStyle = result.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(tiny, x, y, width, height);
}
