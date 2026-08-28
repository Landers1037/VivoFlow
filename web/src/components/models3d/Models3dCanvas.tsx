import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  UnsignedByteType,
  WebGPURenderer,
} from "three/webgpu";
import { shouldForceWebGL, withTimeout } from "@/components/models3d/compat";
import { attachOrbit } from "@/components/models3d/orbit";
import { createModel3dScene } from "@/components/models3d/solarSystem";
import type { Model3dId, Model3dOrbitStyle, Model3dTreeBaseShape, Model3dTreeCanopyShape } from "@/types";

export interface Models3dCanvasProps {
  modelId: Model3dId;
  orbitStyle: Model3dOrbitStyle;
  texturesEnabled: boolean;
  treeCanopyShape: Model3dTreeCanopyShape;
  treeCanopyColor: string;
  treeBaseShape: Model3dTreeBaseShape;
  treeBaseColor: string;
  treeTrunkColor: string;
  treeVariation: number;
  preview?: boolean;
  interactive?: boolean;
  className?: string;
  onUnavailable?: () => void;
}

const INIT_MS = 5000;

export default function Models3dCanvas({
  modelId,
  orbitStyle,
  texturesEnabled,
  treeCanopyShape,
  treeCanopyColor,
  treeBaseShape,
  treeBaseColor,
  treeTrunkColor,
  treeVariation,
  preview = false,
  interactive = false,
  className,
  onUnavailable,
}: Models3dCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;

    const start = async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (cancelled) return;

      let renderer: WebGPURenderer;
      try {
        renderer = await createRenderer(canvas, preview);
      } catch (error) {
        console.warn("3D model renderer failed", error);
        if (!cancelled) unavailableRef.current?.();
        return;
      }
      if (cancelled) {
        renderer.dispose();
        return;
      }

      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = preview ? 0.92 : 1.05;
      renderer.setPixelRatio(preview ? 1 : Math.min(1.5, window.devicePixelRatio || 1));

      let world: Awaited<ReturnType<typeof createModel3dScene>>;
      try {
        world = await createModel3dScene(modelId, preview, {
          orbitStyle,
          texturesEnabled,
          tree: {
            canopyShape: treeCanopyShape,
            canopyColor: treeCanopyColor,
            baseShape: treeBaseShape,
            baseColor: treeBaseColor,
            trunkColor: treeTrunkColor,
            variation: treeVariation,
          },
        });
      } catch (error) {
        console.warn("3D model scene failed", error);
        renderer.dispose();
        if (!cancelled) unavailableRef.current?.();
        return;
      }
      if (cancelled) {
        world.dispose();
        renderer.dispose();
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const orbit = attachOrbit(canvas, world.camera, {
        target: world.orbitTarget,
        minDistance: world.minDistance,
        maxDistance: world.maxDistance,
        enableRotate: interactive && !preview,
        enableZoom: interactive && !preview,
        autoRotate: preview || !interactive,
        autoRotateSpeed: preview ? 0.22 : 0.12,
      });

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        renderer.setSize(width, height, false);
        world.camera.aspect = width / height;
        world.camera.updateProjectionMatrix();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      window.visualViewport?.addEventListener("resize", resize);
      resize();

      let visible = true;
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          visible = entry?.isIntersecting ?? true;
        },
        { threshold: 0.01 },
      );
      intersectionObserver.observe(canvas);

      const onContextLost = (event: Event) => {
        event.preventDefault();
        if (!cancelled) unavailableRef.current?.();
      };
      canvas.addEventListener("webglcontextlost", onContextLost);

      let raf = 0;
      let lastRender = 0;
      let drawn = false;
      const render = (now: number) => {
        raf = requestAnimationFrame(render);
        if (drawn && document.hidden) return;
        if (preview && drawn && !visible) return;
        if (preview && drawn && now - lastRender < 1000 / 24) return;
        lastRender = now;
        const time = now / 1000;
        world.update(time, reduced);
        orbit.update(now, reduced);
        renderer.render(world.scene, world.camera);
        drawn = true;
      };

      dispose = () => {
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        window.visualViewport?.removeEventListener("resize", resize);
        intersectionObserver.disconnect();
        canvas.removeEventListener("webglcontextlost", onContextLost);
        orbit.dispose();
        world.dispose();
        renderer.dispose();
      };
      if (cancelled) {
        dispose();
        return;
      }
      raf = requestAnimationFrame(render);
    };

    void start();
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [
    interactive,
    modelId,
    orbitStyle,
    preview,
    texturesEnabled,
    treeBaseColor,
    treeBaseShape,
    treeCanopyColor,
    treeCanopyShape,
    treeTrunkColor,
    treeVariation,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ touchAction: interactive && !preview ? "none" : "auto" }}
      aria-hidden="true"
    />
  );
}

async function createRenderer(canvas: HTMLCanvasElement, preview: boolean): Promise<WebGPURenderer> {
  const preferWebGL = shouldForceWebGL();
  if (preferWebGL) return initRenderer(canvas, preview, true);
  try {
    return await initRenderer(canvas, preview, false);
  } catch (error) {
    console.warn("WebGPU 3D failed, using WebGL2", error);
    return initRenderer(canvas, preview, true);
  }
}

async function initRenderer(
  canvas: HTMLCanvasElement,
  preview: boolean,
  forceWebGL: boolean,
): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    canvas,
    antialias: !preview && !forceWebGL,
    alpha: false,
    powerPreference: preview || forceWebGL ? "low-power" : "high-performance",
    forceWebGL,
    ...(forceWebGL ? { outputBufferType: UnsignedByteType } : {}),
  });
  await withTimeout(renderer.init(), INIT_MS, "3D renderer init timed out");
  return renderer;
}
