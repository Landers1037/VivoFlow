import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, Settings2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useAppearance } from "@/hooks/useAppearance";
import { albumApi, shuffled } from "@/lib/albums";
import { cn } from "@/lib/utils";
import type { Album, AlbumImage } from "@/types";

interface PlaylistItem {
  album: Album;
  image: AlbumImage;
  imageIndex: number;
}

export function PhotoAlbumPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t, config } = useAppearance();
  const reducedMotion = useReducedMotion();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [cycle, setCycle] = useState(0);
  const [index, setIndex] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const idleTimer = useRef<number | null>(null);
  const pointerStart = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    albumApi.list()
      .then((items) => { if (alive) setAlbums(items); })
      .catch((reason: Error) => { if (alive) setLoadError(reason.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const eligible = useMemo(
    () => albums
      .filter((album) => album.show_on_home)
      .map((album) => ({ ...album, images: album.images.filter((image) => !failed.has(image.id)) }))
      .filter((album) => album.images.length > 0),
    [albums, failed],
  );

  const playlist = useMemo<PlaylistItem[]>(() => {
    void cycle;
    return eligible.flatMap((album) => {
      const images = album.shuffle ? shuffled(album.images) : album.images;
      return images.map((image, imageIndex) => ({ album, image, imageIndex }));
    });
  }, [eligible, cycle]);

  useEffect(() => {
    if (index >= playlist.length) setIndex(Math.max(0, playlist.length - 1));
  }, [index, playlist.length]);

  const current = playlist[index] ?? null;
  const currentImageId = current?.image.id ?? null;
  const currentIntervalSeconds = current?.album.interval_s ?? 5;

  const reveal = useCallback(() => {
    setChromeVisible(true);
    if (idleTimer.current != null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setChromeVisible(false), 4000);
  }, []);

  useEffect(() => {
    reveal();
    return () => { if (idleTimer.current != null) window.clearTimeout(idleTimer.current); };
  }, [reveal]);

  const advance = useCallback(() => {
    if (playlist.length === 0) return;
    setIndex((value) => {
      if (value < playlist.length - 1) return value + 1;
      setCycle((round) => round + 1);
      return 0;
    });
  }, [playlist.length]);

  const next = useCallback(() => {
    advance();
    reveal();
  }, [advance, reveal]);

  const previous = useCallback(() => {
    if (playlist.length === 0) return;
    setIndex((value) => (value > 0 ? value - 1 : playlist.length - 1));
    reveal();
  }, [playlist.length, reveal]);

  useEffect(() => {
    if (!currentImageId || playlist.length < 2) return;
    const intervalSeconds = Number.isFinite(currentIntervalSeconds)
      ? Math.min(60, Math.max(1, currentIntervalSeconds))
      : 5;
    const timer = window.setTimeout(advance, intervalSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [advance, currentImageId, currentIntervalSeconds, playlist.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      reveal();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, reveal]);

  const imageFailed = (image: AlbumImage) => {
    setFailed((currentFailed) => new Set(currentFailed).add(image.id));
    setLoadError(`${image.original_name}: ${t("albumActionFailed")}`);
  };

  const customSwipe = playlist.length > 1;

  return (
    <main
      className="photo-frame"
      onMouseMove={reveal}
      onClick={reveal}
      onPointerDown={(event) => {
        if (customSwipe && !(event.target as HTMLElement).closest("button, a, input, select, textarea")) {
          pointerStart.current = event.clientX;
        }
      }}
      onPointerUp={(event) => {
        if (!customSwipe || pointerStart.current == null || (event.target as HTMLElement).closest("button, a, input, select, textarea")) {
          pointerStart.current = null;
          return;
        }
        const distance = event.clientX - pointerStart.current;
        pointerStart.current = null;
        if (distance > 45) previous();
        if (distance < -45) next();
      }}
    >
      {current ? (
        <div className="absolute inset-0 overflow-hidden bg-[#07080a]">
          <AnimatePresence mode="sync">
            <motion.img
              key={`backdrop-${current.image.id}`}
              src={current.image.content_url}
              alt=""
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.44 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.7 }}
              className="absolute -inset-8 h-[calc(100%+4rem)] w-[calc(100%+4rem)] scale-110 object-cover blur-3xl saturate-75"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-black/30" />
        </div>
      ) : null}

      <div className="relative z-10 h-full w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-white/65">{t("loading")}</div>
        ) : playlist.length === 0 ? (
          <EmptyFrame onOpenSettings={onOpenSettings} />
        ) : config.photo_album_effect === "time_machine" ? (
          <TimeMachine playlist={playlist} index={index} onSelect={setIndex} onImageError={imageFailed} />
        ) : config.photo_album_effect === "cover_flow" ? (
          <CoverFlow playlist={playlist} index={index} onSelect={setIndex} onImageError={imageFailed} />
        ) : (
          <SingleCarousel
            current={current}
            onImageError={imageFailed}
            reducedMotion={Boolean(reducedMotion)}
          />
        )}
      </div>

      <AnimatePresence>
        {chromeVisible ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-40">
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-[max(1rem,env(safe-area-inset-top))]">
              <Button
                variant="outline"
                size="icon"
                className="pointer-events-auto relative z-10 touch-manipulation border-white/20 bg-black/35 text-white backdrop-blur-xl hover:bg-black/55"
                aria-label={t("settings")}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenSettings();
                }}
              >
                <Settings2 className="h-5 w-5" />
              </Button>
            </div>
            {current ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="max-w-2xl rounded-2xl bg-black/28 px-4 py-3 text-white shadow-2xl backdrop-blur-xl sm:px-5 sm:py-4" aria-live="polite">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight sm:text-3xl">{current.album.title}</h1>
                    {current.album.date ? <time className="text-xs font-medium tracking-[0.12em] text-white/60">{current.album.date}</time> : null}
                  </div>
                  {current.album.description ? <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/72">{current.album.description}</p> : null}
                  <p className="mt-2 text-[10px] font-semibold tracking-[0.18em] text-white/45">{String(index + 1).padStart(2, "0")} / {String(playlist.length).padStart(2, "0")}</p>
                </div>
                <div className="pointer-events-auto relative z-10 hidden items-center gap-2 sm:flex">
                  <FrameButton label={t("previousPhoto")} onClick={previous}><ChevronLeft /></FrameButton>
                  <FrameButton label={t("nextPhoto")} onClick={next}><ChevronRight /></FrameButton>
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {loadError ? (
        <button type="button" onClick={() => setLoadError(null)} className="absolute bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-red-950/80 px-4 py-2 text-xs text-red-100 shadow-xl backdrop-blur">
          {loadError}
        </button>
      ) : null}
    </main>
  );
}

function FrameButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-white/18 bg-black/30 text-white backdrop-blur-xl transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 [&_svg]:h-5 [&_svg]:w-5"
    >
      {children}
    </button>
  );
}

