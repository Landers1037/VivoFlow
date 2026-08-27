import { startBlackholeGpu, isWebGpuAvailable } from "./blackholeGpu";
import { startBlackholeWebgl } from "./blackholeWebgl";
import type { BlackholeGpuParams } from "./blackholeRuntime";

export type { BlackholeGpuParams };

function preferWebGlOnly(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("bhgl") === "1";
  } catch {
    return false;
  }
}

export async function startBlackholeRenderer(
  canvas: HTMLCanvasElement,
  params: { current: BlackholeGpuParams },
): Promise<() => void> {
  if (isWebGpuAvailable() && !preferWebGlOnly()) {
    try {
      return await startBlackholeGpu(canvas, params);
    } catch (error) {
      console.warn("WebGPU black hole failed, falling back to WebGL2", error);
    }
  }
  return startBlackholeWebgl(canvas, params);
}
