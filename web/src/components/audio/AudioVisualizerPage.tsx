import { useEffect } from "react";
import { AudioLines, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioRenderer } from "@/components/audio/AudioRenderer";
import { useAppearance } from "@/hooks/useAppearance";
import { useAudioSignal } from "@/hooks/useAudioSignal";
import type { AudioFrame, AudioStatus } from "@/types";

export function AudioVisualizerPage({ frame, status, onSubscribe, onOpenSettings }: { frame: AudioFrame | null; status: AudioStatus | null; onSubscribe: (enabled: boolean) => void; onOpenSettings: () => void }) {
  const { config, t } = useAppearance();
  useEffect(() => { onSubscribe(true); return () => onSubscribe(false); }, [onSubscribe]);
  const hasSignal = useAudioSignal(frame);
  return (
    <main className="audio-stage relative h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,color-mix(in_oklch,var(--primary)_9%,transparent),transparent_58%)]" />
      <AudioRenderer frame={frame} mode={config.audio_visualizer_mode} primary={config.audio_color_primary} secondary={config.audio_color_secondary} gradient={config.audio_color_mode === "gradient"} amplitude={config.audio_amplitude} smoothing={config.audio_smoothing} interactive className="absolute inset-0 h-full w-full" />
      <div className="safe-pad pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between">
        <div className="audio-stage-badge vf-row pointer-events-auto flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground backdrop-blur-xl">
          <AudioLines className="h-4 w-4 text-primary" />
          <span>{status?.state === "fallback" ? t("audioFallback") : status?.state === "error" ? t("audioCaptureError") : hasSignal ? t("audioListening") : t("audioWaiting")}</span>
        </div>
        <Button variant="outline" size="icon" className="audio-stage-control pointer-events-auto backdrop-blur-xl" aria-label={t("settings")} onClick={onOpenSettings}><Settings2 className="h-5 w-5" /></Button>
      </div>
      {!hasSignal && status?.state !== "error" ? <div className="pointer-events-none absolute inset-x-0 bottom-[10dvh] text-center"><p className="font-[family-name:var(--font-display)] text-lg font-medium tracking-tight">{t("audioWaitingTitle")}</p><p className="mt-1 text-xs text-muted-foreground">{t("audioWaitingHint")}</p></div> : null}
    </main>
  );
}
