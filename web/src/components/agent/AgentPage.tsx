import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useAppearance } from "@/hooks/useAppearance";
import type { AgentEmotionId } from "@/types";
import { AgentFace } from "./AgentFace";
import { useAgentVoice } from "./useAgentVoice";
import { chooseNextEmotion, resolvedAgentEmotion } from "./agentState";

export function AgentPage() {
  const { config, t } = useAppearance();
  const voice = useAgentVoice(config.agent_voice_enabled);
  const listening = voice.state === "listening";
  const [randomEmotion, setRandomEmotion] = useState<AgentEmotionId>(config.agent_default_emotion);
  const resolvedEmotion = resolvedAgentEmotion(config.agent_default_emotion, randomEmotion, config.agent_random_emotions, listening);
  const emotion = resolvedEmotion === "listening" ? config.agent_default_emotion : resolvedEmotion;
  useEffect(() => { setRandomEmotion(config.agent_default_emotion); }, [config.agent_default_emotion, listening]);
  useEffect(() => {
    if (!config.agent_random_emotions || listening) return;
    let timer = 0;
    const schedule = () => { timer = window.setTimeout(() => { setRandomEmotion((current) => chooseNextEmotion(current)); schedule(); }, 8000 + Math.random()*7000); };
    schedule(); return () => window.clearTimeout(timer);
  }, [config.agent_random_emotions, listening]);
  const status = useMemo(() => {
    if (!config.agent_voice_enabled) return null;
    const key = voice.state === "listening" ? "agentVoiceListening" : voice.state === "ready" ? "agentVoiceReady" : voice.state === "starting" ? "agentVoiceStarting" : voice.state === "insecure" ? "agentVoiceInsecure" : voice.state === "unsupported" ? "agentVoiceUnsupported" : voice.state === "permission" ? "agentVoicePermission" : "agentVoiceError";
    return t(key);
  }, [config.agent_voice_enabled, t, voice.state]);
  const retry = ["permission","error"].includes(voice.state);
  return <main className="agent-page">
    <AgentFace shape={config.agent_shape} color={config.agent_color} emotion={emotion} listening={listening} />
    {status ? <button type="button" className="agent-voice-status" onClick={retry ? voice.start : undefined} disabled={!retry}>
      {listening ? <Mic className="h-4 w-4"/> : <MicOff className="h-4 w-4"/>}<span>{status}</span>
      {retry ? <strong>{t("agentVoiceRetry")}</strong> : null}
    </button> : null}
  </main>;
}
