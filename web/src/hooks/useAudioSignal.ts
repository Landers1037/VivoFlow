import { useEffect, useState } from "react";
import { AUDIO_SIGNAL_HOLD_MS, hasAudibleSignal } from "@/lib/audioSignal";
import type { AudioFrame } from "@/types";

export function useAudioSignal(frame: AudioFrame | null): boolean {
  const signal = hasAudibleSignal(frame);
  const [hasSignal, setHasSignal] = useState(signal);

  useEffect(() => {
    if (signal) {
      setHasSignal(true);
      return;
    }

    const timeout = window.setTimeout(() => setHasSignal(false), AUDIO_SIGNAL_HOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [signal]);

  return hasSignal;
}
