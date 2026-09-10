import { Check } from "lucide-react";
import { SettingsGroup, SettingsSegmented, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { AgentShape } from "@/types";
import { AGENT_EMOTIONS, AgentFace } from "./AgentFace";

export function AgentSettings() {
  const { t, lang, config, synced, setAgentEnabled, setAgentShape, setAgentColor, setAgentDefaultEmotion, setAgentRandomEmotions, setAgentVoiceEnabled } = useAppearance();
  return <div className="settings-module settings-agent">
    <section className="agent-settings-preview"><AgentFace shape={config.agent_shape} color={config.agent_color} emotion={config.agent_default_emotion} /></section>
    <SettingsGroup footer={t("agentExclusiveHint")}>
      <SettingsSwitchRow id="agent-enabled" title={t("agentBoard")} checked={config.agent_enabled} disabled={!synced} onCheckedChange={setAgentEnabled}/>
      <SettingsSwitchRow id="agent-random" title={t("agentRandom")} subtitle={t("agentRandomHint")} checked={config.agent_random_emotions} disabled={!synced} onCheckedChange={setAgentRandomEmotions}/>
      <SettingsSwitchRow id="agent-voice" title={t("agentVoice")} subtitle={t("agentVoiceHint")} checked={config.agent_voice_enabled} disabled={!synced} onCheckedChange={setAgentVoiceEnabled}/>
    </SettingsGroup>
    <SettingsGroup label={t("agentShape")}>
      <div className="settings-row settings-row-flush"><SettingsSegmented<AgentShape> value={config.agent_shape} onChange={setAgentShape} disabled={!synced} options={[{id:"blob",label:t("agentShapeBlob")},{id:"wedge",label:t("agentShapeWedge")},{id:"gem",label:t("agentShapeGem")}]}/></div>
    </SettingsGroup>
    <SettingsGroup label={t("agentColor")}>
      <div className="agent-color-row"><input type="color" value={config.agent_color} disabled={!synced} aria-label={t("agentColor")} onChange={(e)=>setAgentColor(e.target.value)}/><code>{config.agent_color.toUpperCase()}</code></div>
    </SettingsGroup>
    {(["life","emotion","agent"] as const).map((group) => <section className="settings-group" key={group}>
      <h2 className="settings-group-label">{t(group === "life" ? "agentGroupLife" : group === "emotion" ? "agentGroupEmotion" : "agentGroupWork")}</h2>
      <div className="agent-emotion-grid">{AGENT_EMOTIONS.filter((item)=>item.group===group).map((item)=>{
        const active=config.agent_default_emotion===item.id;
        return <button key={item.id} type="button" className={cn("agent-emotion-card",active&&"is-active")} aria-pressed={active} disabled={!synced} onClick={()=>setAgentDefaultEmotion(item.id)}>
          <AgentFace shape="blob" color={config.agent_color} emotion={item.id} animate={false}/><span>{lang === "zh" ? item.zh : item.en}</span>{active?<Check aria-hidden="true"/>:null}
        </button>;
      })}</div>
    </section>)}
  </div>;
}
