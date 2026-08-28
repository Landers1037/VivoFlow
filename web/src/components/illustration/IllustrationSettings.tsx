import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, ImagePlus, LoaderCircle, Sparkles, Trash2, Upload } from "lucide-react";
import { SettingsGroup, SettingsSegmented, SettingsSliderRow, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";
import { illustrationApi } from "@/lib/illustrations";
import { decodeImageFile, processPixelArt, renderPixelArt, settingsForPreset } from "@/pixel-art";
import type { IllustrationImage, IllustrationsResponse, PixelArtPreset, PixelArtSettings } from "@/types";
import type { PixelArtWorkerResponse } from "@/pixel-art/types";

const DEFAULT_SETTINGS: PixelArtSettings = {
  interval_s: 8,
  shuffle: false,
  preset: "balanced",
  target_short_edge: 128,
  palette_size: 32,
  smoothing: 0.18,
  contrast: 0.08,
  saturation: 0.08,
  gamma: 1,
  dithering: "ordered",
  dithering_strength: 0.2,
  edge_enhancement: 0.12,
  sharpen: 0.12,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IllustrationSettings() {
  const { t, config, synced, setIllustrationEnabled } = useAppearance();
  const presets: { id: PixelArtPreset; label: string }[] = [
    { id: "auto", label: t("illustrationAuto") },
    { id: "balanced", label: t("illustrationBalanced") },
    { id: "detailed", label: t("illustrationDetailed") },
    { id: "retro", label: t("illustrationRetro") },
    { id: "painting", label: t("illustrationPainting") },
    { id: "8bit", label: t("illustration8Bit") },
  ];
  const [data, setData] = useState<IllustrationsResponse>({ settings: DEFAULT_SETTINGS, images: [] });
  const [settings, setSettings] = useState<PixelArtSettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const saveGenerationRef = useRef(0);
  const uploadGenerationRef = useRef(0);
  const pendingRef = useRef(new Map<number, (response: PixelArtWorkerResponse) => void>());
  const saveTimerRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let alive = true;
    illustrationApi.list().then((result) => {
      if (!alive) return;
      setData(result);
      setSettings(result.settings);
    }).catch((reason: Error) => alive && setError(reason.message));
    return () => { alive = false; };
  }, [t]);

  useEffect(() => () => {
    saveGenerationRef.current += 1;
    uploadGenerationRef.current += 1;
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      void illustrationApi.updateSettings(settingsRef.current);
    }
  }, []);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    try {
      const worker = new Worker(new URL("../../pixel-art/pixelArt.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<PixelArtWorkerResponse>) => {
        pendingRef.current.get(event.data.requestId)?.(event.data);
        pendingRef.current.delete(event.data.requestId);
      };
      workerRef.current = worker;
      return () => {
        worker.terminate();
        workerRef.current = null;
        pendingRef.current.clear();
      };
    } catch {
      workerRef.current = null;
      return undefined;
    }
  }, []);

  const selected = data.images[0] ?? null;
  const settingsKey = useMemo(() => JSON.stringify(settings), [settings]);

  const runPreview = useCallback(async (image: IllustrationImage, currentSettings: PixelArtSettings) => {
    const requestId = ++requestRef.current;
    setPreviewBusy(true);
    try {
      const blob = await fetch(image.content_url).then((response) => {
        if (!response.ok) throw new Error("无法读取插画原图");
        return response.blob();
      });
      const imageData = await decodeImageFile(new File([blob], image.original_name, { type: image.mime_type }), 768);
      if (requestId !== requestRef.current) return;
      let result;
      if (workerRef.current) {
        const response = await new Promise<PixelArtWorkerResponse>((resolve) => {
          pendingRef.current.set(requestId, resolve);
          workerRef.current?.postMessage({ requestId, imageData, settings: currentSettings });
        });
        if (response.error) throw new Error(response.error);
        result = response.result;
      } else {
        result = processPixelArt(imageData, currentSettings);
      }
      if (result && requestId === requestRef.current && canvasRef.current) {
        canvasRef.current.width = 768;
        canvasRef.current.height = Math.max(420, Math.round(768 * result.height / result.width));
        renderPixelArt(canvasRef.current, result);
      }
    } catch (reason) {
      if (requestId === requestRef.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (requestId === requestRef.current) setPreviewBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const timer = window.setTimeout(() => void runPreview(selected, settings), 150);
    return () => window.clearTimeout(timer);
  }, [selected, settingsKey, runPreview]);

  const saveSettings = useCallback(async (next: PixelArtSettings) => {
    const generation = ++saveGenerationRef.current;
    try {
      const result = await illustrationApi.updateSettings(next);
      if (generation !== saveGenerationRef.current) return;
      setData(result);
      setSettings(result.settings);
      setMessage(t("illustrationSaved"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [t]);

  const patchSettings = (patch: Partial<PixelArtSettings>, save = true) => {
    const next = { ...settings, ...patch, preset: patch.preset ?? "custom" };
    setSettings(next);
    setData((current) => ({ ...current, settings: next }));
    if (save) {
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void saveSettings(next);
      }, 350);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const generation = ++uploadGenerationRef.current;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await illustrationApi.upload(files);
      if (generation !== uploadGenerationRef.current) return;
      setData(result); setSettings(result.settings); setMessage(t("illustrationAdded", { count: files.length }));
    } catch (reason) {
      if (generation === uploadGenerationRef.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (generation === uploadGenerationRef.current) setBusy(false);
    }
  };

  const reorder = async (from: number, to: number) => {
    const previous = [...data.images];
    const next = [...previous];
    if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setData((current) => ({ ...current, images: next }));
    try { setData(await illustrationApi.order(next.map((image) => image.id))); }
    catch (reason) {
      setData((current) => ({ ...current, images: previous }));
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const move = (index: number, direction: -1 | 1) => void reorder(index, index + direction);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = data.images.findIndex((image) => image.id === active.id);
    const to = data.images.findIndex((image) => image.id === over.id);
    void reorder(from, to);
  };

  const remove = async (image: IllustrationImage) => {
    if (!window.confirm(t("illustrationDeleteConfirm", { name: image.original_name }))) return;
    setBusy(true);
    try { setData(await illustrationApi.remove(image.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const applyPreset = (preset: PixelArtPreset) => {
    const next = settingsForPreset(settings, preset);
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSettings(next); setData((current) => ({ ...current, settings: next }));
    void saveSettings(next);
  };

  return (
    <div className="settings-module">
      <SettingsGroup footer={t("illustrationPrivacy")}>
        <SettingsSwitchRow
          id="illustration-enabled"
          icon={Sparkles}
          title={t("illustration")}
          subtitle={t("illustrationHint")}
          checked={config.illustration_enabled}
          disabled={!synced}
          onCheckedChange={setIllustrationEnabled}
        />
      </SettingsGroup>

      <SettingsGroup label={t("illustrationSource")}>
        <label className="settings-row cursor-pointer">
          <span className="settings-row-icon"><Upload className="h-4 w-4" strokeWidth={1.75} /></span>
          <span className="settings-row-copy">
            <span className="settings-row-title">{t("illustrationUpload")}</span>
            <span className="settings-row-subtitle">{t("illustrationUploadHint")}</span>
          </span>
          <input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" disabled={busy} onChange={upload} />
        </label>
        {data.images.length ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={data.images.map((image) => image.id)} strategy={verticalListSortingStrategy}>
              {data.images.map((image, index) => (
                <SortableIllustration
                  key={image.id}
                  image={image}
                  index={index}
                  count={data.images.length}
                  busy={busy}
                  labelUp={t("illustrationMoveUp")}
                  labelDown={t("illustrationMoveDown")}
                  labelDelete={t("illustrationDelete")}
                  labelDrag={t("illustrationDragHandle")}
                  onMove={move}
                  onRemove={remove}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : null}
        {!data.images.length ? (
          <div className="settings-empty-state"><ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">{t("illustrationEmpty")}</p></div>
        ) : null}
      </SettingsGroup>

      <SettingsGroup label={t("illustrationPresets")}>
        <SettingsSegmented options={presets} value={settings.preset} onChange={applyPreset} disabled={busy} />
      </SettingsGroup>

      <SettingsGroup label={t("illustrationSlideshow")}>
        <SettingsSwitchRow id="illustration-shuffle" title={t("illustrationShuffle")} checked={settings.shuffle} disabled={busy} onCheckedChange={(shuffle) => patchSettings({ shuffle })} />
        <SettingsSliderRow id="illustration-interval" title={t("illustrationInterval")} valueLabel={`${settings.interval_s} s`} min={2} max={60} step={1} value={settings.interval_s} disabled={busy} onChange={(interval_s) => patchSettings({ interval_s })} />
      </SettingsGroup>

      <SettingsGroup label={t("illustrationAdvanced")} footer={t("illustrationAdvancedHint")}>
        <SettingsSliderRow id="illustration-resolution" title={t("illustrationResolution")} valueLabel={`${settings.target_short_edge}px`} min={80} max={256} step={8} value={settings.target_short_edge} disabled={busy} onChange={(target_short_edge) => patchSettings({ target_short_edge })} />
        <div className="settings-row settings-row-stack"><div className="settings-slider-meta"><span className="settings-row-title">{t("illustrationColors")}</span><span className="settings-row-value">{settings.palette_size}</span></div><SettingsSegmented className="settings-segmented-palette" options={[8, 12, 16, 24, 32, 40, 48, 64].map((value) => ({ id: String(value), label: String(value) }))} value={String(settings.palette_size)} disabled={busy} onChange={(value) => patchSettings({ palette_size: Number(value) })} /></div>
        <div className="settings-row settings-row-stack"><div className="settings-slider-meta"><span className="settings-row-title">{t("illustrationDither")}</span></div><SettingsSegmented options={[{ id: "none", label: t("illustrationDitherNone") }, { id: "ordered", label: t("illustrationDitherOrdered") }, { id: "floyd_steinberg", label: t("illustrationDitherFloyd") }]} value={settings.dithering} disabled={busy} onChange={(dithering) => patchSettings({ dithering })} /></div>
        <SettingsSliderRow id="illustration-dither" title={t("illustrationDitherStrength")} valueLabel={`${Math.round(settings.dithering_strength * 100)}%`} min={0} max={settings.dithering === "floyd_steinberg" ? 0.35 : 0.5} step={0.01} value={settings.dithering_strength} disabled={busy} onChange={(dithering_strength) => patchSettings({ dithering_strength })} />
        <SettingsSliderRow id="illustration-smoothing" title={t("illustrationSmoothing")} valueLabel={`${Math.round(settings.smoothing * 100)}%`} min={0} max={0.5} step={0.01} value={settings.smoothing} disabled={busy} onChange={(smoothing) => patchSettings({ smoothing })} />
        <SettingsSliderRow id="illustration-contrast" title={t("illustrationContrast")} valueLabel={`${Math.round(settings.contrast * 100)}%`} min={-0.3} max={0.5} step={0.01} value={settings.contrast} disabled={busy} onChange={(contrast) => patchSettings({ contrast })} />
        <SettingsSliderRow id="illustration-saturation" title={t("illustrationSaturation")} valueLabel={`${Math.round(settings.saturation * 100)}%`} min={-0.3} max={0.5} step={0.01} value={settings.saturation} disabled={busy} onChange={(saturation) => patchSettings({ saturation })} />
        <SettingsSliderRow id="illustration-gamma" title={t("illustrationGamma")} valueLabel={settings.gamma.toFixed(2)} min={0.5} max={1.5} step={0.01} value={settings.gamma} disabled={busy} onChange={(gamma) => patchSettings({ gamma })} />
        <SettingsSliderRow id="illustration-edge" title={t("illustrationEdge")} valueLabel={`${Math.round(settings.edge_enhancement * 100)}%`} min={0} max={0.25} step={0.01} value={settings.edge_enhancement} disabled={busy} onChange={(edge_enhancement) => patchSettings({ edge_enhancement })} />
        <SettingsSliderRow id="illustration-sharpen" title={t("illustrationSharpen")} valueLabel={`${Math.round(settings.sharpen * 100)}%`} min={0} max={0.25} step={0.01} value={settings.sharpen} disabled={busy} onChange={(sharpen) => patchSettings({ sharpen })} />
      </SettingsGroup>

      {message ? <p className="settings-status-success">{message}</p> : null}
      {error ? <p className="settings-status-error">{error}</p> : null}
      {selected ? <SettingsGroup label={t("illustrationPreview")}><div className="relative overflow-hidden rounded-xl border border-border/70 bg-black/20"><canvas ref={canvasRef} className="block h-auto max-h-[55vh] w-full" />{previewBusy ? <div className="absolute inset-0 grid place-items-center bg-background/35"><LoaderCircle className="h-6 w-6 animate-spin" /></div> : null}</div></SettingsGroup> : null}
    </div>
  );
}

function SortableIllustration({
  image,
  index,
  count,
  busy,
  labelUp,
  labelDown,
  labelDelete,
  labelDrag,
  onMove,
  onRemove,
}: {
  image: IllustrationImage;
  index: number;
  count: number;
  busy: boolean;
  labelUp: string;
  labelDown: string;
  labelDelete: string;
  labelDrag: string;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (image: IllustrationImage) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  return (
    <div
      ref={setNodeRef}
      className="settings-list-card"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.68 : 1 }}
    >
      <div className="settings-cover h-14 w-14 overflow-hidden bg-muted">
        <img src={image.content_url} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{image.original_name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(image.size_bytes)}</p>
      </div>
      <div className="settings-list-card-actions">
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted/70"
          aria-label={`${image.original_name} · ${labelDrag}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className="settings-list-card-control" disabled={index === 0 || busy} onClick={() => onMove(index, -1)} aria-label={labelUp}><ChevronUp className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" className="settings-list-card-control" disabled={index === count - 1 || busy} onClick={() => onMove(index, 1)} aria-label={labelDown}><ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" className="settings-list-card-control text-destructive" disabled={busy} onClick={() => void onRemove(image)} aria-label={labelDelete}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </div>
  );
}
