import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Atom, Check, ImagePlus, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import { AudioDevicePicker, useAudioDevices } from "@/components/audio/AudioDevicePicker";
import ParticleCanvas from "./ParticleCanvas";
import { SettingsGroup, SettingsSegmented, SettingsSliderRow, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { Button } from "@/components/ui/button";
import { useAppearance } from "@/hooks/useAppearance";
import { particleApi } from "@/lib/particles";
import { cn } from "@/lib/utils";
import type { AudioFrame, AudioStatus, Particle3dMode, ParticleDimension, ParticleImage, ParticleLibraryResponse } from "@/types";

const EMPTY_LIBRARY: ParticleLibraryResponse = { active_image_id: null, images: [] };

export function ParticleSettings({ frame, status, onSubscribe }: { frame: AudioFrame | null; status: AudioStatus | null; onSubscribe: (enabled: boolean) => void }) {
  const {
    config, synced, t, setParticleEnabled, setParticleDimension, setParticle3dMode,
    setParticleAudioReactive, setParticleDensity, setParticleSize, setParticleDepth,
    setParticleMotion, setParticleAudioStrength, setAudioDeviceId,
  } = useAppearance();
  const [library, setLibrary] = useState<ParticleLibraryResponse>(EMPTY_LIBRARY);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState("");
  const { devices, loading: devicesLoading, error: deviceError, refresh } = useAudioDevices();
  useEffect(() => {
    let alive = true;
    particleApi.list().then((data) => { if (alive) setLibrary(data); }).catch((reason: Error) => { if (alive) setError(reason.message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!config.particle_audio_reactive) return;
    onSubscribe(true);
    return () => onSubscribe(false);
  }, [config.particle_audio_reactive, onSubscribe]);
  const active = useMemo(() => library.images.find((image) => image.id === library.active_image_id) ?? library.images[0] ?? null, [library]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true); setError("");
    try { setLibrary(await particleApi.upload(files)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const activate = async (image: ParticleImage) => {
    if (image.id === library.active_image_id || busy) return;
    setBusy(true); setError("");
    try { setLibrary(await particleApi.setActive(image.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const remove = async (image: ParticleImage) => {
    if (!window.confirm(t("particleDeleteConfirm", { name: image.original_name }))) return;
    setBusy(true); setError("");
    try { setLibrary(await particleApi.remove(image.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const statusText = status?.state === "fallback" ? t("audioFallback") : status?.state === "error" ? t("audioCaptureError") : status?.state === "capturing" ? t("audioListening") : t("particleAudioWaiting");

  return <div className="settings-module space-y-1">
    <SettingsGroup footer={t("particleHint")}>
      <SettingsSwitchRow id="particle-enabled" icon={Atom} title={t("particleBoard")} checked={config.particle_enabled} disabled={!synced} onCheckedChange={setParticleEnabled} />
    </SettingsGroup>

    <SettingsGroup label={t("particleImages")} footer={t("particlePrivacy")}>
      <label className="settings-row cursor-pointer">
        <span className="settings-row-icon"><Upload className="h-4 w-4" /></span>
        <span className="settings-row-copy"><span className="settings-row-title">{t("particleUpload")}</span><span className="settings-row-subtitle">{t("particleUploadHint")}</span></span>
        <input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" disabled={busy} onChange={upload} />
      </label>
      {library.images.map((image) => {
        const selected = image.id === (active?.id ?? "");
        return <div key={image.id} className={cn("settings-list-card", selected && "border-primary/55 bg-primary/[0.055]")}>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={busy} onClick={() => void activate(image)}>
            <span className="settings-cover h-14 w-14 overflow-hidden bg-muted"><img src={image.content_url} alt="" className="h-full w-full object-cover" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{image.original_name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatBytes(image.size_bytes)}</span></span>
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
          </button>
          <div className="settings-list-card-actions"><button type="button" className="settings-list-card-control text-destructive" disabled={busy} onClick={() => void remove(image)} aria-label={t("particleDelete")}><Trash2 className="h-4 w-4" /></button></div>
        </div>;
      })}
      {!library.images.length ? <div className="settings-empty-state"><ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">{t("particleEmpty")}</p></div> : null}
    </SettingsGroup>

    {active ? <SettingsGroup label={t("particlePreview")}>
      <div className="particle-preview relative h-64 overflow-hidden border border-border/70 bg-background">
        <ParticleCanvas image={active} frame={frame} dimension={config.particle_dimension} mode3d={config.particle_3d_mode} density={config.particle_density} size={config.particle_size} depth={config.particle_depth} motion={config.particle_motion} audioReactive={config.particle_audio_reactive} audioStrength={config.particle_audio_strength} preview className="h-full w-full" onLoadingChange={setPreviewBusy} onError={(message) => setError(message ?? "")} />
        {previewBusy ? <div className="absolute inset-0 grid place-items-center bg-background/35"><LoaderCircle className="h-6 w-6 animate-spin" /></div> : null}
      </div>
    </SettingsGroup> : null}

    <SettingsGroup label={t("particleDimension")}>
      <div className="settings-row settings-row-flush"><SettingsSegmented className="w-full" options={[{ id: "2d", label: "2D" }, { id: "3d", label: "3D" }]} value={config.particle_dimension} disabled={!synced} onChange={(value) => setParticleDimension(value as ParticleDimension)} /></div>
      {config.particle_dimension === "3d" ? <div className="settings-row settings-row-flush"><SettingsSegmented className="w-full" options={[{ id: "relief", label: t("particleRelief") }, { id: "plane", label: t("particlePlane") }, { id: "cloud", label: t("particleCloud") }]} value={config.particle_3d_mode} disabled={!synced} onChange={(value) => setParticle3dMode(value as Particle3dMode)} /></div> : null}
    </SettingsGroup>

    <SettingsGroup label={t("particleTuning")}>
      <SettingsSliderRow id="particle-density" title={t("particleDensity")} valueLabel={`${Math.round(config.particle_density * 100)}%`} min={0.2} max={1} step={0.05} value={config.particle_density} onChange={setParticleDensity} />
      <SettingsSliderRow id="particle-size" title={t("particleSize")} valueLabel={config.particle_size.toFixed(1)} min={0.5} max={3} step={0.1} value={config.particle_size} onChange={setParticleSize} />
      {config.particle_dimension === "3d" ? <SettingsSliderRow id="particle-depth" title={t("particleDepth")} valueLabel={config.particle_depth.toFixed(1)} min={0} max={2} step={0.1} value={config.particle_depth} onChange={setParticleDepth} /> : null}
      <SettingsSliderRow id="particle-motion" title={t("particleMotion")} valueLabel={config.particle_motion.toFixed(1)} min={0} max={2} step={0.1} value={config.particle_motion} onChange={setParticleMotion} />
    </SettingsGroup>

    <SettingsGroup label={t("particleAudio")} footer={t("particleAudioHint")}>
      <SettingsSwitchRow id="particle-audio-reactive" title={t("particleAudioReactive")} checked={config.particle_audio_reactive} disabled={!synced} onCheckedChange={setParticleAudioReactive} />
      {config.particle_audio_reactive ? <>
        <div className="px-3 py-3">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{t("audioOutputDevice")}</span><Button variant="ghost" size="icon" className="h-8 min-h-8 w-8 rounded-full px-0" disabled={devicesLoading} onClick={() => void refresh()}><RefreshCw className={cn("h-3.5 w-3.5", devicesLoading && "animate-spin")} /></Button></div>
          <AudioDevicePicker devices={devices} value={config.audio_device_id} disabled={!synced || devicesLoading} onChange={setAudioDeviceId} />
          <p className={cn("mt-2 text-xs", status?.state === "error" ? "text-destructive" : "text-muted-foreground")}>{deviceError ?? statusText}</p>
        </div>
        <SettingsSliderRow id="particle-audio-strength" title={t("particleAudioStrength")} valueLabel={`${Math.round(config.particle_audio_strength * 100)}%`} min={0} max={3} step={0.1} value={config.particle_audio_strength} onChange={setParticleAudioStrength} />
      </> : null}
    </SettingsGroup>
    {error ? <p className="settings-status-error">{error}</p> : null}
  </div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
