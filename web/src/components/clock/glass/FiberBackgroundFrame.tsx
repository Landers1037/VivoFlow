import { useFrame } from "@react-three/fiber";
import { publishBackgroundFrame } from "./backgroundFrame";

export function FiberBackgroundFrame({ afterComposer = false }: { afterComposer?: boolean }) {
  useFrame(({ gl, scene, camera }) => {
    // Dither's EffectComposer owns priority 1; capture its postprocessed output.
    if (!afterComposer) gl.render(scene, camera);
    publishBackgroundFrame(gl.domElement);
  }, afterComposer ? 2 : 1);
  return null;
}
