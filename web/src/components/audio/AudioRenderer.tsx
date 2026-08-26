import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AudioCanvas } from "@/components/audio/AudioCanvas";
import { useAppearance } from "@/hooks/useAppearance";
import { initialAutoGainState, normalizeAudioFrame } from "@/lib/audioSignal";
import { cn } from "@/lib/utils";
import { isThreeAudioMode, type AudioFrame, type AudioVisualizerMode } from "@/types";

const ThreeAudioCanvas = lazy(() => import("@/components/audio/ThreeAudioCanvas"));

interface Props {
  frame: AudioFrame | null;
  mode: AudioVisualizerMode;
  primary: string;
  secondary: string;
  gradient: boolean;
  amplitude: number;
  smoothing: number;
  preview?: boolean;
  interactive?: boolean;
  className?: string;
}

export function AudioRenderer(props: Props) {
  const { t } = useAppearance();
  const [webglFailed, setWebglFailed] = useState(false);
  const autoGain = useRef(initialAutoGainState(performance.now()));
  const normalizedFrame = useMemo(() => {
    const normalized = normalizeAudioFrame(props.frame, autoGain.current, performance.now());
    autoGain.current = normalized.state;
    return normalized.frame;
  }, [props.frame]);
  const rendererProps = { ...props, frame: normalizedFrame };
  useEffect(() => setWebglFailed(false), [props.mode]);

  if (!isThreeAudioMode(props.mode) || webglFailed) {
    return <div className={cn("relative", props.className)}>
      <AudioCanvas {...rendererProps} mode={webglFailed ? "radial" : props.mode} className="h-full w-full" />
      {webglFailed ? <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg border border-amber-500/20 bg-card/85 px-3 py-2 text-center text-[11px] text-muted-foreground backdrop-blur">{t("audioWebglFallback")}</div> : null}
    </div>;
  }

  return <div className={cn("relative overflow-hidden", props.className)}>
    <Suspense fallback={<AudioCanvas {...rendererProps} mode="radial" className="h-full w-full" />}>
      <ThreeAudioCanvas {...rendererProps} mode={props.mode} className="h-full w-full" onUnavailable={() => setWebglFailed(true)} />
    </Suspense>
  </div>;
}
