import type { PixelArtSettings } from "@/types";

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface ImageStats {
  averageLuminance: number;
  luminanceStdDev: number;
  saturationMean: number;
  saturationStdDev: number;
  gradientMean: number;
  gradientP90: number;
  edgeDensity: number;
  colorVariance: number;
  darkRatio: number;
  brightRatio: number;
}

export interface PixelArtResult {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  palette: RGBColor[];
  stats: ImageStats;
  background: string;
  settings: PixelArtSettings;
}

export interface PixelArtWorkerRequest {
  requestId: number;
  imageData: ImageData;
  settings: PixelArtSettings;
  preview?: boolean;
}

export interface PixelArtWorkerResponse {
  requestId: number;
  result?: PixelArtResult;
  error?: string;
}
