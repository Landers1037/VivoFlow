import { useEffect, useState } from "react";
import { SettingsGroup, SettingsSliderRow, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { DEFAULT_BLACKHOLE_COLOR, normalizeHexColor, useAppearance } from "@/hooks/useAppearance";

const INPUT =
  "min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BlackholeSettings() {
  const {
    t,
    config,
    setBlackholeEnabled,
    setBlackholeColor,
    setBlackholeInteractive,
    setBlackholeSpinSpeed,
  } = useAppearance();
  const [colorDraft, setColorDraft] = useState(config.blackhole_color);

  useEffect(() => {
    setColorDraft(config.blackhole_color);
  }, [config.blackhole_color]);

  const commitColor = (value = colorDraft) => {
    setBlackholeColor(normalizeHexColor(value, DEFAULT_BLACKHOLE_COLOR));
  };

  return (
    <div className="settings-blackhole">
      <SettingsGroup footer={t("blackholeHint")}>
        <SettingsSwitchRow
          id="blackhole-enabled"
          title={t("blackholeBoard")}
          checked={config.blackhole_enabled}
          onCheckedChange={setBlackholeEnabled}
        />
      </SettingsGroup>

      <SettingsGroup label={t("blackholeColor")} footer={t("blackholeColorHint")}>
        <div className="space-y-3 px-3 py-3">
          <ColorField
            id="blackhole-color"
            label={t("blackholeColor")}
            value={colorDraft}
            onChange={(value) => {
              setColorDraft(value);
              if (/^#[0-9a-fA-F]{6}$/.test(value)) setBlackholeColor(value);
            }}
            onBlur={() => commitColor()}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup footer={t("blackholeInteractiveHint")}>
        <SettingsSwitchRow
          id="blackhole-interactive"
          title={t("blackholeInteractive")}
          checked={config.blackhole_interactive}
          onCheckedChange={setBlackholeInteractive}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsSliderRow
          id="blackhole-spin-speed"
          title={t("blackholeSpinSpeed")}
          valueLabel={`${Math.round(config.blackhole_spin_speed * 100)}%`}
          min={0}
          max={3}
          step={0.05}
          value={config.blackhole_spin_speed}
          onChange={setBlackholeSpinSpeed}
        />
      </SettingsGroup>
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type="color"
        value={normalizeHexColor(value, DEFAULT_BLACKHOLE_COLOR)}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background p-1"
      />
      <input
        id={`${id}-text`}
        value={value}
        maxLength={7}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-label={label}
        className={INPUT}
      />
    </div>
  );
}
