import { useState } from "react";
import { Images } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { AlbumImage } from "@/types";
import { cn } from "@/lib/utils";

export function CardLinearSpread({
  images,
  className,
}: {
  images: AlbumImage[];
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const reducedMotion = useReducedMotion();
  const cards = Array.from({ length: 5 }, (_, index) => images[index] ?? null);

  return (
    <div
      tabIndex={0}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className={cn(
        "relative flex h-28 w-24 shrink-0 cursor-pointer items-center justify-center outline-none sm:h-32 sm:w-28",
        className,
      )}
    >
      {cards.map((image, index) => {
        const distance = index - 2;
        return (
          <motion.div
            key={image?.id ?? `empty-${index}`}
            animate={{
              x: active && !reducedMotion ? distance * 13 : 0,
              y: active && !reducedMotion ? Math.abs(distance) * 2 : index * -1.5,
              rotate: active && !reducedMotion ? distance * 1.8 : 0,
              scale: active && index === 0 ? 1.025 : 1,
            }}
            transition={{ type: "spring", stiffness: 210, damping: 24, mass: 0.75 }}
            style={{ zIndex: image ? cards.length - index : -index }}
            className="absolute inset-1 overflow-hidden rounded-xl border border-white/15 bg-zinc-800 shadow-[0_7px_18px_-6px_rgba(0,0,0,.55)]"
          >
            {image ? (
              <img
                src={image.content_url}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,#27272a,#111113)] text-zinc-600">
                {index === 0 && images.length === 0 ? <Images className="h-7 w-7" /> : null}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
