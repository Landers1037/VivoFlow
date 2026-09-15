import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Square, Trash2 } from "lucide-react";
import { useAppearance } from "@/hooks/useAppearance";
import type { AgentEmotionId } from "@/types";
import { AgentFace } from "./AgentFace";
import { useAgentVoice, type AgentVoiceState } from "./useAgentVoice";
import { chooseNextEmotion, resolvedAgentEmotion } from "./agentState";

type StreamEvent = { type?: string; delta?: string; tool?: string; error?: boolean | string; errorText?: string };

function splitReply(text: string) {
  const parts: string[] = [];
  let current = "";
  for (const char of text) {
    current += char;
    if (/[。！？!?；;\n]/.test(char)) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [text.trim()];
}

export function AgentPage() {
  const { config, t } = useAppearance();
  const [randomEmotion, setRandomEmotion] = useState<AgentEmotionId>(config.agent_default_emotion);
  const [reply, setReply] = useState("");
  const [toolStatus, setToolStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [draft, setDraft] = useState("");
  const previousInternetRef = useRef(config.agent_internet_enabled);
  const voiceRef = useRef<ReturnType<typeof useAgentVoice> | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.src = ""; }
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioBlocked(false);
  }, []);

  const speak = useCallback(async (text: string, signal: AbortSignal) => {
    if (!text.trim()) return;
    setAudioBlocked(false);
    for (const sentence of splitReply(text)) {
      const response = await fetch("/api/agent/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: sentence, device: config.agent_voice_device }),
        signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || `tts_http_${response.status}`);
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audioUrlRef.current = url;
      audioRef.current = audio;
      setSpeaking(true);
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          signal.removeEventListener("abort", onAbort);
          audio.onended = null;
          audio.onerror = null;
          if (audioRef.current === audio) audioRef.current = null;
          if (audioUrlRef.current === url) { URL.revokeObjectURL(url); audioUrlRef.current = null; }
        };
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (error) reject(error); else resolve();
        };
        const onAbort = () => {
          audio.pause();
          finish(Object.assign(new Error("aborted"), { name: "AbortError" }));
        };
        audio.onended = () => finish();
        audio.onerror = () => finish(new Error(t("agentVoiceError")));
        signal.addEventListener("abort", onAbort, { once: true });
        void audio.play().catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "NotAllowedError") {
            setAudioBlocked(true);
            // Keep this element available for the user gesture that enables audio.
            signal.removeEventListener("abort", onAbort);
            audio.onended = () => { cleanup(); setSpeaking(false); setBusy(false); resolve(); };
            audio.onerror = () => finish(new Error(t("agentVoiceError")));
            reject(Object.assign(new Error("audio_autoplay_blocked"), { name: "NotAllowedError" }));
            return;
          }
          finish(error instanceof Error ? error : new Error(String(error)));
        });
      });
    }
    setSpeaking(false);
  }, [config.agent_voice_device, releaseAudio, t]);

  const enableSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play().then(() => { setAudioBlocked(false); setSpeaking(true); }).catch(() => {});
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;
    releaseAudio();
    setBusy(true); setSpeaking(false); setAudioBlocked(false); setReply(""); setToolStatus(""); setError("");
    voiceRef.current?.setPaused(true);
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: voiceRef.current?.sessionId, message, internetEnabled: config.agent_internet_enabled }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || `agent_http_${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("agent_stream_unavailable");
      const decoder = new TextDecoder();
      let pending = "";
      let fullReply = "";
      const consume = (line: string) => {
        if (!line.trim()) return;
        let event: StreamEvent;
        try { event = JSON.parse(line) as StreamEvent; } catch { return; }
        if (event.type === "delta") { fullReply += event.delta || ""; setReply(fullReply); }
        else if (event.type === "tool_start") setToolStatus(`${t("agentTool")} · ${event.tool || ""}`);
        else if (event.type === "tool_end") {
          setToolStatus(event.error ? `${t("agentTool")} · ${event.errorText || event.tool || ""}` : "");
        }
        else if (event.type === "error") throw new Error(typeof event.error === "string" ? event.error : t("agentErrorPrefix"));
      };
      while (true) {
        const result = await reader.read();
        pending += decoder.decode(result.value || new Uint8Array(), { stream: !result.done });
        const lines = pending.split("\n"); pending = lines.pop() || "";
        lines.forEach(consume);
        if (result.done) break;
      }
      if (pending) consume(pending);
      setToolStatus("");
      if (fullReply.trim()) await speak(fullReply, controller.signal);
      setSpeaking(false); setBusy(false); voiceRef.current?.setPaused(false);
    } catch (caught) {
      if ((caught as Error).name === "AbortError") return;
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message.includes("model_tool_calls_unsupported") ? t("agentModelToolsUnsupported") : message.includes("ollama_model_unavailable") ? t("agentModelUnavailable") : message);
      setBusy(false); setSpeaking(false); voiceRef.current?.setPaused(false);
    } finally {
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
    }
  }, [busy, config.agent_internet_enabled, releaseAudio, speak, t]);

  const voice = useAgentVoice({
    enabled: config.agent_voice_enabled,
    wakeWord: config.agent_wake_word,
    transcriptEnabled: config.agent_transcript_enabled,
    onUtterance: sendMessage,
  });
  voiceRef.current = voice;

  const stop = useCallback(() => {
    chatAbortRef.current?.abort();
    void fetch("/api/agent/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: voice.sessionId }) }).catch(() => {});
    releaseAudio();
    setBusy(false); setSpeaking(false); setToolStatus("");
    if (voice.state === "error") voice.stop(); else voice.setPaused(false);
  }, [releaseAudio, voice]);

  const clear = useCallback(() => {
    const sessionId = voice.sessionId;
    stop();
    void fetch("/api/agent/clear", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) }).catch(() => {});
    setReply(""); setError(""); setDraft(""); voice.clearConversation();
  }, [stop, voice]);

  useEffect(() => {
    if (previousInternetRef.current && !config.agent_internet_enabled && busy) stop();
    previousInternetRef.current = config.agent_internet_enabled;
  }, [busy, config.agent_internet_enabled, stop]);

  useEffect(() => { setRandomEmotion(config.agent_default_emotion); }, [config.agent_default_emotion, voice.conversationActive]);
  useEffect(() => {
    if (!config.agent_random_emotions || voice.conversationActive || busy) return;
    let timer = 0;
    const schedule = () => { timer = window.setTimeout(() => { setRandomEmotion((current) => chooseNextEmotion(current)); schedule(); }, 8000 + Math.random() * 7000); };
    schedule(); return () => window.clearTimeout(timer);
  }, [busy, config.agent_random_emotions, voice.conversationActive]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        chatAbortRef.current?.abort();
        void fetch("/api/agent/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: voice.sessionId }) }).catch(() => {});
        releaseAudio();
        setBusy(false); setSpeaking(false); setToolStatus("");
        voice.setPaused(true);
      } else if (!busy) {
        if (voice.state === "error") void voice.start(); else voice.setPaused(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [busy, releaseAudio, voice]);
  useEffect(() => { if (busy && voice.state === "error") stop(); }, [busy, stop, voice.state]);
  useEffect(() => () => { chatAbortRef.current?.abort(); releaseAudio(); }, [releaseAudio]);

  const resolvedEmotion = resolvedAgentEmotion(config.agent_default_emotion, randomEmotion, config.agent_random_emotions, voice.state === "listening");
  const emotion = error || voice.state === "error" ? "34" : speaking ? "39" : toolStatus ? "40" : voice.state === "thinking" || busy ? "30" : resolvedEmotion === "listening" ? config.agent_default_emotion : resolvedEmotion;
  const status = statusText(t, voice.state, voice.conversationActive, speaking);
  const retry = ["permission", "error"].includes(voice.state);

  return <main className="agent-page">
    <AgentFace shape={config.agent_shape} color={config.agent_color} emotion={emotion} listening={voice.state === "listening"} />
    <button type="button" className="agent-voice-status" onClick={retry ? voice.start : undefined} disabled={!retry}>
      {voice.state === "listening" ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      <span>{status}</span>{retry ? <strong>{t("agentVoiceRetry")}</strong> : null}
    </button>
    {config.agent_input_enabled ? <section className="agent-conversation" aria-live="polite">
      {config.agent_transcript_enabled ? <div className={`agent-transcript ${voice.transcript && voice.state !== "listening" ? "is-final" : ""}`}>{voice.transcript || t("agentPlaceholder")}</div> : null}
      {toolStatus ? <div className="agent-tool-status">{toolStatus}</div> : null}
      <div className="agent-reply">{reply || <span className="opacity-50">{t("agentNoReply")}</span>}</div>
      {audioBlocked ? <button type="button" className="agent-inline-button" onClick={enableSound}>{t("agentEnableSound")}</button> : null}
      <div className="agent-conversation-controls">
        <input value={draft} placeholder={t("agentPlaceholder")} disabled={busy} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); voice.submitText(draft); setDraft(""); } }} />
        <button type="button" title={t("agentSend")} aria-label={t("agentSend")} disabled={!draft.trim() || busy} onClick={() => { voice.submitText(draft); setDraft(""); }}><Send className="h-4 w-4" /></button>
        {busy ? <button type="button" title={t("agentStop")} aria-label={t("agentStop")} onClick={stop}><Square className="h-4 w-4" /></button> : <button type="button" title={t("agentStart")} aria-label={t("agentStart")} onClick={() => void voice.start()}><Mic className="h-4 w-4" /></button>}
        <button type="button" title={t("agentClear")} aria-label={t("agentClear")} onClick={clear}><Trash2 className="h-4 w-4" /></button>
      </div>
      {error ? <div className="agent-tool-status">{t("agentErrorPrefix")}：{error}</div> : null}
    </section> : null}
  </main>;
}

function statusText(t: (key: import("@/i18n/messages").MessageKey) => string, state: AgentVoiceState, active: boolean, speaking: boolean) {
  if (speaking || state === "speaking") return t("agentSpeaking");
  if (state === "transcribing") return t("agentTranscribing");
  if (state === "ready" && !active) return t("agentWake");
  if (state === "thinking") return t("agentThinking");
  if (state === "listening") return t("agentVoiceListening");
  if (state === "starting") return t("agentVoiceStarting");
  if (state === "permission") return t("agentVoicePermission");
  if (state === "unsupported") return t("agentVoiceUnsupported");
  if (state === "insecure") return t("agentVoiceInsecure");
  if (state === "error") return t("agentVoiceError");
  return t("agentVoiceReady");
}
