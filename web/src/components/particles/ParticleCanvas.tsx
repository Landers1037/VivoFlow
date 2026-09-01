import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useNormalizedAudioFrame } from "@/hooks/useNormalizedAudioFrame";
import { particleBudget, type ParticleWorkerResponse } from "./particleData";
import type { AudioFrame, Particle3dMode, ParticleDimension, ParticleImage } from "@/types";

interface Props {
  image: ParticleImage;
  frame: AudioFrame | null;
  dimension: ParticleDimension;
  mode3d: Particle3dMode;
  density: number;
  size: number;
  depth: number;
  motion: number;
  audioReactive: boolean;
  audioStrength: number;
  preview?: boolean;
  interactive?: boolean;
  className?: string;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (message: string | null) => void;
}

const vertexShader = `
attribute vec3 color;
attribute vec2 particleUv;
attribute float particleLight;
attribute float particleEdge;
attribute float particleRandom;
uniform float uTime;
uniform float uDimension;
uniform float uMode;
uniform float uDepth;
uniform float uMotion;
uniform float uSize;
uniform float uPixelRatio;
uniform float uAudioStrength;
uniform float uRms;
uniform float uBeat;
uniform float uTransition;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uAudio[64];
varying vec3 vColor;
void main() {
  vec3 target = position;
  float wave = sin(position.x * 7.0 + position.y * 4.0 + uTime * 0.7 + particleRandom * 6.2831);
  if (uDimension > 0.5) {
    if (uMode < 0.5) target.z = ((particleLight - 0.5) * 0.8 + particleEdge * 0.25) * uDepth;
    else if (uMode < 1.5) target.z = wave * 0.045 * uDepth;
    else target.z = ((particleRandom - 0.5) * 1.4 + (particleLight - 0.5) * 0.2) * uDepth;
  }
  vec2 radial = normalize(position.xy + vec2(0.0001));
  float idle = wave * 0.012 * uMotion;
  target.xy += radial * idle;
  int binIndex = int(clamp(floor(particleUv.x * 64.0), 0.0, 63.0));
  float audio = uAudio[binIndex] * uAudioStrength;
  if (uDimension < 0.5) {
    target.xy += radial * audio * 0.14;
    target.z += audio * 0.06;
    if (uPointerActive > 0.5) {
      vec2 delta = target.xy - uPointer;
      float distanceToPointer = length(delta);
      target.xy += normalize(delta + vec2(0.0001)) * smoothstep(0.34, 0.0, distanceToPointer) * 0.18;
    }
  } else {
    target.z += audio * (0.18 + particleEdge * 0.12);
  }
  float burst = (uBeat * 0.34 + uTransition * (0.28 + particleRandom * 0.26));
  target.xy += radial * burst;
  target.z += (particleRandom - 0.5) * burst * 1.8;
  target *= 1.0 + uRms * uAudioStrength * 0.035;
  vec4 mvPosition = modelViewMatrix * vec4(target, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float perspectiveScale = uDimension < 0.5 ? 2.0 : clamp(7.5 / max(1.0, -mvPosition.z), 1.2, 3.2);
  gl_PointSize = max(1.0, uSize * uPixelRatio * perspectiveScale);
  vColor = color;
}`;

const fragmentShader = `
varying vec3 vColor;
void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float distanceFromCenter = length(centered);
  float alpha = 1.0 - smoothstep(0.34, 0.5, distanceFromCenter);
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(vColor, alpha);
}`;

