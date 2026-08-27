import { useEffect, useRef, useState } from "react";
import { startBlackholeRenderer } from "@/components/blackhole/blackholeRenderer";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";

export function BlackholeCanvas({
  className,
  unsupportedLabel,
}: {
  className?: string;
  unsupportedLabel: string;
}) {
  const { config } = useAppearance();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unsupported, setUnsupported] = useState(false);
  const paramsRef = useRef({
    color: config.blackhole_color,
    spinSpeed: config.blackhole_spin_speed,
    interactive: config.blackhole_interactive,
  });
  paramsRef.current = {
    color: config.blackhole_color,
    spinSpeed: config.blackhole_spin_speed,
    interactive: config.blackhole_interactive,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    startBlackholeRenderer(canvas, paramsRef)
      .then((stop) => {
        if (cancelled) {
          stop();
          return;
        }
        dispose = stop;
      })
      .catch(() => {
        if (!cancelled) setUnsupported(true);
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div className={cn("blackhole-stage", className)}>
      <canvas
        ref={canvasRef}
        className={cn("blackhole-canvas", config.blackhole_interactive && "is-interactive")}
        aria-hidden={unsupported}
      />
      {unsupported ? <p className="blackhole-fallback">{unsupportedLabel}</p> : null}
    </div>
  );
}
