import type { AudioFrame } from "@/types";

export const AUDIO_SIGNAL_PEAK_GATE = 0.0002;
export const AUDIO_SIGNAL_RMS_GATE = 0.00005;
export const AUDIO_SIGNAL_HOLD_MS = 1_500;

const TARGET_PEAK = 0.35;
const MAX_AUTO_GAIN = 48;
const GAIN_ATTACK_MS = 120;
const GAIN_RELEASE_MS = 900;

export interface AutoGainState {
  gain: number;
  updatedAt: number;
}

export function hasAudibleSignal(frame: AudioFrame | null): boolean {
  if (!frame) return false;
  const peak = finitePositive(frame.peak);
  const rms = finitePositive(frame.rms);
  return peak >= AUDIO_SIGNAL_PEAK_GATE || rms >= AUDIO_SIGNAL_RMS_GATE;
}

export function initialAutoGainState(now: number): AutoGainState {
  return { gain: 1, updatedAt: now };
}

export function normalizeAudioFrame(
  frame: AudioFrame | null,
  previous: AutoGainState,
  now: number,
): { frame: AudioFrame | null; state: AutoGainState } {
  if (!frame) return { frame: null, state: { ...previous, updatedAt: now } };

  const peak = finitePositive(frame.peak);
  const signal = hasAudibleSignal(frame);
  const targetGain = signal && peak > 0
    ? clamp(TARGET_PEAK / peak, 1, MAX_AUTO_GAIN)
    : 1;
  const elapsed = clamp(now - previous.updatedAt, 0, 1_000);
  const timeConstant = targetGain > previous.gain ? GAIN_ATTACK_MS : GAIN_RELEASE_MS;
  const blend = elapsed === 0 ? 0 : 1 - Math.exp(-elapsed / timeConstant);
  const gain = clamp(previous.gain + (targetGain - previous.gain) * blend, 1, MAX_AUTO_GAIN);
  const state = { gain, updatedAt: now };

  if (!signal) {
    return {
      frame: { ...frame, bins: frame.bins.map(() => 0), rms: 0, peak: 0, beat: false },
      state,
    };
  }

  return {
    frame: {
      ...frame,
      bins: frame.bins.map((value) => clamp(finitePositive(value) * gain, 0, 1)),
      rms: clamp(finitePositive(frame.rms) * gain, 0, 1),
      peak: clamp(peak * gain, 0, 1),
    },
    state,
  };
}

function finitePositive(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
