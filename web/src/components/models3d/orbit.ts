import { PerspectiveCamera, Spherical, Vector2, Vector3 } from "three/webgpu";

export function attachOrbit(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  options: {
    target?: Vector3;
    minDistance: number;
    maxDistance: number;
    enableRotate: boolean;
    enableZoom: boolean;
    autoRotate: boolean;
    autoRotateSpeed?: number;
  },
) {
  const target = (options.target ?? new Vector3()).clone();
  const spherical = new Spherical().setFromVector3(camera.position.clone().sub(target));
  spherical.makeSafe();
  spherical.radius = clamp(spherical.radius, options.minDistance, options.maxDistance);

  const sphericalDelta = new Spherical();
  const rotateStart = new Vector2();
  const rotateEnd = new Vector2();
  let scale = 1;
  let rotating = false;
  let pinchStart = 0;
  let autoRotate = options.autoRotate;
  let lastInteraction = -Infinity;

  const rotateSpeed = 0.0055;
  const autoSpeed = options.autoRotateSpeed ?? 0.18;

  const onPointerDown = (event: PointerEvent) => {
    if (!options.enableRotate || event.button !== 0) return;
    rotating = true;
    autoRotate = false;
    lastInteraction = performance.now();
    rotateStart.set(event.clientX, event.clientY);
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!rotating) return;
    rotateEnd.set(event.clientX, event.clientY);
    sphericalDelta.theta -= (rotateEnd.x - rotateStart.x) * rotateSpeed;
    sphericalDelta.phi -= (rotateEnd.y - rotateStart.y) * rotateSpeed;
    rotateStart.copy(rotateEnd);
    lastInteraction = performance.now();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!rotating) return;
    rotating = false;
    lastInteraction = performance.now();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };

  const onWheel = (event: WheelEvent) => {
    if (!options.enableZoom) return;
    event.preventDefault();
    autoRotate = false;
    lastInteraction = performance.now();
    const delta = event.deltaY;
    scale *= delta > 0 ? 1.08 : 0.92;
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      pinchStart = pinchDistance(event.touches);
      autoRotate = false;
      lastInteraction = performance.now();
    }
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!options.enableZoom || event.touches.length !== 2) return;
    event.preventDefault();
    const next = pinchDistance(event.touches);
    if (pinchStart > 0) scale *= pinchStart / Math.max(1, next);
    pinchStart = next;
    lastInteraction = performance.now();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });

  const offset = new Vector3();
  const update = (now: number, reduced: boolean) => {
    if (options.autoRotate && !reduced && !rotating && now - lastInteraction > 2200) {
      autoRotate = true;
    }
    if (autoRotate && !reduced) sphericalDelta.theta -= autoSpeed * 0.008;
    spherical.theta += sphericalDelta.theta;
    spherical.phi += sphericalDelta.phi;
    spherical.phi = clamp(spherical.phi, 0.18, Math.PI - 0.18);
    spherical.radius = clamp(spherical.radius * scale, options.minDistance, options.maxDistance);
    spherical.makeSafe();
    sphericalDelta.theta *= 0.86;
    sphericalDelta.phi *= 0.86;
    scale += (1 - scale) * 0.22;
    offset.setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  };

  const dispose = () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
  };

  update(performance.now(), false);
  return { update, dispose };
}

function pinchDistance(touches: TouchList) {
  const a = touches[0];
  const b = touches[1];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
