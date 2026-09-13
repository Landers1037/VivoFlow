import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CLOCK_BACKGROUND_FRAME } from "./glass/backgroundFrame";
import Aurora from "./backgrounds/Aurora";
import Beams from "./backgrounds/Beams";
import Dither from "./backgrounds/Dither";
import Galaxy from "./backgrounds/Galaxy";
import GhostFibers from "./backgrounds/GhostFibers";
import GradientWaves from "./backgrounds/GradientWaves";
import Lightfall from "./backgrounds/Lightfall";
import LiquidEther from "./backgrounds/LiquidEther";
import Plasma from "./backgrounds/Plasma";
import type { ClockGlassBackground } from "@/types";

export interface ClockBackgroundRendererProps {
  background: ClockGlassBackground;
  reduced: boolean;
  onFrame: (canvas: HTMLCanvasElement) => void;
  onError?: () => void;
}

const COLORS = ["#5227FF", "#FF9FFC", "#B497CF"];

export const ClockBackgroundRenderer = memo(
  function ClockBackgroundRenderer({ background, reduced, onFrame, onError }: ClockBackgroundRendererProps) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [mobile, setMobile] = useState(() => window.matchMedia("(pointer: coarse), (max-width: 600px)").matches);

    useEffect(() => {
      const query = window.matchMedia("(pointer: coarse), (max-width: 600px)");
      const update = () => setMobile(query.matches);
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }, []);

    useLayoutEffect(() => {
      const root = rootRef.current;
      if (!root || background === "none") {
        return;
      }

      let notified = false;
      const frame = (event: Event) => {
        if (event.target instanceof HTMLCanvasElement) {
          notified = true;
          onFrame(event.target);
        }
      };
      root.addEventListener(CLOCK_BACKGROUND_FRAME, frame);
      const failureTimer = window.setTimeout(() => {
        if (!notified) onError?.();
      }, 8000);
      return () => {
        root.removeEventListener(CLOCK_BACKGROUND_FRAME, frame);
        window.clearTimeout(failureTimer);
      };
    }, [background, onFrame, onError]);

    let content: ReactNode = null;
    switch (background) {
      case "liquid_ether":
        content = (
          <LiquidEther
            colors={COLORS}
            mouseForce={20}
            cursorSize={100}
            isViscous={false}
            viscous={30}
            iterationsViscous={mobile ? 20 : 32}
            iterationsPoisson={mobile ? 20 : 32}
            resolution={mobile ? 0.35 : 0.5}
            isBounce={false}
            autoDemo={!reduced}
            autoSpeed={reduced ? 0 : 0.5}
            autoIntensity={2.2}
            takeoverDuration={0.25}
            autoResumeDelay={3000}
            autoRampDuration={0.6}
            backgroundColor="#000000"
            interactive={false}
            maxFps={mobile ? 30 : 60}
            maxDpr={mobile ? 1.5 : 2}
          />
        );
        break;
      case "aurora":
        content = <Aurora colorStops={COLORS} amplitude={1} blend={0.5} speed={reduced ? 0 : 0.7} />;
        break;
      case "plasma":
        content = (
          <Plasma
            color="#7c3aed"
            speed={reduced ? 0 : 0.8}
            scale={1}
            opacity={0.95}
            mouseInteractive={false}
            renderScale={mobile ? 0.45 : 0.6}
            maxDpr={mobile ? 1.5 : 2}
            targetFps={mobile ? 30 : 60}
            iterations={mobile ? 38 : 60}
          />
        );
        break;
      case "beams":
        content = (
          <Beams
            beamWidth={0.8}
            beamHeight={30}
            beamNumber={6}
            lightColor="#9cecff"
            beamColor="#5a67ff"
            backgroundColor="#070d1a"
            speed={reduced ? 0 : 1.2}
            noiseIntensity={1.4}
            scale={1.2}
            rotation={22}
            dpr={mobile ? 1.5 : 2}
          />
        );
        break;
      case "ghost_fibers":
        content = (
          <GhostFibers
            lineColor="#5beaff"
            glowColor="#ff8ee9"
            speed={reduced ? 0 : 0.7}
            rotationSpeed={reduced ? 0 : 0.12}
            layers={4}
            glowIntensity={1.2}
            brightness={1.15}
            blueBoost={1.1}
            dpr={mobile ? 1.5 : 2}
            fps={mobile ? 30 : 60}
            paused={reduced}
          />
        );
        break;
      case "gradient_waves":
        content = (
          <GradientWaves
            horizonColor="#071017"
            waveColor="#3d7eff"
            crestColor="#b9faff"
            speed={reduced ? 0 : 0.6}
            amplitude={0.42}
            waveScale={1.2}
            waveRatio={1.4}
            swell={0.55}
            turbulence={0.24}
            detail={mobile ? "low" : "medium"}
            brightness={1.1}
            opacity={0.92}
            mouseInteraction={false}
            dpr={mobile ? 1.5 : 2}
          />
        );
        break;
      case "lightfall":
        content = (
          <Lightfall
            colors={COLORS}
            backgroundColor="#071017"
            speed={reduced ? 0 : 0.8}
            dpr={mobile ? 1.5 : 2}
            paused={reduced}
            mouseInteraction={false}
            opacity={0.94}
          />
        );
        break;
      case "dither":
        content = (
          <Dither
            waveSpeed={reduced ? 0 : 0.05}
            waveFrequency={3}
            waveAmplitude={0.3}
            waveColor={[0.38, 0.75, 1]}
            backgroundColor={[0.02, 0.04, 0.08]}
            colorNum={5}
            pixelSize={mobile ? 3 : 2}
            disableAnimation={reduced}
            enableMouseInteraction={false}
          />
        );
        break;
      case "galaxy":
        content = (
          <Galaxy
            focal={[0.5, 0.5]}
            rotation={[1, 0]}
            starSpeed={reduced ? 0 : 0.5}
            density={1}
            hueShift={190}
            disableAnimation={reduced}
            speed={reduced ? 0 : 0.8}
            mouseInteraction={false}
            mouseRepulsion={false}
            glowIntensity={0.42}
            saturation={0.3}
            transparent
          />
        );
        break;
      default:
        content = null;
    }

    return (
      <div ref={rootRef} className="clock-liquid-glass-background" data-background={background} aria-hidden="true">
        {content}
      </div>
    );
  },
);
