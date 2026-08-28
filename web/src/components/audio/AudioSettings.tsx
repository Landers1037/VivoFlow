import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Check, ChevronDown, MonitorSpeaker, RefreshCw } from "lucide-react";
import { AudioRenderer } from "@/components/audio/AudioRenderer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettingsGroup, SettingsSliderRow, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { normalizeHexColor, useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import { isThreeAudioMode, type AudioDevice, type AudioFrame, type AudioStatus, type AudioVisualizerMode, type ThreeAudioVisualizerMode } from "@/types";

const TWO_D_MODES: { id: AudioVisualizerMode; key: "audioModeParticles" | "audioModeGrid" | "audioModeAurora" | "audioModeRadial" | "audioModeBars" }[] = [
  { id: "particles", key: "audioModeParticles" }, { id: "grid", key: "audioModeGrid" },
  { id: "aurora", key: "audioModeAurora" }, { id: "radial", key: "audioModeRadial" },
  { id: "bars", key: "audioModeBars" },
];
const THREE_D_MODES: { id: ThreeAudioVisualizerMode; key: "audioModeCity3d" | "audioModeNebula3d" | "audioModeTerrain3d" | "audioModeCrystal3d" }[] = [
  { id: "city3d", key: "audioModeCity3d" }, { id: "nebula3d", key: "audioModeNebula3d" },
  { id: "terrain3d", key: "audioModeTerrain3d" }, { id: "crystal3d", key: "audioModeCrystal3d" },
];
const INPUT = "min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AudioSettings({ frame, status, onSubscribe }: { frame: AudioFrame | null; status: AudioStatus | null; onSubscribe: (enabled: boolean) => void }) {
  const { config, synced, t, setAudioVisualizerEnabled, setAudioDeviceId, setAudioVisualizerMode, setAudioColorMode, setAudioColors, setAudioAmplitude, setAudioSmoothing } = useAppearance();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [primary, setPrimary] = useState(config.audio_color_primary);
  const [secondary, setSecondary] = useState(config.audio_color_secondary);
  const [threePreviewMode, setThreePreviewMode] = useState<ThreeAudioVisualizerMode>(isThreeAudioMode(config.audio_visualizer_mode) ? config.audio_visualizer_mode : "city3d");

  useEffect(() => { setPrimary(config.audio_color_primary); setSecondary(config.audio_color_secondary); }, [config.audio_color_primary, config.audio_color_secondary]);
  useEffect(() => { if (isThreeAudioMode(config.audio_visualizer_mode)) setThreePreviewMode(config.audio_visualizer_mode); }, [config.audio_visualizer_mode]);
  useEffect(() => { onSubscribe(true); return () => onSubscribe(false); }, [onSubscribe]);
  const loadDevices = useCallback(async () => {
    setLoading(true); setDeviceError(null);
    try {
      const response = await fetch("/api/audio/devices");
      if (!response.ok) throw new Error(`${response.status}`);
      const body = await response.json() as { devices?: AudioDevice[] };
      setDevices(body.devices ?? []);
    } catch { setDeviceError(t("audioDeviceLoadFailed")); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void loadDevices(); }, [loadDevices]);
  const commitColors = (nextPrimary = primary, nextSecondary = secondary) => setAudioColors(normalizeHexColor(nextPrimary), normalizeHexColor(nextSecondary));
  const statusText = status?.state === "fallback" ? t("audioFallback") : status?.state === "error" ? t("audioCaptureError") : status?.state === "capturing" ? t("audioListening") : t("audioDisabled");

  return <div className="settings-module space-y-1">
    <SettingsGroup footer={t("audioVisualizerHint")}>
      <SettingsSwitchRow
        id="audio-visualizer-enabled"
        title={t("audioVisualizer")}
        checked={config.audio_visualizer_enabled}
        disabled={!synced}
        onCheckedChange={setAudioVisualizerEnabled}
      />
    </SettingsGroup>

    <SettingsGroup label={t("audioOutputDevice")}>
      <div className="px-3 py-2">
        <div className="mb-2 flex items-center justify-end">
          <Button variant="ghost" size="icon" className="h-8 min-h-8 w-8 rounded-full px-0 text-muted-foreground hover:text-foreground" disabled={loading} aria-label={t("refreshAudioDevices")} onClick={() => void loadDevices()}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
        </div>
        <AudioDevicePicker devices={devices} value={config.audio_device_id} disabled={!synced || loading} onChange={setAudioDeviceId} />
        <p className={cn("mt-2 flex items-center gap-1.5 text-xs", status?.state === "error" ? "text-destructive" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", status?.state === "capturing" ? "bg-emerald-500" : status?.state === "fallback" ? "bg-amber-500" : "bg-muted-foreground")} />{deviceError ?? statusText}</p>
      </div>
    </SettingsGroup>

    <section className="settings-group">
      <h2 className="settings-group-label">{t("audioSpectrumMode")}</h2>
      <p className="settings-group-footer mb-2 !mt-0">{t("audioSpectrumModeHint")}</p>
      <p className="settings-group-label">{t("audioFlatModes")}</p>
      <div className="settings-mode-grid">
        {TWO_D_MODES.map((mode) => (
          <button key={mode.id} type="button" disabled={!synced} onClick={() => setAudioVisualizerMode(mode.id)} className={cn("overflow-hidden border text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring", config.audio_visualizer_mode === mode.id ? "border-primary bg-primary/8" : "border-border bg-card")} style={{ borderRadius: "0.9rem" }}>
            <div className="h-28 bg-background/55"><AudioRenderer preview frame={frame} mode={mode.id} primary={config.audio_color_primary} secondary={config.audio_color_secondary} gradient={config.audio_color_mode === "gradient"} amplitude={config.audio_amplitude} smoothing={config.audio_smoothing} className="h-full w-full" /></div>
            <div className="flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium"><span>{t(mode.key)}</span>{config.audio_visualizer_mode === mode.id ? <AudioLines className="h-4 w-4 text-primary" /> : null}</div>
          </button>
        ))}
      </div>
      <p className="settings-group-label mt-4">{t("audioSpatialModes")}</p>
      <p className="settings-group-footer mb-2 !mt-0">{t("audioSpatialModesHint")}</p>
      <div className="relative mb-2 h-48 overflow-hidden border border-border bg-background" style={{ borderRadius: "0.9rem" }}>
        <AudioRenderer preview frame={frame} mode={threePreviewMode} primary={config.audio_color_primary} secondary={config.audio_color_secondary} gradient={config.audio_color_mode === "gradient"} amplitude={config.audio_amplitude} smoothing={config.audio_smoothing} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/85 to-transparent px-4 pb-3 pt-10"><p className="text-sm font-semibold">{t(THREE_D_MODES.find((mode) => mode.id === threePreviewMode)?.key ?? "audioModeCity3d")}</p></div>
      </div>
      <div className="settings-mode-grid">
        {THREE_D_MODES.map((mode) => (
          <button key={mode.id} type="button" disabled={!synced} onPointerEnter={() => setThreePreviewMode(mode.id)} onFocus={() => setThreePreviewMode(mode.id)} onClick={() => { setThreePreviewMode(mode.id); setAudioVisualizerMode(mode.id); }} className={cn("settings-mode-option", config.audio_visualizer_mode === mode.id && "is-active")}>
            <span className="truncate">{t(mode.key)}</span>
            {config.audio_visualizer_mode === mode.id ? <Check className="h-4 w-4 shrink-0" /> : null}
          </button>
        ))}
      </div>
    </section>

    <SettingsGroup label={t("audioFrequencyColor")} footer={t("audioFrequencyColorHint")}>
      <div className="settings-row settings-row-flush">
        <div className="settings-segmented w-full" role="radiogroup">
          {(["single", "gradient"] as const).map((mode) => (
            <button type="button" key={mode} role="radio" aria-checked={config.audio_color_mode === mode} onClick={() => setAudioColorMode(mode)} className={cn("settings-segmented-item", config.audio_color_mode === mode && "is-active")}>{t(mode === "single" ? "audioSingleColor" : "audioGradientColor")}</button>
          ))}
        </div>
      </div>
      <div className="space-y-3 px-3 py-3">
        <ColorField id="audio-primary" label={t("audioPrimaryColor")} value={primary} onChange={(value) => { setPrimary(value); if (/^#[0-9a-fA-F]{6}$/.test(value)) setAudioColors(value, secondary); }} onBlur={() => commitColors()} />
        {config.audio_color_mode === "gradient" ? <ColorField id="audio-secondary" label={t("audioSecondaryColor")} value={secondary} onChange={(value) => { setSecondary(value); if (/^#[0-9a-fA-F]{6}$/.test(value)) setAudioColors(primary, value); }} onBlur={() => commitColors()} /> : null}
        <div className="h-2 rounded-full" style={{ background: config.audio_color_mode === "gradient" ? `linear-gradient(90deg, ${config.audio_color_primary}, ${config.audio_color_secondary})` : config.audio_color_primary }} />
      </div>
    </SettingsGroup>

    <SettingsGroup>
      <SettingsSliderRow id="audio-amplitude" title={t("audioAmplitude")} valueLabel={`${Math.round(config.audio_amplitude * 100)}%`} min={0.5} max={5} step={0.05} value={config.audio_amplitude} onChange={setAudioAmplitude} />
      <SettingsSliderRow id="audio-smoothing" title={t("audioSmoothing")} valueLabel={`${Math.round(config.audio_smoothing * 100)}%`} min={0} max={0.9} step={0.05} value={config.audio_smoothing} onChange={setAudioSmoothing} />
    </SettingsGroup>
  </div>;
}

function ColorField({ id, label, value, onChange, onBlur }: { id: string; label: string; value: string; onChange: (value: string) => void; onBlur: () => void }) {
  return <div className="space-y-1.5"><Label htmlFor={`${id}-text`}>{label}</Label><div className="flex gap-2"><input id={id} type="color" value={normalizeHexColor(value)} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background p-1" /><input id={`${id}-text`} value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={INPUT} /></div></div>;
}

function AudioDevicePicker({ devices, value, disabled, onChange }: { devices: AudioDevice[]; value: string | null; disabled: boolean; onChange: (value: string | null) => void }) {
  const { t } = useAppearance();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = [{ id: "", name: t("systemDefaultDevice"), is_default: false }, ...devices];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === (value ?? "")));
  const selected = options[selectedIndex];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.id || null);
    setHighlighted(index);
    setOpen(false);
  };

  return <div ref={rootRef} className="relative">
    <button
      id="audio-device"
      type="button"
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => { setHighlighted(selectedIndex); setOpen((current) => !current); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) { setOpen(true); setHighlighted(selectedIndex); return; }
          const delta = event.key === "ArrowDown" ? 1 : -1;
          setHighlighted((current) => (current + delta + options.length) % options.length);
        } else if (event.key === "Enter" && open) { event.preventDefault(); choose(highlighted); }
      }}
      className={cn(
        "vf-row flex min-h-14 w-full items-center gap-3 border px-3 py-2 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        open ? "border-primary/55 bg-primary/[0.055] shadow-[0_12px_32px_color-mix(in_oklch,var(--primary)_10%,transparent)]" : "border-border bg-card hover:border-primary/35 hover:bg-muted/35",
      )}
      style={{ borderRadius: "var(--radius)" }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary"><MonitorSpeaker className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{selected.name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{selected.id ? t("audioSpecificDevice") : t("audioDefaultDeviceHint")}</span></span>
      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180 text-primary")} />
    </button>

    {open ? <div role="listbox" aria-label={t("audioOutputDevice")} className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden border border-border/80 bg-card/95 p-1.5 shadow-[0_20px_55px_oklch(0_0_0/22%)] backdrop-blur-xl" style={{ borderRadius: "var(--radius)" }}>
      {options.map((option, index) => {
        const active = option.id === (value ?? "");
        return <button key={option.id || "system-default"} type="button" role="option" aria-selected={active} onPointerMove={() => setHighlighted(index)} onClick={() => choose(index)} className={cn("flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left outline-none transition-colors", highlighted === index ? "bg-primary/10" : "hover:bg-muted/60", active && "text-primary")} style={{ borderRadius: "calc(var(--radius) * .72)" }}>
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", active ? "border-primary/30 bg-primary/15" : "border-border bg-muted/45")}><MonitorSpeaker className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.name}</span>
          {option.is_default ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{t("defaultDevice")}</span> : null}
          <span className="flex h-5 w-5 items-center justify-center">{active ? <Check className="h-4 w-4" /> : null}</span>
        </button>;
      })}
    </div> : null}
  </div>;
}
