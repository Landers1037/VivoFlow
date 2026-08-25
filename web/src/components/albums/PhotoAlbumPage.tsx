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

type SingleTransitionEffect = "fly" | "rise" | "zoom" | "flip" | "wipe" | "dissolve" | "mosaic";

const SINGLE_TRANSITION_EFFECTS: SingleTransitionEffect[] = ["fly", "rise", "zoom", "flip", "wipe", "dissolve", "mosaic"];
const MOSAIC_COLUMNS = 8;
const MOSAIC_ROWS = 6;
const MOSAIC_TILES = Array.from({ length: MOSAIC_COLUMNS * MOSAIC_ROWS }, (_, index) => ({
  index,
  column: index % MOSAIC_COLUMNS,
  row: Math.floor(index / MOSAIC_COLUMNS),
  delay: (((index * 17) + (index * index * 7)) % (MOSAIC_COLUMNS * MOSAIC_ROWS)) / (MOSAIC_COLUMNS * MOSAIC_ROWS) * 0.48,
}));

function randomTransition(previous?: SingleTransitionEffect): SingleTransitionEffect {
  const choices = previous ? SINGLE_TRANSITION_EFFECTS.filter((effect) => effect !== previous) : SINGLE_TRANSITION_EFFECTS;
  return choices[Math.floor(Math.random() * choices.length)] ?? "dissolve";
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
  const [singleTransition, setSingleTransition] = useState<SingleTransitionEffect>(() => randomTransition());
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
    setSingleTransition((previousEffect) => randomTransition(previousEffect));
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
    setSingleTransition((previousEffect) => randomTransition(previousEffect));
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
            effect={singleTransition}
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
                className="vf-surface photo-frame-control pointer-events-auto relative z-10 touch-manipulation"
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
                <div className="vf-surface photo-frame-meta max-w-2xl" aria-live="polite">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight sm:text-3xl">{current.album.title}</h1>
                    {current.album.date ? <time className="text-xs font-medium tracking-[0.12em] text-muted-foreground">{current.album.date}</time> : null}
                  </div>
                  {current.album.description ? <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{current.album.description}</p> : null}
                  <p className="vf-data mt-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">{String(index + 1).padStart(2, "0")} / {String(playlist.length).padStart(2, "0")}</p>
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
      className="vf-surface photo-frame-control flex h-11 w-11 touch-manipulation items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:h-5 [&_svg]:w-5"
    >
      {children}
    </button>
  );
}

function EmptyFrame({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useAppearance();
  return (
    <div className="photo-frame-empty flex h-full items-center justify-center p-6 text-center text-foreground">
      <div className="max-w-md">
        <div className="vf-surface photo-frame-empty-icon mx-auto flex h-16 w-16 items-center justify-center"><Images className="h-7 w-7 text-muted-foreground" /></div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("photoFrameEmpty")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("photoFrameEmptyHint")}</p>
        <Button className="mt-5" onClick={onOpenSettings}><Settings2 className="h-4 w-4" />{t("openAlbumSettings")}</Button>
      </div>
    </div>
  );
}

function SingleCarousel({ current, effect, onImageError, reducedMotion }: { current: PlaylistItem; effect: SingleTransitionEffect; onImageError: (image: AlbumImage) => void; reducedMotion: boolean }) {
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.78, ease: [0.22, 1, 0.36, 1] as const };
  const variants = {
    fly: {
      initial: { opacity: 0, x: "24%", rotateZ: 1.5, scale: 0.96 },
      animate: { opacity: 1, x: 0, rotateZ: 0, scale: 1 },
      exit: { opacity: 0, x: "-10%", scale: 0.985 },
    },
    rise: {
      initial: { opacity: 0, y: "22%", scale: 0.97 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: "-9%", scale: 0.99 },
    },
    zoom: {
      initial: { opacity: 0, scale: 1.16, filter: "blur(8px)" },
      animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
      exit: { opacity: 0, scale: 0.94, filter: "blur(4px)" },
    },
    flip: {
      initial: { opacity: 0, rotateY: 68, scale: 0.92 },
      animate: { opacity: 1, rotateY: 0, scale: 1 },
      exit: { opacity: 0, rotateY: -36, scale: 0.96 },
    },
    wipe: {
      initial: { opacity: 1, clipPath: "inset(0 100% 0 0)" },
      animate: { opacity: 1, clipPath: "inset(0 0% 0 0)" },
      exit: { opacity: 0, clipPath: "inset(0 0 0 0)" },
    },
    dissolve: {
      initial: { opacity: 0, filter: "blur(18px) saturate(0.65)", scale: 1.035 },
      animate: { opacity: 1, filter: "blur(0px) saturate(1)", scale: 1 },
      exit: { opacity: 0, filter: "blur(10px) saturate(0.8)", scale: 0.985 },
    },
  } as const;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ perspective: "1400px" }}>
      <AnimatePresence initial={false} mode="sync">
        {effect === "mosaic" && !reducedMotion ? (
          <motion.div key={current.image.id} className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.28 }}>
            <motion.img
              src={current.image.content_url}
              alt={current.image.original_name}
              onError={() => onImageError(current.image)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.18 }}
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
            <div
              className="absolute inset-0 grid"
              aria-hidden="true"
              style={{ gridTemplateColumns: `repeat(${MOSAIC_COLUMNS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${MOSAIC_ROWS}, minmax(0, 1fr))` }}
            >
              {MOSAIC_TILES.map((tile) => (
                <motion.span
                  key={tile.index}
                  className="relative overflow-hidden"
                  initial={{ opacity: 0, scale: 0.45, rotateZ: tile.index % 2 === 0 ? -7 : 7 }}
                  animate={{ opacity: 1, scale: 1, rotateZ: 0 }}
                  transition={{ delay: tile.delay, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                >
                  <img
                    src={current.image.content_url}
                    alt=""
                    className="pointer-events-none absolute max-w-none object-contain"
                    style={{
                      width: `${MOSAIC_COLUMNS * 100}%`,
                      height: `${MOSAIC_ROWS * 100}%`,
                      left: `-${tile.column * 100}%`,
                      top: `-${tile.row * 100}%`,
                    }}
                    draggable={false}
                  />
                </motion.span>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.img
            key={current.image.id}
            src={current.image.content_url}
            alt={current.image.original_name}
            onError={() => onImageError(current.image)}
            initial={reducedMotion ? { opacity: 1 } : variants[effect === "mosaic" ? "dissolve" : effect].initial}
            animate={reducedMotion ? { opacity: 1 } : variants[effect === "mosaic" ? "dissolve" : effect].animate}
            exit={reducedMotion ? { opacity: 0 } : variants[effect === "mosaic" ? "dissolve" : effect].exit}
            transition={transition}
            className="absolute inset-0 h-full w-full object-contain [backface-visibility:hidden]"
            draggable={false}
          />
        )}
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
              className="vf-surface photo-frame-card absolute inset-0 overflow-hidden"
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
              className="vf-surface photo-frame-card absolute left-1/2 top-1/2 h-[min(62vh,680px)] w-[min(68vw,840px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden"
            >
              <img src={item.image.content_url} alt={item.image.original_name} onError={() => onImageError(item.image)} className="h-full w-full object-contain" draggable={false} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
