import { useCallback, useEffect, useRef, useState } from "react";

export type AgentVoiceState =
  | "off" | "starting" | "ready" | "listening" | "transcribing"
  | "thinking" | "speaking" | "permission" | "unsupported" | "insecure" | "error";

type TranscriptEvent = { text: string; final: boolean };
type VoiceOptions = {
  enabled: boolean;
  wakeWord?: string;
  transcriptEnabled?: boolean;
  onTranscript?: (event: TranscriptEvent) => void;
  onUtterance?: (text: string) => void;
};

function voiceWsUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/agent-voice`;
}

function toBytes(value: ArrayBuffer): Uint8Array {
  return new Uint8Array(value.slice(0));
}

function wavFromPcm(frames: Uint8Array[]) {
  const length = frames.reduce((sum, frame) => sum + frame.byteLength, 0);
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + length, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, length, true);
  let offset = 44;
  for (const frame of frames) { new Uint8Array(buffer, offset, frame.byteLength).set(frame); offset += frame.byteLength; }
  return new Blob([buffer], { type: "audio/wav" });
}

const WAKE_IGNORED = /[\s，。！？、,.!?；;：“”‘’'"`~·]/;

export function normalizeWakeText(value: string) {
  return value.toLocaleLowerCase().replace(/[\s，。！？、,.!?；;：“”‘’'"`~·]/g, "");
}

export function removeWakeWord(text: string, wakeWord: string) {
  const source = String(text || "");
  const normalized = normalizeWakeText(source);
  const normalizedWake = normalizeWakeText(wakeWord);
  if (!normalizedWake) return null;
  const index = normalized.indexOf(normalizedWake);
  if (index < 0) return null;
  let normalizedOffset = 0;
  let start = -1;
  let end = -1;
  for (let offset = 0; offset < source.length;) {
    const codePoint = source.codePointAt(offset);
    if (codePoint == null) break;
    const char = String.fromCodePoint(codePoint);
    const width = char.length;
    if (!WAKE_IGNORED.test(char)) {
      if (normalizedOffset === index) start = offset;
      normalizedOffset += char.toLocaleLowerCase().length;
      if (start >= 0 && normalizedOffset >= index + normalizedWake.length) {
        end = offset + width;
        break;
      }
    }
    offset += width;
  }
  if (start < 0 || end < 0) return null;
  return source.slice(end).replace(/^[\s，。！？、,.!?；;：]+/, "").trim();
}

async function transcribe(frames: Uint8Array[], signal?: AbortSignal) {
  const response = await fetch("/api/agent/transcribe", { method: "POST", body: wavFromPcm(frames), headers: { "content-type": "audio/wav" }, signal });
  const payload = await response.json() as { text?: string; error?: string };
  if (!response.ok) throw new Error(payload.error || `transcribe_http_${response.status}`);
  return String(payload.text || "").trim();
}

export function useAgentVoice(input: boolean | VoiceOptions) {
  const options: VoiceOptions = typeof input === "boolean" ? { enabled: input } : input;
  const enabled = options.enabled;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [state, setState] = useState<AgentVoiceState>(enabled ? "starting" : "off");
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [conversationActive, setConversationActive] = useState(false);
  const cleanupRef = useRef<() => void>(() => {});
  const generationRef = useRef(0);
  const pausedRef = useRef(false);
  const activeRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  const preRollRef = useRef<Uint8Array[]>([]);
  const segmentRef = useRef<Uint8Array[]>([]);
  const speechRef = useRef(false);
  const segmentIdRef = useRef(0);
  const partialBusyRef = useRef(false);
  const lastPartialRef = useRef(0);
  const finalAbortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      activeRef.current = false;
      setConversationActive(false);
      setState("ready");
    }, 30_000);
  }, []);

  const emitTranscript = useCallback((event: TranscriptEvent) => {
    setTranscript(event.text);
    optionsRef.current.onTranscript?.(event);
  }, []);

  const emitUtterance = useCallback((text: string) => {
    const value = text.trim();
    if (!value || pausedRef.current) return;
    activeRef.current = true;
    setConversationActive(true);
    resetIdleTimer();
    optionsRef.current.onUtterance?.(value);
  }, [resetIdleTimer]);

  const handleFinalText = useCallback((text: string) => {
    emitTranscript({ text, final: true });
    if (!text) {
      if (activeRef.current) resetIdleTimer();
      setState("ready");
      return;
    }
    const wakeWord = optionsRef.current.wakeWord || "小薇小薇";
    if (!activeRef.current) {
      const remainder = removeWakeWord(text, wakeWord);
      if (remainder == null) { setState("ready"); return; }
      activeRef.current = true;
      setConversationActive(true);
      if (remainder) emitUtterance(remainder);
      else { resetIdleTimer(); setState("listening"); }
      return;
    }
    emitUtterance(text);
  }, [emitTranscript, emitUtterance, resetIdleTimer]);

  const sendPartial = useCallback((frames: Uint8Array[], generation: number, segmentId: number) => {
    if (!optionsRef.current.transcriptEnabled || partialBusyRef.current || frames.length < 4) return;
    const now = performance.now();
    if (now - lastPartialRef.current < 900) return;
    lastPartialRef.current = now;
    partialBusyRef.current = true;
    void transcribe(frames).then((text) => {
      if (generation === generationRef.current && segmentId === segmentIdRef.current && text) emitTranscript({ text, final: false });
    }).catch(() => {}).finally(() => { partialBusyRef.current = false; });
  }, [emitTranscript]);

  const flushSegment = useCallback(() => {
    if (!speechRef.current || segmentRef.current.length < 4 || pausedRef.current) return;
    speechRef.current = false;
    const frames = segmentRef.current;
    segmentRef.current = [];
    const segmentId = segmentIdRef.current;
    segmentIdRef.current += 1;
    finalAbortRef.current?.abort();
    const controller = new AbortController();
    finalAbortRef.current = controller;
    setState("transcribing");
    const generation = generationRef.current;
    void transcribe(frames, controller.signal)
      .then((text) => { if (generation === generationRef.current && segmentId === segmentIdRef.current - 1) handleFinalText(text); })
      .catch((error) => { if (generation === generationRef.current && (error as Error).name !== "AbortError") setState("error"); })
      .finally(() => { if (finalAbortRef.current === controller) finalAbortRef.current = null; });
  }, [handleFinalText]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    finalAbortRef.current?.abort();
    finalAbortRef.current = null;
    segmentIdRef.current += 1;
    cleanupRef.current();
    cleanupRef.current = () => {};
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    activeRef.current = false;
    setConversationActive(false);
    preRollRef.current = [];
    segmentRef.current = [];
    speechRef.current = false;
    setLevel(0);
    setState(enabled ? "permission" : "off");
  }, [enabled]);

  const start = useCallback(async () => {
    cleanupRef.current();
    finalAbortRef.current?.abort();
    finalAbortRef.current = null;
    segmentIdRef.current += 1;
    const generation = ++generationRef.current;
    if (!enabled) { setState("off"); return; }
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") { setState("insecure"); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) { setState("unsupported"); return; }
    setState("starting");
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let socket: WebSocket | null = null;
    let workletUrl: string | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== generationRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      context = new AudioContext();
      await context.resume().catch(() => {});
      const source = context.createMediaStreamSource(stream);
      const code = `class VFVoice extends AudioWorkletProcessor{constructor(){super();this.buf=[];this.acc=0}process(i){const a=i[0]?.[0];if(!a)return true;const step=sampleRate/16000;for(let p=0;p<a.length;p++){this.acc++;if(this.acc>=step){this.acc-=step;this.buf.push(Math.max(-1,Math.min(1,a[p])));if(this.buf.length===640){const o=new Int16Array(640);for(let j=0;j<640;j++)o[j]=this.buf[j]<0?this.buf[j]*32768:this.buf[j]*32767;this.port.postMessage(o.buffer,[o.buffer]);this.buf=[]}}}return true}}registerProcessor('vf-agent-voice',VFVoice);`;
      workletUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      await context.audioWorklet.addModule(workletUrl);
      if (generation !== generationRef.current) { stream.getTracks().forEach((track) => track.stop()); await context.close(); URL.revokeObjectURL(workletUrl); return; }
      // Keep the worklet in the browser's render graph while routing its
      // output through a zero-gain sink.  A disconnected worklet may be
      // suspended by some browsers; the silent sink avoids microphone echo.
      const node = new AudioWorkletNode(context, "vf-agent-voice", { numberOfOutputs: 1 });
      const silentSink = context.createGain();
      silentSink.gain.value = 0;
      source.connect(node);
      node.connect(silentSink);
      silentSink.connect(context.destination);
      socket = new WebSocket(voiceWsUrl());
      socket.binaryType = "arraybuffer";
      socket.onopen = () => socket?.send(JSON.stringify({ type: "start", session_id: sessionIdRef.current, sample_rate: 16000, channels: 1, format: "pcm_s16le", frame_ms: 40 }));
      socket.onclose = () => {
        if (generation !== generationRef.current) return;
        cleanupRef.current();
        cleanupRef.current = () => {};
        setState("error");
      };
      socket.onmessage = (event) => {
        let msg: { type?: string; listening?: boolean; level?: number };
        try { msg = JSON.parse(String(event.data)); } catch { setState("error"); return; }
        if (msg.type === "ready") setState("ready");
        if (msg.type === "voice_state") {
          setLevel(Number(msg.level) || 0);
          if (msg.listening && !pausedRef.current) {
            if (!speechRef.current) { segmentIdRef.current += 1; speechRef.current = true; segmentRef.current = [...preRollRef.current]; }
            setState("listening");
          } else if (!msg.listening && speechRef.current) flushSegment();
          else if (!pausedRef.current) setState("ready");
        }
        if (msg.type === "error") setState("error");
      };
      node.port.onmessage = (event) => {
        const frame = toBytes(event.data as ArrayBuffer);
        preRollRef.current = [...preRollRef.current, frame].slice(-8);
        if (!pausedRef.current && speechRef.current) {
          if (segmentRef.current.length >= 750) flushSegment();
          if (speechRef.current) { segmentRef.current.push(frame); sendPartial([...segmentRef.current], generation, segmentIdRef.current); }
        }
        if (!pausedRef.current && socket?.readyState === WebSocket.OPEN) {
          // Keep a slow/mobile connection from retaining unbounded PCM in the
          // browser's WebSocket queue.
          if (socket.bufferedAmount > 256 * 1024) {
            socket.close(1009, "audio_buffer_limit");
          } else {
            socket.send(frame);
          }
        }
      };
      cleanupRef.current = () => { try { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "stop" })); } catch {} socket?.close(); node.disconnect(); silentSink.disconnect(); source.disconnect(); stream?.getTracks().forEach((track) => track.stop()); void context?.close(); if (workletUrl) URL.revokeObjectURL(workletUrl); };
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop()); void context?.close(); if (workletUrl) URL.revokeObjectURL(workletUrl);
      setState(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "permission" : "error");
    }
  }, [enabled, flushSegment, sendPartial]);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    if (paused) {
      if (idleTimerRef.current != null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      finalAbortRef.current?.abort();
      finalAbortRef.current = null;
      segmentIdRef.current += 1;
      speechRef.current = false;
      segmentRef.current = [];
      setState(enabled ? "thinking" : "off");
    }
    else if (enabled) {
      if (activeRef.current) resetIdleTimer();
      setState("ready");
    }
    else setState("off");
  }, [enabled, resetIdleTimer]);

  const submitText = useCallback((text: string) => {
    activeRef.current = true;
    setConversationActive(true);
    emitTranscript({ text: text.trim(), final: true });
    emitUtterance(text);
  }, [emitTranscript, emitUtterance]);

  const clearConversation = useCallback(() => {
    activeRef.current = false;
    setConversationActive(false);
    setTranscript("");
    sessionIdRef.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
  }, []);

  useEffect(() => {
    if (enabled) void start(); else stop();
    return () => {
      generationRef.current += 1;
      finalAbortRef.current?.abort();
      finalAbortRef.current = null;
      segmentIdRef.current += 1;
      cleanupRef.current();
    };
  }, [enabled, start, stop]);
  useEffect(() => { const onVisibility = () => document.hidden ? setPaused(true) : enabled && setPaused(false); document.addEventListener("visibilitychange", onVisibility); return () => document.removeEventListener("visibilitychange", onVisibility); }, [enabled, setPaused]);
  useEffect(() => () => { if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current); }, []);

  return { state, level, transcript, conversationActive, sessionId: sessionIdRef.current, start, stop, setPaused, submitText, clearConversation };
}
