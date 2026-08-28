import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { illustrationApi } from "@/lib/illustrations";
import { useAppearance } from "@/hooks/useAppearance";
import { decodeImageFile, processPixelArt, renderPixelArt } from "@/pixel-art";
import type { PixelArtResult, PixelArtWorkerResponse } from "@/pixel-art/types";
import type { IllustrationImage, IllustrationsResponse } from "@/types";

const PIXEL_PIPELINE_VERSION = 1;

export function IllustrationPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useAppearance();
  const [data, setData] = useState<IllustrationsResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<PixelArtResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<number, (response: PixelArtWorkerResponse) => void>());
  const cacheRef = useRef(new Map<string, PixelArtResult>());
  const requestRef = useRef(0);
  const generationRef = useRef(0);

  useEffect(() => {
    let alive = true;
    illustrationApi.list().then((next) => alive && setData(next)).catch((reason: Error) => alive && setError(reason.message));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    try {
      const worker = new Worker(new URL("../../pixel-art/pixelArt.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<PixelArtWorkerResponse>) => {
        const resolve = pendingRef.current.get(event.data.requestId);
        if (resolve) { pendingRef.current.delete(event.data.requestId); resolve(event.data); }
      };
      workerRef.current = worker;
      return () => { worker.terminate(); workerRef.current = null; pendingRef.current.clear(); };
    } catch {
      workerRef.current = null;
      return undefined;
    }
  }, []);

  const orderedImages = useMemo(() => {
    if (!data) return [];
    const images = [...data.images];
    if (!data.settings.shuffle || images.length < 2) return images;
    // A stable shuffle per settings payload avoids reordering during a render.
    let seed = images.length * 2654435761;
    for (let i = images.length - 1; i > 0; i -= 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [images[i], images[j]] = [images[j], images[i]];
    }
    return images;
  }, [data]);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, orderedImages.length - 1)));
    cacheRef.current.clear();
    setFailedIds([]);
    setCanvasVisible(false);
  }, [orderedImages.length, data?.settings.preset]);

  const runWorker = useCallback(async (imageData: ImageData, settings: IllustrationsResponse["settings"], requestId: number) => {
    if (!workerRef.current) return processPixelArt(imageData, settings);
    const response = await new Promise<PixelArtWorkerResponse>((resolve) => {
      pendingRef.current.set(requestId, resolve);
      workerRef.current?.postMessage({ requestId, imageData, settings });
    });
    if (response.error || !response.result) throw new Error(response.error ?? "像素处理失败");
    return response.result;
  }, []);

  const processImage = useCallback(async (image: IllustrationImage, settings: IllustrationsResponse["settings"]): Promise<PixelArtResult> => {
    const cacheKey = `${image.id}:${image.version}:${PIXEL_PIPELINE_VERSION}:${JSON.stringify(settings)}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) return cached;
    const blob = await fetch(image.content_url).then((response) => {
      if (!response.ok) throw new Error("无法读取插画原图");
      return response.blob();
    });
    const imageData = await decodeImageFile(new File([blob], image.original_name, { type: image.mime_type }), 1280);
    const next = await runWorker(imageData, settings, ++requestRef.current);
    cacheRef.current.set(cacheKey, next);
    while (cacheRef.current.size > 2) cacheRef.current.delete(cacheRef.current.keys().next().value as string);
    return next;
  }, [runWorker]);

  const draw = useCallback((next: PixelArtResult) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    renderPixelArt(canvas, next);
  }, []);

  useEffect(() => {
    if (!orderedImages.length || !data) return;
    const generation = ++generationRef.current;
    const current = orderedImages[index] ?? orderedImages[0];
    const next = orderedImages[(index + 1) % orderedImages.length];
    setLoading(true); setError("");
    void processImage(current, data.settings).then((processed) => {
      if (generation !== generationRef.current) return;
      setFailedIds((ids) => ids.filter((id) => id !== current.id));
      setResult(processed); setCanvasVisible(false); draw(processed); setLoading(false);
      window.requestAnimationFrame(() => {
        if (generation === generationRef.current) setCanvasVisible(true);
      });
      if (next && next.id !== current.id) void processImage(next, data.settings).catch(() => undefined);
    }).catch((reason) => {
      if (generation !== generationRef.current) return;
      setFailedIds((ids) => ids.includes(current.id) ? ids : [...ids, current.id]);
      setLoading(false); setError(reason instanceof Error ? reason.message : String(reason));
      if (orderedImages.length > 1) {
        setIndex((value) => value === index ? (value + 1) % orderedImages.length : value);
      }
    });
  }, [data, index, orderedImages, processImage, draw]);

  useEffect(() => {
    if (!data || orderedImages.length <= 1) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % orderedImages.length), data.settings.interval_s * 1000);
    return () => window.clearInterval(timer);
  }, [data, orderedImages.length]);

  useEffect(() => {
    const onResize = () => { if (result) draw(result); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [result, draw]);

  if (!data) {
    return <div className="illustration-empty"><LoaderCircle className="h-8 w-8 animate-spin" /><p>{error || t("illustrationLoading")}</p></div>;
  }

  if (!data.images.length) {
    return <div className="illustration-empty"><ImagePlus className="h-10 w-10" /><h1>{t("illustrationHomeEmpty")}</h1><p>{t("illustrationHomeHint")}</p><Button onClick={onOpenSettings}><Settings2 className="mr-2 h-4 w-4" />{t("illustrationOpenSettings")}</Button></div>;
  }

  if (failedIds.length >= orderedImages.length && !loading) {
    return <div className="illustration-empty"><ImagePlus className="h-10 w-10" /><h1>{t("illustrationHomeEmpty")}</h1><p>{error || t("illustrationHomeHint")}</p><Button onClick={onOpenSettings}><Settings2 className="mr-2 h-4 w-4" />{t("illustrationOpenSettings")}</Button></div>;
  }

  return (
    <div className="illustration-page">
      <canvas ref={canvasRef} className={`illustration-canvas${canvasVisible ? " is-visible" : ""}`} aria-label={t("illustrationCanvasLabel")} />
      {loading ? <div className="illustration-loading"><LoaderCircle className="h-5 w-5 animate-spin" /></div> : null}
      {error ? <div className="illustration-error"><span>{error}</span><Button size="sm" variant="outline" onClick={onOpenSettings}>{t("illustrationOpenSettings")}</Button></div> : null}
      {orderedImages.length > 1 ? <div className="illustration-page-count">{index + 1} / {orderedImages.length}</div> : null}
    </div>
  );
}
