import { AGENT_EMOTION_IDS, type AgentEmotionId } from "@/types";

export function resolvedAgentEmotion(defaultEmotion: AgentEmotionId, randomEmotion: AgentEmotionId, randomEnabled: boolean, listening: boolean): AgentEmotionId | "listening" {
  if (listening) return "listening";
  return randomEnabled ? randomEmotion : defaultEmotion;
}

export function chooseNextEmotion(current: AgentEmotionId, random = Math.random): AgentEmotionId {
  const choices = AGENT_EMOTION_IDS.filter((id) => id !== current);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}