export default function ParticleCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const normalizedFrame = useNormalizedAudioFrame(props.audioReactive ? props.frame : null);
  const propsRef = useRef({ ...props, frame: normalizedFrame });
  propsRef.current = { ...props, frame: normalizedFrame };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !props.preview, powerPreference: props.preview ? "low-power" : "high-performance" });
    } catch (error) {
      propsRef.current.onError?.(error instanceof Error ? error.message : String(error));
      return;
    }
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(props.preview ? 1 : Math.min(1.5, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    ortho.position.z = 4;
    const perspective = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
    perspective.position.set(0, 0, 3.4);
    const controls = new OrbitControls(perspective, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 5.8;
    controls.target.set(0, 0, 0);

    const audioValues = new Float32Array(64);
    const uniforms = {
      uTime: { value: 0 }, uDimension: { value: 0 }, uMode: { value: 0 }, uDepth: { value: props.depth },
      uMotion: { value: props.motion }, uSize: { value: props.size }, uPixelRatio: { value: renderer.getPixelRatio() },
      uAudioStrength: { value: props.audioStrength }, uRms: { value: 0 }, uBeat: { value: 0 },
      uTransition: { value: reduced ? 0 : 1 }, uPointer: { value: new THREE.Vector2(99, 99) },
      uPointerActive: { value: 0 }, uAudio: { value: audioValues },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.NormalBlending });
    let points: THREE.Points | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let cancelled = false;
    let transitionStart = performance.now();
    let beatStart = -Infinity;
    let lastBeatSeq = -1;
    let lastModeKey = `${props.dimension}:${props.mode3d}`;
    let imageAspect = 1;
    let fitScale2d = 1;
    let fitScale3d = 1;
    const requestId = Math.floor(Math.random() * 0x7fffffff);
    propsRef.current.onLoadingChange?.(true);
    propsRef.current.onError?.(null);
    const worker = new Worker(new URL("./particle.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<ParticleWorkerResponse>) => {
      if (cancelled || event.data.requestId !== requestId) return;
      if (event.data.error || !event.data.data?.count) {
        propsRef.current.onLoadingChange?.(false);
        propsRef.current.onError?.(event.data.error ?? "The image contains no visible pixels");
        return;
      }
      const data = event.data.data;
      imageAspect = data.imageAspect;
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
      geometry.setAttribute("particleUv", new THREE.BufferAttribute(data.uvs, 2));
      geometry.setAttribute("particleLight", new THREE.BufferAttribute(data.luminance, 1));
      geometry.setAttribute("particleEdge", new THREE.BufferAttribute(data.edges, 1));
      geometry.setAttribute("particleRandom", new THREE.BufferAttribute(data.random, 1));
      points = new THREE.Points(geometry, material);
      scene.add(points);
      resize();
      transitionStart = performance.now();
      propsRef.current.onLoadingChange?.(false);
    };
    worker.onerror = () => {
      propsRef.current.onLoadingChange?.(false);
      propsRef.current.onError?.("Particle image processing failed");
    };
    worker.postMessage({ requestId, url: props.image.content_url, density: props.density, maxParticles: particleBudget(Boolean(props.preview), mobile) });

    let width = 1;
    let height = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
      if (aspect >= 1) { ortho.left = -1.16 * aspect; ortho.right = 1.16 * aspect; ortho.top = 1.16; ortho.bottom = -1.16; }
      else { ortho.left = -1.16; ortho.right = 1.16; ortho.top = 1.16 / aspect; ortho.bottom = -1.16 / aspect; }
      ortho.updateProjectionMatrix();
      const extentX = imageAspect >= 1 ? 1 : imageAspect;
      const extentY = imageAspect >= 1 ? 1 / imageAspect : 1;
      // The sampled geometry is normalized into a unit square. On the full-page
      // canvas, fit it back to the real viewport so the image fills the stage
      // without cropping. Keep the settings preview at its compact scale.
      fitScale2d = props.preview ? 1 : Math.min(ortho.right / extentX, ortho.top / extentY) * 0.9;
      const visibleHalfHeight = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) * perspective.position.length();
      fitScale3d = props.preview ? 1 : Math.min((visibleHalfHeight * aspect) / extentX, visibleHalfHeight / extentY) * 0.86;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    let visible = true;
    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; }, { threshold: 0.01 });
    intersectionObserver.observe(canvas);
    const onPointerMove = (event: PointerEvent) => {
      if (!propsRef.current.interactive || propsRef.current.dimension !== "2d" || reduced) return;
      const rect = canvas.getBoundingClientRect();
      const aspect = rect.width / rect.height;
      uniforms.uPointer.value.set(((event.clientX - rect.left) / rect.width * 2 - 1) * (aspect >= 1 ? 1.16 * aspect : 1.16), (1 - (event.clientY - rect.top) / rect.height * 2) * (aspect >= 1 ? 1.16 : 1.16 / aspect));
      uniforms.uPointerActive.value = 1;
    };
    const clearPointer = () => { uniforms.uPointerActive.value = 0; };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", clearPointer);
    const onContextLost = (event: Event) => { event.preventDefault(); propsRef.current.onError?.("WebGL context was lost"); };
    canvas.addEventListener("webglcontextlost", onContextLost);

    let raf = 0;
    let lastRender = 0;
    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (!visible || document.hidden || (props.preview && now - lastRender < 1000 / 24)) return;
      lastRender = now;
      const latest = propsRef.current;
      const modeKey = `${latest.dimension}:${latest.mode3d}`;
      if (modeKey !== lastModeKey) { lastModeKey = modeKey; transitionStart = now; }
      const is3d = latest.dimension === "3d";
      points?.scale.setScalar(is3d ? fitScale3d : fitScale2d);
      controls.enableRotate = Boolean(latest.interactive && is3d && !latest.preview);
      controls.enableZoom = controls.enableRotate;
      if (controls.enableRotate) controls.update();
      uniforms.uTime.value = now / 1000;
      uniforms.uDimension.value = is3d ? 1 : 0;
      uniforms.uMode.value = latest.mode3d === "relief" ? 0 : latest.mode3d === "plane" ? 1 : 2;
      uniforms.uDepth.value = latest.depth;
      uniforms.uMotion.value = reduced ? 0 : latest.motion;
      uniforms.uSize.value = latest.size;
      uniforms.uAudioStrength.value = latest.audioReactive ? latest.audioStrength : 0;
      const frame = latest.frame;
      for (let i = 0; i < 64; i += 1) audioValues[i] = latest.audioReactive ? Math.min(1, frame?.bins[i] ?? 0) : 0;
      uniforms.uRms.value = latest.audioReactive ? frame?.rms ?? 0 : 0;
      if (!reduced && latest.audioReactive && frame?.beat && frame.seq !== lastBeatSeq) { lastBeatSeq = frame.seq; beatStart = now; }
      const beatProgress = (now - beatStart) / 320;
      uniforms.uBeat.value = reduced || beatProgress >= 1 ? 0 : Math.sin(Math.PI * Math.max(0, beatProgress)) * (1 - beatProgress);
      const transitionProgress = (now - transitionStart) / 480;
      uniforms.uTransition.value = reduced || transitionProgress >= 1 ? 0 : Math.pow(1 - Math.max(0, transitionProgress), 2);
      renderer.render(scene, is3d ? perspective : ortho);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelled = true;
      worker.terminate();
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", clearPointer);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      controls.dispose();
      if (points) scene.remove(points);
      geometry?.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [props.density, props.image.content_url, props.image.version, props.preview]);

  return <canvas ref={canvasRef} className={props.className} style={{ touchAction: props.interactive && props.dimension === "3d" ? "none" : "auto" }} aria-hidden="true" />;
}
