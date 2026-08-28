import { useEffect, useRef, type RefObject } from "react";

export const TRACK_ANALYSER_BINS = 64;

type Graph = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array;
};

const graphs = new WeakMap<HTMLAudioElement, Graph | "failed">();

function connectGraph(audio: HTMLAudioElement): Graph | null {
  const existing = graphs.get(audio);
  if (existing === "failed") return null;
  if (existing) return existing;
  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const graph: Graph = {
      ctx,
      analyser,
      data: new Uint8Array(analyser.frequencyBinCount),
    };
    graphs.set(audio, graph);
    return graph;
  } catch {
    graphs.set(audio, "failed");
    return null;
  }
}

function syntheticBins(out: Float32Array, time: number, playing: boolean) {
  if (!playing) {
    out.fill(0);
    return;
  }
  for (let i = 0; i < out.length; i++) {
    const envelope = Math.exp(-i / 62);
    out[i] = Math.max(
      0.03,
      (0.34 + Math.sin(time * 2.2 + i * 0.31) * 0.18 + Math.sin(time * 0.8 + i * 0.09) * 0.16) * envelope,
    );
  }
}

export function useTrackAnalyser(
  audioRef: RefObject<HTMLAudioElement | null>,
  enabled: boolean,
  playing: boolean,
) {
  const binsRef = useRef(new Float32Array(TRACK_ANALYSER_BINS));
  const prevRef = useRef(new Float32Array(TRACK_ANALYSER_BINS));
  const enabledRef = useRef(enabled);
  const playingRef = useRef(playing);
  const readRef = useRef((time: number) => {
    const out = binsRef.current;
    const prev = prevRef.current;
    if (!enabledRef.current) {
      out.fill(0);
      prev.fill(0);
      return out;
    }
    if (!playingRef.current) {
      for (let i = 0; i < out.length; i++) {
        prev[i] *= 0.86;
        out[i] = prev[i];
      }
      return out;
    }
    const audio = audioRef.current;
    const graph = audio ? graphs.get(audio) : undefined;
    if (!graph || graph === "failed") {
      syntheticBins(out, time, true);
      prev.set(out);
      return out;
    }
    if (graph.ctx.state === "suspended") {
      void graph.ctx.resume();
      syntheticBins(out, time, true);
      prev.set(out);
      return out;
    }
    graph.analyser.getByteFrequencyData(graph.data);
    const step = graph.data.length / TRACK_ANALYSER_BINS;
    for (let i = 0; i < TRACK_ANALYSER_BINS; i++) {
      out[i] = (graph.data[Math.floor(i * step)] ?? 0) / 255;
    }
    prev.set(out);
    return out;
  });
  enabledRef.current = enabled;
  playingRef.current = playing;

  useEffect(() => {
    if (!enabled) return;
    const audio = audioRef.current;
    if (!audio) return;
    const graph = connectGraph(audio);
    if (!graph) return;
    if (playing && graph.ctx.state === "suspended") {
      void graph.ctx.resume();
    }
  }, [audioRef, enabled, playing]);

  return { readBins: readRef.current, binCount: TRACK_ANALYSER_BINS };
}
