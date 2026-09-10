import { useCallback, useEffect, useRef, useState } from "react";

export type AgentVoiceState = "off" | "starting" | "ready" | "listening" | "permission" | "unsupported" | "insecure" | "error";

function voiceWsUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/agent-voice`;
}

export function useAgentVoice(enabled: boolean) {
  const [state, setState] = useState<AgentVoiceState>(enabled ? "starting" : "off");
  const [level, setLevel] = useState(0);
  const cleanupRef = useRef<() => void>(() => {});
  const generationRef = useRef(0);

  const stop = useCallback(() => {
    generationRef.current += 1;
    cleanupRef.current();
    cleanupRef.current = () => {};
    setLevel(0);
    setState(enabled ? "permission" : "off");
  }, [enabled]);

  const start = useCallback(async () => {
    cleanupRef.current();
    const generation = ++generationRef.current;
    if (!enabled) return setState("off");
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return setState("insecure");
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) return setState("unsupported");
    setState("starting");
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let socket: WebSocket | null = null;
    let workletUrl: string | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== generationRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const code = `class VFVoice extends AudioWorkletProcessor{constructor(){super();this.buf=[];this.acc=0}process(i){const a=i[0]?.[0];if(!a)return true;const step=sampleRate/16000;for(let p=0;p<a.length;p++){this.acc++;if(this.acc>=step){this.acc-=step;this.buf.push(Math.max(-1,Math.min(1,a[p])));if(this.buf.length===640){const o=new Int16Array(640);for(let j=0;j<640;j++)o[j]=this.buf[j]<0?this.buf[j]*32768:this.buf[j]*32767;this.port.postMessage(o.buffer,[o.buffer]);this.buf=[]}}}return true}}registerProcessor('vf-agent-voice',VFVoice);`;
      workletUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      await context.audioWorklet.addModule(workletUrl);
      if (generation !== generationRef.current) { stream.getTracks().forEach((track) => track.stop()); await context.close(); URL.revokeObjectURL(workletUrl); return; }
      const node = new AudioWorkletNode(context, "vf-agent-voice", { numberOfOutputs: 0 });
      source.connect(node);
      socket = new WebSocket(voiceWsUrl());
      socket.binaryType = "arraybuffer";
      socket.onopen = () => socket?.send(JSON.stringify({ type: "start", sample_rate: 16000, channels: 1, format: "pcm_s16le", frame_ms: 40 }));
      socket.onmessage = (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.type === "ready") setState("ready");
        if (msg.type === "voice_state") { setLevel(Number(msg.level) || 0); setState(msg.listening ? "listening" : "ready"); }
        if (msg.type === "error") setState("error");
      };
      socket.onerror = () => setState("error");
      node.port.onmessage = (event) => { if (socket?.readyState === WebSocket.OPEN) socket.send(event.data); };
      cleanupRef.current = () => { try { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:"stop"})); } catch {} socket?.close(); node.disconnect(); source.disconnect(); stream?.getTracks().forEach((track) => track.stop()); void context?.close(); if (workletUrl) URL.revokeObjectURL(workletUrl); };
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      if (workletUrl) URL.revokeObjectURL(workletUrl);
      setState(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "permission" : "error");
    }
  }, [enabled]);

  useEffect(() => { if (enabled) void start(); else stop(); return () => { generationRef.current += 1; cleanupRef.current(); }; }, [enabled, start, stop]);
  useEffect(() => { const onVisibility = () => document.hidden ? stop() : enabled && void start(); document.addEventListener("visibilitychange", onVisibility); return () => document.removeEventListener("visibilitychange", onVisibility); }, [enabled, start, stop]);
  return { state, level, start, stop };
}
