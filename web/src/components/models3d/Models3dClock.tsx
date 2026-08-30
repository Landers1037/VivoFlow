import type { CSSProperties } from "react";
import { useAppearance } from "@/hooks/useAppearance";
import { useClockNow } from "@/hooks/useClockNow";
import { formatClockFullDate, getClockParts } from "@/lib/clock";
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
  const now = useClockNow(showSeconds);
  const { h: hours, m: minutes, s: seconds } = getClockParts(now, config.clock_timezone_offset_minutes);
  const date = formatClockFullDate(now, lang, config.clock_timezone_offset_minutes);
  const voxel = modelId === "tree" || modelId === "town" || modelId === "flower";
  const night = modelId === "town" && config.model3d_town_time === "night";
  const style = {
    "--models3d-clock-accent": modelId === "tree"
      ? config.model3d_tree_canopy_color
      : modelId === "flower"
        ? config.model3d_flower_petal_color
        : "#ffd36a",
    "--models3d-clock-base": modelId === "tree"
      ? config.model3d_tree_base_color
      : modelId === "flower"
        ? config.model3d_flower_pot_color
        : "#234c3b",
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
