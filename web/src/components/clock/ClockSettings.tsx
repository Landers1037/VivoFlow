import { Check } from "lucide-react";
import { SettingsGroup, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { CLOCK_DOT_SHAPE_OPTIONS, CLOCK_STYLE_OPTIONS } from "@/components/clock/ClockPage";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { ClockDotShape, ClockStyle } from "@/types";

function ClockStylePreview({ id }: { id: ClockStyle }) {
  const base = "settings-style-preview";
  switch (id) {
    case "dial":
      return (
        <div
          className={base}
          style={{
            borderRadius: "999px",
            background:
              "radial-gradient(circle at 32% 28%, oklch(1 0 0 / 55%), transparent 42%), linear-gradient(145deg, oklch(0.94 0.01 240), oklch(0.78 0.02 240))",
            boxShadow: "inset 0 1px 0 oklch(1 0 0 / 70%), 0 1px 2px oklch(0.4 0.02 240 / 25%)",
          }}
        />
      );
    case "pixel":
      return (
        <div
          className={`${base} grid grid-cols-4 gap-px p-0.5`}
          style={{
            borderRadius: "0.08rem",
            background: "oklch(0.16 0.03 145)",
          }}
        >
          {[1, 0, 1, 1, 0, 1, 0, 1].map((on, index) => (
            <span key={index} style={{ background: on ? "oklch(0.78 0.16 145)" : "oklch(0.22 0.04 145)" }} />
          ))}
        </div>
      );
    case "flip":
      return (
        <div className={`${base} flex items-center justify-center gap-0.5`} style={{ borderRadius: "0.2rem", background: "oklch(0.18 0.01 250)" }}>
          <span className="h-3 w-2.5 rounded-[2px] bg-zinc-700" />
          <span className="h-3 w-2.5 rounded-[2px] bg-zinc-500" />
        </div>
      );
    case "object":
      return (
        <div
          className={`${base} flex items-center justify-center`}
          style={{
            borderRadius: "0.28rem",
            background: "linear-gradient(180deg, oklch(0.42 0.02 80), oklch(0.28 0.02 80))",
            boxShadow: "inset 0 1px 0 oklch(1 0 0 / 18%)",
          }}
        >
          <span className="block h-1.5 w-4 rounded-[1px]" style={{ background: "oklch(0.72 0.14 145)" }} />
        </div>
      );
    case "dots":
      return (
        <div className={`${base} grid grid-cols-4 gap-px p-0.5`} style={{ borderRadius: "0.2rem" }}>
          {[1, 1, 1, 0, 1, 1, 0, 0].map((on, index) => (
            <span
              key={index}
              style={{
                borderRadius: "50%",
                background: on ? "var(--primary)" : "color-mix(in oklch, var(--foreground) 18%, transparent)",
              }}
            />
          ))}
        </div>
      );
    default:
      return (
        <div
          className={`${base} flex items-end px-0.5 pb-0.5 font-[family-name:Outfit,sans-serif] text-[9px] font-extralight leading-none tracking-tight`}
          style={{ borderRadius: "0.12rem" }}
        >
          1735
        </div>
      );
  }
}

function ClockDotShapePreview({ id }: { id: ClockDotShape }) {
  return (
    <span className="settings-dot-shape-preview" data-dot-shape={id} aria-hidden="true">
      <span className="clock-dot is-on" />
    </span>
  );
}

export function ClockSettings() {
  const {
    t,
    config,
    setClockEnabled,
    setClockStyle,
    setClockShowWeek,
    setClockShowDate,
    setClockShowSeconds,
    setClockDotShape,
  } = useAppearance();

  return (
    <div className="settings-clock">
      <SettingsGroup footer={t("clockHint")}>
        <SettingsSwitchRow
          id="clock-enabled"
          title={t("clockBoard")}
          checked={config.clock_enabled}
          onCheckedChange={setClockEnabled}
        />
      </SettingsGroup>

      <SettingsGroup label={t("clockStyle")}>
        <div className="settings-style-grid">
          {CLOCK_STYLE_OPTIONS.map((option) => {
            const selected = config.clock_style === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setClockStyle(option.id)}
                className={cn("settings-style-cell", selected && "is-selected")}
                aria-pressed={selected}
                aria-label={t(option.nameKey)}
              >
                <span className="settings-style-thumb" aria-hidden="true">
                  <ClockStylePreview id={option.id} />
                </span>
                <span className="settings-style-cell-name">{t(option.nameKey)}</span>
                {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} /> : null}
              </button>
            );
          })}
        </div>
      </SettingsGroup>

      {config.clock_style === "dots" ? (
        <SettingsGroup label={t("clockDotShape")}>
          <div className="settings-style-grid">
            {CLOCK_DOT_SHAPE_OPTIONS.map((option) => {
              const selected = config.clock_dot_shape === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setClockDotShape(option.id)}
                  className={cn("settings-style-cell", selected && "is-selected")}
                  aria-pressed={selected}
                  aria-label={t(option.nameKey)}
                >
                  <span className="settings-style-thumb" aria-hidden="true">
                    <ClockDotShapePreview id={option.id} />
                  </span>
                  <span className="settings-style-cell-name">{t(option.nameKey)}</span>
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} /> : null}
                </button>
              );
            })}
          </div>
        </SettingsGroup>
      ) : null}

      <SettingsGroup>
        <SettingsSwitchRow
          id="clock-week"
          title={t("clockShowWeek")}
          checked={config.clock_show_week}
          onCheckedChange={setClockShowWeek}
        />
        <SettingsSwitchRow
          id="clock-date"
          title={t("clockShowDate")}
          checked={config.clock_show_date}
          onCheckedChange={setClockShowDate}
        />
        <SettingsSwitchRow
          id="clock-seconds"
          title={t("clockShowSeconds")}
          checked={config.clock_show_seconds}
          onCheckedChange={setClockShowSeconds}
        />
      </SettingsGroup>
    </div>
  );
}
