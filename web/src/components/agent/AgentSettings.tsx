import { Check, Download, ExternalLink, RefreshCw, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsGroup, SettingsSegmented, SettingsSwitchRow, SettingsSelectRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { AgentShape } from "@/types";
import { AGENT_EMOTIONS, AgentFace } from "./AgentFace";

type EnvironmentTab = "node" | "ollama" | "whisper" | "chattts";
type WhisperModel = "base" | "small" | "medium";
type ServiceHealth = {
  ready?: boolean; node?: boolean; nodeVersion?: string; ollama?: boolean; ollamaModel?: boolean | null;
  whisper?: boolean; whisperBinary?: boolean; whisperModels?: Partial<Record<WhisperModel, boolean>>;
  chattts?: boolean; chatttsRuntime?: boolean; chatttsDevice?: string; model?: string; missing?: string[]; error?: string;
};
type JobStatus = { status?: string; phase?: string; message?: string; error?: string; received?: number; total?: number | null };

const WHISPER_MODELS: { id: WhisperModel; size: string }[] = [
  { id: "base", size: "142 MB" }, { id: "small", size: "466 MB" }, { id: "medium", size: "1.5 GB" },
];

export function AgentSettings() {
  const { t, lang, config, synced, setAgentEnabled, setAgentShape, setAgentColor, setAgentDefaultEmotion, setAgentRandomEmotions, setAgentVoiceEnabled, setAgentWakeWord, setAgentInternetEnabled, setAgentTranscriptEnabled, setAgentInputEnabled, setAgentDefaultCity, setAgentOllamaUrl, setAgentOllamaModel, setAgentWhisperModel, setAgentVoiceDevice } = useAppearance();
  const [activeEnvironment, setActiveEnvironment] = useState<EnvironmentTab>("node");
  const [service, setService] = useState<ServiceHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<JobStatus | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<Record<string, JobStatus>>({});
  const downloadAbortRef = useRef<Record<string, AbortController>>({});
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  const checkServices = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/agent/health", { cache: "no-store" });
      const payload = await response.json() as ServiceHealth;
      setService(response.ok ? payload : { ...payload, ready: false, error: payload?.error || `agent_http_${response.status}` });
    } catch (error) { setService({ ready: false, error: error instanceof Error ? error.message : String(error) }); }
    finally { setChecking(false); }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/models", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { models?: { name?: string; model?: string }[] };
      setModels((payload.models || []).map((item) => item.name || item.model || "").filter(Boolean));
    } catch { /* the panel keeps the last known status */ }
  }, []);

  const testOllama = useCallback(async () => {
    setTestingOllama(true);
    try {
      const response = await fetch("/api/agent/ollama/test", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || `ollama_http_${response.status}`);
      await Promise.all([checkServices(), refreshModels()]);
    } catch (error) { setService((current) => ({ ...(current || {}), ollama: false, error: error instanceof Error ? error.message : String(error) })); }
    finally { setTestingOllama(false); }
  }, [checkServices, refreshModels]);

  const restartAgent = useCallback(async () => {
    setRestarting(true);
    try {
      const response = await fetch("/api/agent/restart", { method: "POST" });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || `agent_restart_http_${response.status}`);
      await new Promise((resolve) => window.setTimeout(resolve, 500)); await checkServices();
    } catch (error) { setService((current) => ({ ...(current || {}), node: false, error: error instanceof Error ? error.message : String(error) })); }
    finally { setRestarting(false); }
  }, [checkServices]);

  useEffect(() => { void checkServices(); void refreshModels(); }, [checkServices, refreshModels]);

  const installRuntime = async () => {
    setInstalling(true);
    try {
      const response = await fetch("/api/agent/install", { method: "POST" });
      let current = await response.json() as JobStatus;
      if (!response.ok && current.status !== "running") throw new Error(current.error || t("agentVoiceNeedSetup"));
      setInstallStatus(current);
      for (let attempt = 0; attempt < 1800 && current.status === "running"; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        current = await (await fetch("/api/agent/install/status", { cache: "no-store" })).json() as JobStatus;
        setInstallStatus(current);
      }
      if (current.status === "failed" || current.status === "running") throw new Error(current.error || "runtime_install_failed");
      await checkServices();
    } catch (error) { setInstallStatus({ status: "failed", error: error instanceof Error ? error.message : String(error) }); }
    finally { setInstalling(false); }
  };

  const downloadService = async (serviceName: string) => {
    if (downloadAbortRef.current[serviceName]) return;
    const controller = new AbortController();
    downloadAbortRef.current[serviceName] = controller;
    setDownloadStatus((value) => ({ ...value, [serviceName]: { status: "running", phase: "starting" } }));
    let requestDone = false;
    let serviceRunning = true;
    const poll = (async () => {
      try {
        while (!controller.signal.aborted && (!requestDone || serviceRunning)) {
          const response = await fetch(`/api/agent/download-status/${serviceName}`, { cache: "no-store", signal: controller.signal }).catch(() => null);
          const status = response ? await response.json() as JobStatus : null;
          serviceRunning = status?.status === "running";
          if (status) setDownloadStatus((value) => ({ ...value, [serviceName]: status }));
          if (requestDone && !serviceRunning) break;
          await new Promise((resolve) => window.setTimeout(resolve, 700));
        }
      } catch { /* the POST response reports download failures */ }
    })();
    try {
      const response = await fetch(`/api/agent/download/${serviceName}`, { method: "POST", signal: controller.signal });
      const result = await response.json() as JobStatus & { ok?: boolean };
      if (!response.ok || result.ok === false) throw new Error(result.error || t("agentVoiceNeedSetup"));
      setDownloadStatus((value) => ({ ...value, [serviceName]: { ...result, status: "completed" } }));
      await checkServices();
    } catch (error) {
      if ((error as Error).name !== "AbortError") setDownloadStatus((value) => ({ ...value, [serviceName]: { status: "failed", error: error instanceof Error ? error.message : String(error) } }));
    } finally { requestDone = true; await poll; delete downloadAbortRef.current[serviceName]; }
  };

  const cancelDownload = (serviceName: string) => {
    downloadAbortRef.current[serviceName]?.abort(); delete downloadAbortRef.current[serviceName];
    setDownloadStatus((value) => ({ ...value, [serviceName]: { status: "cancelled" } }));
    void fetch(`/api/agent/download-cancel/${serviceName}`, { method: "POST" }).catch(() => {});
  };

  const testVoice = async () => {
    setTestingVoice(true);
    try {
      const response = await fetch("/api/agent/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: lang === "zh" ? "你好，我是 VivoFlow。" : "Hello from VivoFlow.", device: config.agent_voice_device }) });
      if (!response.ok) throw new Error(t("agentVoiceNeedSetup"));
      const url = URL.createObjectURL(await response.blob()); const audio = new Audio(url);
      const release = () => { audio.onended = null; URL.revokeObjectURL(url); }; audio.onended = release;
      try { await audio.play(); } catch (error) { release(); throw error; }
    } catch (error) { setService((current) => ({ ...(current || {}), error: error instanceof Error ? error.message : String(error) })); }
    finally { setTestingVoice(false); }
  };

  const modelOptions = Array.from(new Set([config.agent_ollama_model, ...models].filter(Boolean))).map((value) => ({ value, label: value }));
  const environmentReady: Record<EnvironmentTab, boolean> = { node: service?.node === true, ollama: service?.ollama === true, whisper: service?.whisper === true, chattts: service?.chattts === true };
  const progressLabel = (status?: JobStatus) => status?.total ? `${Math.floor(((status.received || 0) / status.total) * 100)}%` : t("agentVoiceDownloading");

  const panel = activeEnvironment === "node" ? <div className="agent-environment-panel" role="tabpanel" id="agent-panel-node">
    <EnvironmentSummary title={t("agentNodeRuntime")} detail={service?.nodeVersion || t("agentVoiceServiceUnavailable")} ready={environmentReady.node} readyText={t("agentInstalled")} missingText={t("agentNotInstalled")} />
    <p className="agent-environment-copy">{t("agentNodeHint")}</p>
    <div className="agent-environment-actions"><button type="button" className="agent-inline-button" disabled={checking} onClick={() => void checkServices()}><RefreshCw />{checking ? t("agentVoiceTesting") : t("agentVoiceCheck")}</button><button type="button" className="agent-inline-button" disabled={restarting} onClick={() => void restartAgent()}>{restarting ? t("agentVoiceTesting") : t("agentVoiceRestart")}</button><a className="agent-inline-button" href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">{t("agentInstallNode")}<ExternalLink /></a></div>
  </div> : activeEnvironment === "ollama" ? <div className="agent-environment-panel" role="tabpanel" id="agent-panel-ollama">
    <EnvironmentSummary title="Ollama" detail={service?.ollama ? `${models.length} ${t("agentModelsCount")}` : t("agentOllamaOffline")} ready={environmentReady.ollama} readyText={t("agentConnected")} missingText={t("agentNotConnected")} />
    <label className="agent-field"><span>{t("agentOllamaUrl")}</span><input value={config.agent_ollama_url} inputMode="url" disabled={!synced} onChange={(event) => setAgentOllamaUrl(event.target.value)} /></label>
    <SettingsSelectRow id="agent-ollama-model" title={t("agentOllamaModel")} value={config.agent_ollama_model} disabled={!synced || modelOptions.length === 0} options={modelOptions.length ? modelOptions : [{ value: config.agent_ollama_model, label: t("agentModelsEmpty") }]} onChange={setAgentOllamaModel} />
    <div className="agent-environment-actions"><button type="button" className="agent-inline-button" disabled={testingOllama} onClick={() => void testOllama()}>{testingOllama ? t("agentVoiceTesting") : t("agentOllamaTest")}</button><button type="button" className="agent-inline-button" onClick={() => void refreshModels()}><RefreshCw />{t("agentModelsRefresh")}</button><a className="agent-inline-button" href="https://ollama.com/download/windows" target="_blank" rel="noreferrer">{t("agentInstallOllama")}<ExternalLink /></a></div>
  </div> : activeEnvironment === "whisper" ? <div className="agent-environment-panel" role="tabpanel" id="agent-panel-whisper">
    <EnvironmentSummary title="whisper.cpp" detail={service?.whisperBinary ? t("agentRuntimeInstalled") : t("agentRuntimeDownloadsWithModel")} ready={environmentReady.whisper} readyText={t("agentRunning")} missingText={t("agentNotRunning")} />
    <div className="agent-model-list">{WHISPER_MODELS.map(({ id, size }) => {
      const installed = service?.whisperModels?.[id] === true; const selected = config.agent_whisper_model === id; const task = `whisper-${id}`; const status = downloadStatus[task]; const downloading = status?.status === "running";
      return <div className="agent-model-row" key={id}><div className="agent-model-name"><strong>{id}</strong><span>{lang === "zh" ? `约 ${size}` : `~${size}`}</span>{status?.status === "failed" ? <em>{status.error || t("agentVoiceDownloadFailed")}</em> : null}</div><div className="agent-model-meta">{selected ? <span className="agent-selected-label"><Check />{t("agentSelected")}</span> : null}<span className={cn("agent-state-chip", installed && "is-ready")}>{installed ? t("agentInstalled") : t("agentNotInstalled")}</span>{downloading ? <><span className="agent-download-progress">{progressLabel(status)}</span><button type="button" className="agent-icon-button" aria-label={t("agentStop")} onClick={() => cancelDownload(task)}><Square /></button></> : installed ? <button type="button" className="agent-inline-button is-quiet" disabled={selected || !synced} onClick={() => setAgentWhisperModel(id)}>{selected ? t("agentInUse") : t("agentUseModel")}</button> : <button type="button" className="agent-inline-button" onClick={() => void downloadService(task)}><Download />{t("agentDownload")}</button>}</div></div>;
    })}</div>
    <SettingsSelectRow id="agent-whisper-device" title={t("agentVoiceDevice")} value={config.agent_voice_device} disabled={!synced} options={[{value:"auto",label:"Auto"},{value:"cuda",label:"CUDA"},{value:"cpu",label:"CPU"}]} onChange={(value) => setAgentVoiceDevice(value as typeof config.agent_voice_device)} />
  </div> : <div className="agent-environment-panel" role="tabpanel" id="agent-panel-chattts">
    <EnvironmentSummary title="ChatTTS" detail={service?.chatttsDevice && service.chatttsDevice !== "unavailable" ? service.chatttsDevice : (service?.chatttsRuntime ? t("agentRuntimeInstalled") : t("agentPythonRuntimeMissing"))} ready={environmentReady.chattts} readyText={t("agentRunning")} missingText={t("agentNotRunning")} />
    <div className="agent-model-row"><div className="agent-model-name"><strong>{t("agentChatTtsModel")}</strong><span>Hugging Face</span></div><div className="agent-model-meta"><span className={cn("agent-state-chip", service?.chattts && "is-ready")}>{service?.chattts ? t("agentInstalled") : t("agentNotInstalled")}</span>{downloadStatus.chattts?.status === "running" ? <><span className="agent-download-progress">{progressLabel(downloadStatus.chattts)}</span><button type="button" className="agent-icon-button" aria-label={t("agentStop")} onClick={() => cancelDownload("chattts")}><Square /></button></> : <button type="button" className="agent-inline-button" disabled={!service?.chatttsRuntime || installing} onClick={() => void downloadService("chattts")}><Download />{t("agentDownloadModel")}</button>}</div></div>
    <SettingsSelectRow id="agent-chattts-device" title={t("agentVoiceDevice")} value={config.agent_voice_device} disabled={!synced} options={[{value:"auto",label:"Auto"},{value:"cuda",label:"CUDA"},{value:"cpu",label:"CPU"}]} onChange={(value) => setAgentVoiceDevice(value as typeof config.agent_voice_device)} />
    <div className="agent-environment-actions"><button type="button" className="agent-inline-button" disabled={installing} onClick={() => void installRuntime()}>{installing ? t("agentVoiceInstalling") : service?.chatttsRuntime ? t("agentReinstallRuntime") : t("agentInstallPythonRuntime")}</button><button type="button" className="agent-inline-button" disabled={testingVoice || !service?.chattts} onClick={() => void testVoice()}>{testingVoice ? t("agentVoiceTesting") : t("agentVoiceTest")}</button></div>
    {installStatus?.message || installStatus?.error ? <p className={cn("agent-job-message", installStatus.status === "failed" && "is-error")}>{installStatus.message || installStatus.error}</p> : null}
  </div>;

  return <div className="settings-module settings-agent">
    <section className="agent-settings-preview"><AgentFace shape={config.agent_shape} color={config.agent_color} emotion={config.agent_default_emotion} /></section>
    <SettingsGroup footer={t("agentExclusiveHint")}><SettingsSwitchRow id="agent-enabled" title={t("agentBoard")} checked={config.agent_enabled} disabled={!synced} onCheckedChange={setAgentEnabled}/><SettingsSwitchRow id="agent-random" title={t("agentRandom")} subtitle={t("agentRandomHint")} checked={config.agent_random_emotions} disabled={!synced} onCheckedChange={setAgentRandomEmotions}/><SettingsSwitchRow id="agent-voice" title={t("agentVoice")} subtitle={t("agentVoiceHint")} checked={config.agent_voice_enabled} disabled={!synced} onCheckedChange={setAgentVoiceEnabled}/><SettingsSwitchRow id="agent-input" title={t("agentInput")} subtitle={t("agentInputHint")} checked={config.agent_input_enabled} disabled={!synced} onCheckedChange={setAgentInputEnabled}/><SettingsSwitchRow id="agent-internet" title={t("agentInternet")} subtitle={t("agentInternetHint")} checked={config.agent_internet_enabled} disabled={!synced} onCheckedChange={setAgentInternetEnabled}/><SettingsSwitchRow id="agent-transcript" title={t("agentTranscript")} subtitle={t("agentTranscriptHint")} checked={config.agent_transcript_enabled} disabled={!synced} onCheckedChange={setAgentTranscriptEnabled}/></SettingsGroup>
    <SettingsGroup label={t("agentVoiceSetup")} footer={service?.error || t("agentEnvironmentHint")}><div className="agent-environment-tabs" role="tablist" aria-label={t("agentEnvironmentTabs")}>{(["node", "ollama", "whisper", "chattts"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeEnvironment === tab} aria-controls={`agent-panel-${tab}`} className={cn(activeEnvironment === tab && "is-active")} onClick={() => setActiveEnvironment(tab)}><span className={cn("agent-service-dot", environmentReady[tab] && "is-ready")} />{tab === "chattts" ? "ChatTTS" : tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>{panel}</SettingsGroup>
    <SettingsGroup label={t("agentWakeWord")} footer={t("agentWakeWordHint")}><label className="agent-field"><span>{t("agentWakeWord")}</span><input value={config.agent_wake_word} maxLength={32} disabled={!synced} onChange={(event) => setAgentWakeWord(event.target.value)} /></label><label className="agent-field"><span>{t("agentDefaultCity")}</span><input value={config.agent_default_city} maxLength={128} placeholder={lang === "zh" ? "例如：上海" : "e.g. Shanghai"} disabled={!synced} onChange={(event) => setAgentDefaultCity(event.target.value)} /></label></SettingsGroup>
    <SettingsGroup label={t("agentShape")}><div className="settings-row settings-row-flush"><SettingsSegmented<AgentShape> value={config.agent_shape} onChange={setAgentShape} disabled={!synced} options={[{id:"blob",label:t("agentShapeBlob")},{id:"wedge",label:t("agentShapeWedge")},{id:"gem",label:t("agentShapeGem")}]}/></div></SettingsGroup>
    <SettingsGroup label={t("agentColor")}><div className="agent-color-row"><input type="color" value={config.agent_color} disabled={!synced} aria-label={t("agentColor")} onChange={(e)=>setAgentColor(e.target.value)}/><code>{config.agent_color.toUpperCase()}</code></div></SettingsGroup>
    {(["life","emotion","agent"] as const).map((group) => <section className="settings-group" key={group}><h2 className="settings-group-label">{t(group === "life" ? "agentGroupLife" : group === "emotion" ? "agentGroupEmotion" : "agentGroupWork")}</h2><div className="agent-emotion-grid">{AGENT_EMOTIONS.filter((item)=>item.group===group).map((item)=>{ const active=config.agent_default_emotion===item.id; return <button key={item.id} type="button" className={cn("agent-emotion-card",active&&"is-active")} aria-pressed={active} disabled={!synced} onClick={()=>setAgentDefaultEmotion(item.id)}><AgentFace shape="blob" color={config.agent_color} emotion={item.id} animate={false}/><span>{lang === "zh" ? item.zh : item.en}</span>{active?<Check/>:null}</button>; })}</div></section>)}
  </div>;
}

function EnvironmentSummary({ title, detail, ready, readyText, missingText }: { title: string; detail: string; ready: boolean; readyText: string; missingText: string }) {
  return <div className="agent-environment-summary"><div><strong>{title}</strong><span>{detail}</span></div><span className={cn("agent-state-chip", ready && "is-ready")}>{ready ? readyText : missingText}</span></div>;
}
