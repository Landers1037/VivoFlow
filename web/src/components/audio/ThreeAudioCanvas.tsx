import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createAudioThreeScene } from "@/components/audio/threeScenes";
import type { AudioFrame, ThreeAudioVisualizerMode } from "@/types";

export interface ThreeAudioCanvasProps {
  frame: AudioFrame | null;
  mode: ThreeAudioVisualizerMode;
  primary: string;
  secondary: string;
  gradient: boolean;
  amplitude: number;
  smoothing: number;
  preview?: boolean;
  interactive?: boolean;
  className?: string;
  onUnavailable?: () => void;
}

const quietBins = new Array(64).fill(0) as number[];
const previewBins = (time: number) => Array.from({ length: 64 }, (_, i) => {
  const envelope = 0.96 - i / 130;
  return Math.max(0.025, (0.34 + Math.sin(time * 2.15 + i * 0.31) * 0.17 + Math.sin(time * 0.72 + i * 0.105) * 0.15) * envelope);
});

function bloomSettings(dark: boolean) {
  return dark
    ? { strength: 0.28, radius: 0.36, threshold: 0.76 }
    : { strength: 0.14, radius: 0.28, threshold: 0.84 };
}

function exposureFor(dark: boolean, preview: boolean) {
  if (!dark) return 0.86;
  return preview ? 1.02 : 0.9;
}

export default function ThreeAudioCanvas(props: ThreeAudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: !props.preview && window.innerWidth > 640, powerPreference: "high-performance" });
    } catch {
      propsRef.current.onUnavailable?.();
      return;
    }

    const mobile = window.matchMedia("(max-width: 640px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(props.preview ? 46 : 50, 1, 0.1, 100);
    const audioScene = createAudioThreeScene(props.mode, scene, mobile, Boolean(props.preview));
    camera.position.copy(audioScene.cameraPosition);
    camera.lookAt(0, 0.8, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposureFor(resolvedTheme === "dark", Boolean(props.preview));
    renderer.setPixelRatio(props.preview ? 1 : Math.min(1.5, window.devicePixelRatio || 1));

    let composer: EffectComposer | null = null;
    let bloom: UnrealBloomPass | null = null;
    if (!props.preview) {
      const bloomConfig = bloomSettings(resolvedTheme === "dark");
      composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), bloomConfig.strength, bloomConfig.radius, bloomConfig.threshold);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }

    let lastInteraction = -Infinity;
    const controls = props.interactive && !props.preview ? new OrbitControls(camera, canvas) : null;
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.055;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.minPolarAngle = Math.PI * 0.2;
      controls.maxPolarAngle = Math.PI * 0.72;
      controls.target.set(0, 0.8, 0);
      controls.autoRotate = !reduced;
      controls.autoRotateSpeed = 0.32;
      controls.addEventListener("start", () => { controls.autoRotate = false; lastInteraction = performance.now(); });
      controls.addEventListener("end", () => { lastInteraction = performance.now(); });
    }

    let width = 1, height = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      composer?.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let visible = true;
    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; }, { threshold: 0.01 });
    intersectionObserver.observe(canvas);
    const onContextLost = (event: Event) => { event.preventDefault(); propsRef.current.onUnavailable?.(); };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const smoothed = new Array(64).fill(0) as number[];
    let raf = 0, lastRender = 0, lastTheme = "";
    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (!visible || document.hidden || (props.preview && now - lastRender < 1000 / 24)) return;
      lastRender = now;
      const latest = propsRef.current;
      const time = now / 1000;
      const raw = latest.frame?.bins?.length === 64 ? latest.frame.bins : latest.preview ? previewBins(time) : quietBins;
      const smoothing = reduced ? Math.max(0.8, latest.smoothing) : latest.smoothing;
      for (let i = 0; i < 64; i++) smoothed[i] = smoothed[i] * smoothing + Math.min(1, (raw[i] ?? 0) * latest.amplitude) * (1 - smoothing);
      const dark = themeRef.current === "dark";
      if (lastTheme !== String(dark)) {
        lastTheme = String(dark);
        audioScene.setTheme(dark);
        renderer.toneMappingExposure = exposureFor(dark, Boolean(latest.preview));
        if (bloom) {
          const bloomConfig = bloomSettings(dark);
          bloom.strength = bloomConfig.strength;
          bloom.radius = bloomConfig.radius;
          bloom.threshold = bloomConfig.threshold;
        }
      }
      audioScene.update({
        bins: smoothed,
        rms: latest.frame?.rms ?? smoothed.reduce((sum, value) => sum + value, 0) / 64,
        peak: latest.frame?.peak ?? Math.max(...smoothed),
        beat: Boolean(latest.frame?.beat),
        seq: latest.frame?.seq ?? Math.floor(time * 24),
        time,
        primary: latest.primary,
        secondary: latest.gradient ? latest.secondary : latest.primary,
        dark,
        reduced,
      });
      if (controls) {
        if (!reduced && now - lastInteraction > 2000) controls.autoRotate = true;
        controls.update();
      }
      if (composer) composer.render(); else renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      controls?.dispose();
      audioScene.dispose();
      composer?.dispose();
      renderer.dispose();
    };
  }, [props.interactive, props.mode, props.preview]);

  return <canvas ref={canvasRef} className={props.className} style={{ touchAction: props.interactive ? "none" : "auto" }} aria-hidden="true" />;
}