function EmptyFrame({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useAppearance();
  return (
    <div className="flex h-full items-center justify-center bg-[#08090b] p-6 text-center text-white">
      <div className="max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5"><Images className="h-7 w-7 text-white/65" /></div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("photoFrameEmpty")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{t("photoFrameEmptyHint")}</p>
        <Button className="mt-5" onClick={onOpenSettings}><Settings2 className="h-4 w-4" />{t("openAlbumSettings")}</Button>
      </div>
    </div>
  );
}

function SingleCarousel({ current, onImageError, reducedMotion }: { current: PlaylistItem; onImageError: (image: AlbumImage) => void; reducedMotion: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatePresence initial={false} mode="sync">
        <motion.img
          key={current.image.id}
          src={current.image.content_url}
          alt={current.image.original_name}
          onError={() => onImageError(current.image)}
          initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.985 }}
          transition={{ duration: reducedMotion ? 0 : 0.72, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
      </AnimatePresence>
    </div>
  );
}

function TimeMachine({ playlist, index, onSelect, onImageError }: { playlist: PlaylistItem[]; index: number; onSelect: (index: number) => void; onImageError: (image: AlbumImage) => void }) {
  const reducedMotion = useReducedMotion();
  const currentAlbumId = playlist[index]?.album.id;
  const albumItems = playlist.map((item, itemIndex) => ({ ...item, itemIndex })).filter((item) => item.album.id === currentAlbumId);
  const localIndex = Math.max(0, albumItems.findIndex((item) => item.itemIndex === index));
  return (
    <div className="flex h-full w-full items-center justify-center gap-4 overflow-hidden px-4 sm:gap-10 sm:px-12" style={{ perspective: "1100px" }}>
      <div className="relative h-[62vh] w-[min(72vw,860px)]">
        {albumItems.map((item, position) => {
          const offset = position - localIndex;
          const past = offset < 0;
          if (Math.abs(offset) > 5) return null;
          return (
            <motion.button
              type="button"
              key={item.image.id}
              onClick={() => onSelect(item.itemIndex)}
              animate={{
                z: past ? 220 : -offset * 80,
                y: past ? "70%" : offset * -14,
                rotateX: reducedMotion ? 0 : past ? -16 : offset * 1.8,
                opacity: past ? 0 : Math.max(0.18, 1 - offset * 0.17),
                scale: past ? 1.15 : 1 - Math.max(0, offset) * 0.025,
              }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 230, damping: 27 }}
              style={{ zIndex: albumItems.length - position }}
              className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-white/12 bg-black shadow-[0_28px_80px_rgba(0,0,0,.5)]"
            >
              <img src={item.image.content_url} alt={item.image.original_name} onError={() => onImageError(item.image)} className="h-full w-full object-contain" draggable={false} />
            </motion.button>
          );
        })}
      </div>
      <div className="relative z-20 flex max-h-[56vh] w-14 flex-col items-end justify-center gap-1 overflow-hidden">
        {albumItems.map((item, position) => (
          <button key={item.image.id} type="button" aria-label={`${position + 1}`} onClick={() => onSelect(item.itemIndex)} className="group flex min-h-4 w-full items-center justify-end">
            <span className={cn("h-[3px] rounded-full transition-all", position === localIndex ? "w-10 bg-white" : "w-5 bg-white/28 group-hover:w-7 group-hover:bg-white/60")} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CoverFlow({ playlist, index, onSelect, onImageError }: { playlist: PlaylistItem[]; index: number; onSelect: (index: number) => void; onImageError: (image: AlbumImage) => void }) {
  const reducedMotion = useReducedMotion();
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden" style={{ perspective: "1200px" }}>
      <div className="relative h-[62vh] w-full [transform-style:preserve-3d]">
        {playlist.map((item, itemIndex) => {
          const offset = itemIndex - index;
          const absolute = Math.abs(offset);
          if (absolute > 4) return null;
          return (
            <motion.button
              type="button"
              key={`${item.album.id}-${item.image.id}`}
              onClick={() => onSelect(itemIndex)}
              animate={{
                x: reducedMotion ? offset * 26 : offset * Math.min(180, window.innerWidth * 0.16),
                rotateY: reducedMotion || offset === 0 ? 0 : offset < 0 ? 42 : -42,
                z: offset === 0 ? 100 : -absolute * 90,
                scale: offset === 0 ? 1 : Math.max(0.72, 1 - absolute * 0.08),
                opacity: Math.max(0.16, 1 - absolute * 0.2),
              }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 26 }}
              style={{ zIndex: 100 - absolute }}
              className="absolute left-1/2 top-1/2 h-[min(62vh,680px)] w-[min(68vw,840px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.5rem] border border-white/12 bg-black shadow-[0_30px_90px_rgba(0,0,0,.55)]"
            >
              <img src={item.image.content_url} alt={item.image.original_name} onError={() => onImageError(item.image)} className="h-full w-full object-contain" draggable={false} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
