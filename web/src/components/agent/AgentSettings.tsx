import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsGroup, SettingsSegmented, SettingsSwitchRow, SettingsSelectRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { AgentShape } from "@/types";
import { AGENT_EMOTIONS, AgentFace } from "./AgentFace";

export function AgentSettings() {
  const { t, lang, config, synced, setAgentEnabled, setAgentShape, setAgentColor, setAgentDefaultEmotion, setAgentRandomEmotions, setAgentVoiceEnabled, setAgentWakeWord, setAgentInternetEnabled, setAgentTranscriptEnabled, setAgentDefaultCity, setAgentOllamaUrl, setAgentOllamaModel, setAgentWhisperModel, setAgentVoiceDevice } = useAppearance();
  const [service, setService] = useState<{ ready?: boolean; node?: boolean; ollama?: boolean; ollamaModel?: boolean | null; whisper?: boolean; chattts?: boolean; chatttsDevice?: string; model?: string; missing?: string[]; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<{ status?: string; phase?: string; message?: string; error?: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const preparationAbortRef = useRef<AbortController | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const checkServices = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/agent/health", { cache: "no-store" });
      const payload = await response.json() as typeof service;
      setService(response.ok ? payload : { ...payload, ready: false, error: payload?.error || `agent_http_${response.status}` });
    } catch (error) {
      setService({ ready: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setChecking(false);
    }
  }, []);
  const refreshModels = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/models", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { models?: { name?: string; model?: string }[] };
      setModels((payload.models || []).map((item) => item.name || item.model || "").filter(Boolean));
    } catch { /* health status explains an unavailable bridge */ }
  }, []);
  const testOllama = useCallback(async () => {
    setTestingOllama(true);
    try {
      const response = await fetch("/api/agent/ollama/test", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.error || `ollama_http_${response.status}`);
      }
      setService((current) => ({ ...(current || {}), ollama: true, error: "" }));
      await Promise.all([checkServices(), refreshModels()]);
    } catch (error) {
      setService((current) => ({ ...(current || {}), ready: false, ollama: false, error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setTestingOllama(false);
    }
  }, [checkServices, refreshModels]);
  const restartAgent = useCallback(async () => {
    setRestarting(true);
    try {
      const response = await fetch("/api/agent/restart", { method: "POST" });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || `agent_restart_http_${response.status}`);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      await checkServices();
    } catch (error) {
      setService((current) => ({ ...(current || {}), ready: false, node: false, error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setRestarting(false);
    }
  }, [checkServices]);
  useEffect(() => { void checkServices(); void refreshModels(); }, [checkServices, refreshModels]);
  const installRuntime = async () => {
    setInstalling(true);
    try {
      const response = await fetch("/api/agent/install", { method: "POST" });
      const initial = await response.json() as { status?: string; phase?: string; message?: string; error?: string };
      if (!response.ok && initial.status !== "running") throw new Error(initial.error || t("agentVoiceNeedSetup"));
      let current = initial;
      setInstallStatus(current);
      for (let attempt = 0; attempt < 1800 && current.status === "running"; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const statusResponse = await fetch("/api/agent/install/status", { cache: "no-store" });
        current = await statusResponse.json() as typeof current;
        setInstallStatus(current);
      }
      if (current.status === "failed") throw new Error(current.error || t("agentVoiceNeedSetup"));
      if (current.status === "running") throw new Error("runtime_install_timeout");
      await checkServices();
    } catch (error) {
      setInstallStatus({ status: "failed", error: error instanceof Error ? error.message : String(error) });
    } finally {
      setInstalling(false);
    }
  };
  const prepareModels = async () => {
    setPreparing(true);
    const controller = new AbortController();
    preparationAbortRef.current = controller;
    setInstallStatus({ status: "running", phase: "models", message: t("agentVoiceTesting") });
    try {
      const downloadOne = async (serviceName: "whisper" | "chattts") => {
        let requestDone = false;
        let serviceRunning = true;
        const poll = (async () => {
          try {
            while (!controller.signal.aborted && (!requestDone || serviceRunning)) {
              const statusResponse = await fetch(`/api/agent/download-status/${serviceName}`, { cache: "no-store", signal: controller.signal }).catch(() => null);
              const status = statusResponse ? await statusResponse.json() as { status?: string; phase?: string; received?: number; total?: number | null } : null;
              serviceRunning = status?.status === "running";
              if (status?.status === "running") {
                const progress = status.total ? ` · ${Math.floor(((status.received || 0) / status.total) * 100)}%` : "";
                setInstallStatus({ status: "running", phase: status.phase, message: `${t("agentVoiceTesting")}${progress}` });
              }
              if (requestDone && !serviceRunning) break;
              await new Promise((resolve) => window.setTimeout(resolve, 700));
            }
          } catch { /* the preparation request reports the actionable error */ }
        })();
        let response: Response;
        try {
          response = await fetch(`/api/agent/download/${serviceName}`, { method: "POST", signal: controller.signal });
        } finally {
          requestDone = true;
        }
        await poll;
        return response;
      };
      const whisper = await downloadOne("whisper");
      if (!whisper.ok) throw new Error(t("agentVoiceNeedSetup"));
      const chattts = await downloadOne("chattts");
      if (!chattts.ok) throw new Error(t("agentVoiceNeedSetup"));
      setInstallStatus({ status: "completed", phase: "ready", message: t("agentVoiceServiceReady") });
      await Promise.all([checkServices(), refreshModels()]);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const message = error instanceof Error ? error.message : String(error);
        setInstallStatus({ status: "failed", phase: "error", error: message });
        setService((current) => ({ ...(current || {}), ready: false, error: message }));
      }
    } finally {
      if (preparationAbortRef.current === controller) preparationAbortRef.current = null;
      setPreparing(false);
    }
  };
  const cancelPreparation = () => {
    preparationAbortRef.current?.abort();
    setInstallStatus({ status: "cancelled", phase: "idle", message: t("agentStop") });
    void Promise.all(["whisper", "chattts"].map((serviceName) => fetch(`/api/agent/download-cancel/${serviceName}`, { method: "POST" }).catch(() => {})));
  };
  const testVoice = async () => {
    setTestingVoice(true);
    try {
      const response = await fetch("/api/agent/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: lang === "zh" ? "你好，我是 VivoFlow。" : "Hello from VivoFlow.", device: config.agent_voice_device }) });
      if (!response.ok) throw new Error(t("agentVoiceNeedSetup"));
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      const release = () => { audio.onended = null; URL.revokeObjectURL(url); };
      audio.onended = release;
      try { await audio.play(); } catch (error) { release(); throw error; }
    } catch (error) {
      setService((current) => ({ ...(current || {}), ready: false, error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setTestingVoice(false);
    }
  };
  const modelOptions = Array.from(new Set([config.agent_ollama_model, ...models].filter(Boolean))).map((value) => ({ value, label: value }));
  return <div className="settings-module settings-agent">
    <section className="agent-settings-preview"><AgentFace shape={config.agent_shape} color={config.agent_color} emotion={config.agent_default_emotion} /></section>
    <SettingsGroup footer={t("agentExclusiveHint")}>
      <SettingsSwitchRow id="agent-enabled" title={t("agentBoard")} checked={config.agent_enabled} disabled={!synced} onCheckedChange={setAgentEnabled}/>
      <SettingsSwitchRow id="agent-random" title={t("agentRandom")} subtitle={t("agentRandomHint")} checked={config.agent_random_emotions} disabled={!synced} onCheckedChange={setAgentRandomEmotions}/>
      <SettingsSwitchRow id="agent-voice" title={t("agentVoice")} subtitle={t("agentVoiceHint")} checked={config.agent_voice_enabled} disabled={!synced} onCheckedChange={setAgentVoiceEnabled}/>
      <SettingsSwitchRow id="agent-internet" title={t("agentInternet")} subtitle={t("agentInternetHint")} checked={config.agent_internet_enabled} disabled={!synced} onCheckedChange={setAgentInternetEnabled}/>
      <SettingsSwitchRow id="agent-transcript" title={t("agentTranscript")} subtitle={t("agentTranscriptHint")} checked={config.agent_transcript_enabled} disabled={!synced} onCheckedChange={setAgentTranscriptEnabled}/>
    </SettingsGroup>
    <SettingsGroup label={t("agentVoiceSetup")} footer={t("agentVoiceSetupHint")}>
      <div className="agent-service-row">
        <span className={`agent-service-dot ${service?.ready ? "is-ready" : ""}`} />
        <span>{service?.ready ? t("agentVoiceServiceReady") : t("agentVoiceServiceUnavailable")}</span>
        {service ? <span className="agent-service-badges"><span className={service.node ? "is-ready" : ""}>Node</span><span className={service.ollama ? "is-ready" : ""}>Ollama</span><span className={service.whisper ? "is-ready" : ""}>Whisper</span><span className={service.chattts ? "is-ready" : ""}>ChatTTS</span></span> : null}
        {service?.model ? <code>{service.model}</code> : null}
        {service?.chatttsDevice ? <code>{service.chatttsDevice}</code> : null}
        <button type="button" className="agent-inline-button" disabled={checking} onClick={() => void checkServices()}>{checking ? t("agentVoiceTesting") : t("agentVoiceCheck")}</button>
        <button type="button" className="agent-inline-button" disabled={restarting} onClick={() => void restartAgent()}>{restarting ? t("agentVoiceTesting") : t("agentVoiceRestart")}</button>
        <button type="button" className="agent-inline-button" disabled={installing || preparing} onClick={() => void installRuntime()}>{installing ? t("agentVoiceInstalling") : t("agentVoiceInstall")}</button>
        <button type="button" className="agent-inline-button" disabled={preparing || installing} onClick={() => void prepareModels()}>{preparing ? t("agentVoiceTesting") : t("agentVoiceDownload")}</button>
        {preparing ? <button type="button" className="agent-inline-button" onClick={cancelPreparation}>{t("agentStop")}</button> : null}
        <button type="button" className="agent-inline-button" disabled={testingVoice} onClick={() => void testVoice()}>{testingVoice ? t("agentVoiceTesting") : t("agentVoiceTest")}</button>
      </div>
      <p className="settings-group-footer">{installStatus?.message || service?.error || (service?.missing?.length ? `${t("agentVoiceMissing")}：${service.missing.join(", ")}` : t("agentVoiceInstallHint"))}</p>
    </SettingsGroup>
    <SettingsGroup label={t("agentWakeWord")} footer={t("agentWakeWordHint")}>
      <label className="agent-field"><span>{t("agentWakeWord")}</span><input value={config.agent_wake_word} maxLength={32} disabled={!synced} onChange={(event) => setAgentWakeWord(event.target.value)} /></label>
      <label className="agent-field"><span>{t("agentDefaultCity")}</span><input value={config.agent_default_city} maxLength={128} placeholder={lang === "zh" ? "例如：上海" : "e.g. Shanghai"} disabled={!synced} onChange={(event) => setAgentDefaultCity(event.target.value)} /></label>
    </SettingsGroup>
    <SettingsGroup label={t("agentOllamaUrl")}>
      <label className="agent-field"><span>{t("agentOllamaUrl")}</span><input value={config.agent_ollama_url} inputMode="url" disabled={!synced} onChange={(event) => setAgentOllamaUrl(event.target.value)} /></label>
      <div className="agent-model-picker"><SettingsSelectRow id="agent-ollama-model" title={t("agentOllamaModel")} value={config.agent_ollama_model} disabled={!synced || modelOptions.length === 0} options={modelOptions.length ? modelOptions : [{ value: config.agent_ollama_model, label: t("agentModelsEmpty") }]} onChange={setAgentOllamaModel} /><button type="button" className="agent-inline-button" disabled={testingOllama} onClick={() => void testOllama()}>{testingOllama ? t("agentVoiceTesting") : t("agentOllamaTest")}</button><button type="button" className="agent-inline-button" disabled={checking} onClick={() => void refreshModels()}>{t("agentModelsRefresh")}</button></div>
      <SettingsSelectRow id="agent-whisper-model" title={t("agentWhisperModel")} value={config.agent_whisper_model} disabled={!synced} options={[{value:"base",label:"base"},{value:"small",label:"small"},{value:"medium",label:"medium"}]} onChange={(value) => setAgentWhisperModel(value as typeof config.agent_whisper_model)} />
      <SettingsSelectRow id="agent-voice-device" title={t("agentVoiceDevice")} value={config.agent_voice_device} disabled={!synced} options={[{value:"auto",label:"Auto"},{value:"cuda",label:"CUDA"},{value:"cpu",label:"CPU"}]} onChange={(value) => setAgentVoiceDevice(value as typeof config.agent_voice_device)} />
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
