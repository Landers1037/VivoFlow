import { useMemo, useRef } from "react";
import { initialAutoGainState, normalizeAudioFrame } from "@/lib/audioSignal";
import type { AudioFrame } from "@/types";

export function useNormalizedAudioFrame(frame: AudioFrame | null) {
  const autoGain = useRef(initialAutoGainState(performance.now()));
  return useMemo(() => {
    const normalized = normalizeAudioFrame(frame, autoGain.current, performance.now());
    autoGain.current = normalized.state;
    return normalized.frame;
  }, [frame]);
}
