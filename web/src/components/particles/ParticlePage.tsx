import { useEffect, useMemo, useState } from "react";
import { Atom, ImagePlus, LoaderCircle, Settings2 } from "lucide-react";
import ParticleCanvas from "./ParticleCanvas";
import { Button } from "@/components/ui/button";
import { useAppearance } from "@/hooks/useAppearance";
import { particleApi } from "@/lib/particles";
import type { AudioFrame, AudioStatus, ParticleLibraryResponse } from "@/types";

const EMPTY: ParticleLibraryResponse = { active_image_id: null, images: [] };

export function ParticlePage({ frame, status, onSubscribe, onOpenSettings }: { frame: AudioFrame | null; status: AudioStatus | null; onSubscribe: (enabled: boolean) => void; onOpenSettings: () => void }) {
  const { config, t } = useAppearance();
  const [library, setLibrary] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    particleApi.list().then((data) => { if (alive) setLibrary(data); }).catch((reason: Error) => { if (alive) setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!config.particle_audio_reactive) return;
    onSubscribe(true);
    return () => onSubscribe(false);
  }, [config.particle_audio_reactive, onSubscribe]);
  const image = useMemo(() => library.images.find((item) => item.id === library.active_image_id) ?? library.images[0] ?? null, [library]);
  return <main className="particle-stage relative h-[100dvh] w-full overflow-hidden bg-background text-foreground">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_62%)]" />
    {image ? <ParticleCanvas image={image} frame={frame} dimension={config.particle_dimension} mode3d={config.particle_3d_mode} density={config.particle_density} size={config.particle_size} depth={config.particle_depth} motion={config.particle_motion} audioReactive={config.particle_audio_reactive} audioStrength={config.particle_audio_strength} interactive className="absolute inset-0 h-full w-full" onLoadingChange={setLoading} onError={(message) => setError(message ?? "")} /> : null}
    <div className="audio-stage-hud audio-stage-hud-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between">
      <div className="audio-stage-badge vf-row pointer-events-auto flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground backdrop-blur-xl"><Atom className="h-4 w-4 text-primary" /><span>{config.particle_audio_reactive ? status?.state === "error" ? t("audioCaptureError") : t("particleAudioActive") : t("particle")}</span></div>
      <Button variant="outline" size="icon" className="audio-stage-control pointer-events-auto backdrop-blur-xl" aria-label={t("settings")} onClick={onOpenSettings}><Settings2 className="h-5 w-5" /></Button>
    </div>
    {loading ? <div className="absolute inset-0 grid place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-primary" /></div> : null}
    {!loading && !image ? <div className="absolute inset-0 grid place-items-center px-6 text-center"><div><ImagePlus className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold">{t("particleHomeEmpty")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("particleHomeHint")}</p><Button className="mt-5" onClick={onOpenSettings}>{t("particleOpenSettings")}</Button></div></div> : null}
    {error ? <div className="absolute inset-x-4 bottom-8 z-10 mx-auto max-w-lg rounded-xl border border-destructive/25 bg-card/90 px-4 py-3 text-center text-sm text-destructive backdrop-blur-xl">{error}</div> : null}
  </main>;
}
