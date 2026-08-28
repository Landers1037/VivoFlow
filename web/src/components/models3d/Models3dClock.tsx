import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { Model3dClockPosition, Model3dId } from "@/types";

export interface Models3dClockProps {
  modelId: Model3dId;
  position: Model3dClockPosition;
  showDate: boolean;
  showSeconds: boolean;
}

export function Models3dClock({ modelId, position, showDate, showSeconds }: Models3dClockProps) {
  const { config, lang } = useAppearance();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const current = Date.now();
      const interval = showSeconds ? 1000 : 60_000;
      const delay = interval - (current % interval);
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, Math.max(40, delay + 8));
    };

    setNow(new Date());
    schedule();
    return () => window.clearTimeout(timer);
  }, [showSeconds]);

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const date = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const voxel = modelId === "tree" || modelId === "town";
  const night = modelId === "town" && config.model3d_town_time === "night";
  const style = {
    "--models3d-clock-accent": modelId === "tree" ? config.model3d_tree_canopy_color : "#ffd36a",
    "--models3d-clock-base": modelId === "tree" ? config.model3d_tree_base_color : "#234c3b",
  } as CSSProperties;
  const label = `${hours}:${minutes}${showSeconds ? `:${seconds}` : ""}${showDate ? ` · ${date}` : ""}`;

  return (
    <div className={cn("models3d-clock-layer", `is-${position}`)}>
      <div
        className={cn(
          "models3d-clock",
          `is-${modelId}`,
          voxel && "is-voxel",
          night && "is-night",
        )}
        style={style}
        role="timer"
        aria-label={label}
      >
        <div className="models3d-clock-time" aria-hidden="true">
          <span>{hours}</span>
          <span className="models3d-clock-colon">:</span>
          <span>{minutes}</span>
          {showSeconds ? (
            <>
              <span className="models3d-clock-colon">:</span>
              <span>{seconds}</span>
            </>
          ) : null}
        </div>
        {showDate ? <div className="models3d-clock-date" aria-hidden="true">{date}</div> : null}
      </div>
    </div>
  );
}
