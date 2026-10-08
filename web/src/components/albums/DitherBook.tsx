/**
 * Page-turn book adapted from Amicro's 3D Dither Lab Book.
 * Source: https://amicro.vercel.app/3d (`npx @subhanhq/amicro@latest add dither-book`)
 * Upstream license: Apache-2.0
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { AlbumImage } from "@/types";

export interface DitherBookPage {
  id: string;
  title: string;
  src: string;
  image: AlbumImage;
}

interface BookSettings {
  padding: number;
  imageRadius: number;
  creaseOpacity: number;
  paperColor: string;
  shadowIntensity: number;
}

interface FlipState {
  from: number;
  to: number;
  dir: 1 | -1;
}

const SETTINGS: BookSettings = {
  padding: 18,
  imageRadius: 10,
  creaseOpacity: 12,
  paperColor: "#fcfbf9",
  shadowIntensity: 24,
};

const FLIP_MS = 620;

function wrap(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function PageFace({
  page,
  settings,
  onImageError,
}: {
  page: DitherBookPage | null;
  settings: BookSettings;
  onImageError: (image: AlbumImage) => void;
}) {
  return (
    <>
      <div className="absolute inset-0" style={{ backgroundColor: settings.paperColor }} />
      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: settings.padding }}>
        {page ? (
          <img
            src={page.src}
            alt={page.title}
            onError={() => onImageError(page.image)}
            draggable={false}
            className="h-full w-full object-contain"
            style={{
              borderRadius: settings.imageRadius,
              boxShadow: `0 4px ${settings.shadowIntensity}px rgba(0,0,0,0.16)`,
            }}
          />
        ) : null}
      </div>
    </>
  );
}

export function DitherBook({
  pages,
  index,
  direction,
  onPrev,
  onNext,
  onImageError,
  prevLabel,
  nextLabel,
}: {
  pages: DitherBookPage[];
  index: number;
  direction: 1 | -1;
  onPrev: () => void;
  onNext: () => void;
  onImageError: (image: AlbumImage) => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(index);
  const [flip, setFlip] = useState<FlipState | null>(null);
  const flipRef = useRef<FlipState | null>(null);
  const flipStartedAt = useRef(0);
  const pointerStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const pageKey = pages.map((page) => page.id).join("\0");
  const pageKeyRef = useRef(pageKey);

  useLayoutEffect(() => {
    if (pages.length === 0) return;
    const target = wrap(index, pages.length);
    if (pageKey !== pageKeyRef.current) {
      pageKeyRef.current = pageKey;
      flipRef.current = null;
      setFlip(null);
      setShown(target);
      return;
    }
    const current = wrap(shown, pages.length);
    if (target === current || flipRef.current) return;
    if (reducedMotion) {
      setShown(target);
      return;
    }
    const nextFlip: FlipState = { from: current, to: target, dir: direction };
    flipStartedAt.current = performance.now();
    flipRef.current = nextFlip;
    setFlip(nextFlip);
  }, [direction, index, pageKey, pages.length, reducedMotion, shown]);

  const finish = () => {
    const active = flipRef.current;
    if (!active) return;
    if (performance.now() - flipStartedAt.current < FLIP_MS * 0.75) return;
    flipRef.current = null;
    setFlip(null);
    setShown(active.to);
  };

  useEffect(() => {
    if (!flip) return;
    const timer = window.setTimeout(finish, FLIP_MS + 80);
    return () => window.clearTimeout(timer);
  }, [flip]);

  if (pages.length === 0) return null;

  const length = pages.length;
  const turning = flip != null;
  const resting = wrap(shown, length);
  const leftIndex = flip
    ? flip.dir === 1
      ? flip.from - 1
      : flip.to - 1
    : resting - 1;
  const rightIndex = flip ? (flip.dir === 1 ? flip.to : flip.from) : resting;
  const frontIndex = flip ? (flip.dir === 1 ? flip.from : flip.to) : resting;
  const backIndex = flip ? (flip.dir === 1 ? flip.to - 1 : flip.from - 1) : resting - 1;
  const pageAt = (pageIndex: number) => (length === 0 ? null : pages[wrap(pageIndex, length)] ?? null);

  const creaseLeft = {
    background: `linear-gradient(to left, rgba(0,0,0,${SETTINGS.creaseOpacity / 100}), rgba(0,0,0,${SETTINGS.creaseOpacity / 400}), transparent)`,
    boxShadow: "inset -4px 0 10px rgba(0,0,0,0.1)",
  };
  const creaseRight = {
    background: `linear-gradient(to right, rgba(0,0,0,${SETTINGS.creaseOpacity / 100}), rgba(0,0,0,${SETTINGS.creaseOpacity / 400}), transparent)`,
    boxShadow: "inset 4px 0 10px rgba(0,0,0,0.1)",
  };
  const ease = [0.33, 1, 0.68, 1] as const;

  const turn = (side: "prev" | "next") => {
    if (turning || pages.length < 2) return;
    if (side === "prev") onPrev();
    else onNext();
  };

  return (
    <div className="flex h-full w-full items-center justify-center px-3 sm:px-8">
      <div
        className="relative select-none"
        style={{
          width: "min(92vw, 1180px, calc(76dvh * 1.6))",
          aspectRatio: "16 / 10",
          perspective: "2400px",
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          pointerStart.current = event.clientX;
          dragged.current = false;
        }}
        onPointerMove={(event) => {
          if (pointerStart.current == null) return;
          if (Math.abs(event.clientX - pointerStart.current) > 36) dragged.current = true;
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (pointerStart.current == null) return;
          const delta = event.clientX - pointerStart.current;
          pointerStart.current = null;
          if (delta > 36) turn("prev");
          else if (delta < -36) turn("next");
        }}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        <div className="pointer-events-none absolute -bottom-5 left-[10%] right-[10%] h-8 rounded-[100%] bg-black/45 blur-xl" />
        <motion.div
          className="relative h-full w-full rounded-md shadow-[0_28px_70px_-24px_rgba(0,0,0,0.72)]"
          initial={false}
          animate={
            reducedMotion
              ? { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 }
              : { rotateX: 6, rotateY: -4, rotateZ: 0, scale: 1 }
          }
          transition={{ duration: reducedMotion ? 0 : 1.1, ease: "easeOut" }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <button
            type="button"
            aria-label={prevLabel}
            onClick={(event) => {
              event.stopPropagation();
              if (dragged.current) return;
              turn("prev");
            }}
            className="group absolute top-0 left-0 h-full w-1/2 cursor-pointer overflow-hidden rounded-l-md border border-black/10 shadow-[2px_0_15px_rgba(0,0,0,0.2)]"
          >
            <PageFace page={pageAt(leftIndex)} settings={SETTINGS} onImageError={onImageError} />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-12 mix-blend-multiply" style={creaseLeft} />
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <ChevronLeft className="h-5 w-5" />
            </span>
          </button>

          <button
            type="button"
            aria-label={nextLabel}
            onClick={(event) => {
              event.stopPropagation();
              if (dragged.current) return;
              turn("next");
            }}
            className="group absolute top-0 right-0 h-full w-1/2 cursor-pointer overflow-hidden rounded-r-md border border-black/10 shadow-[-2px_0_15px_rgba(0,0,0,0.2)]"
          >
            <PageFace page={pageAt(rightIndex)} settings={SETTINGS} onImageError={onImageError} />
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-12 mix-blend-multiply" style={creaseRight} />
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <ChevronRight className="h-5 w-5" />
            </span>
          </button>

          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-6 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/20 to-transparent" />

          {flip ? (
            <motion.div
              className="absolute top-0 z-30 h-full w-1/2 bg-[#fcfbf9]"
              style={{ left: "50%", transformStyle: "preserve-3d", transformOrigin: "left center" }}
              initial={{ rotateY: flip.dir === 1 ? 0 : -180 }}
              animate={{ rotateY: flip.dir === 1 ? -180 : 0 }}
              transition={{ duration: FLIP_MS / 1000, ease }}
              onAnimationComplete={finish}
            >
              <div
                className="absolute inset-0 overflow-hidden rounded-r-md border border-black/10"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
              >
                <PageFace page={pageAt(frontIndex)} settings={SETTINGS} onImageError={onImageError} />
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-12 mix-blend-multiply" style={creaseRight} />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent to-black"
                  initial={{ opacity: flip.dir === 1 ? 0 : 0.4 }}
                  animate={{ opacity: flip.dir === 1 ? 0.4 : 0 }}
                  transition={{ duration: FLIP_MS / 1000, ease }}
                />
              </div>
              <div
                className="absolute inset-0 overflow-hidden rounded-l-md border border-black/10"
                style={{
                  transform: "rotateY(180deg)",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
              >
                <PageFace page={pageAt(backIndex)} settings={SETTINGS} onImageError={onImageError} />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-12 mix-blend-multiply" style={creaseLeft} />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-l from-transparent to-black"
                  initial={{ opacity: flip.dir === 1 ? 0.4 : 0 }}
                  animate={{ opacity: flip.dir === 1 ? 0 : 0.4 }}
                  transition={{ duration: FLIP_MS / 1000, ease }}
                />
              </div>
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
