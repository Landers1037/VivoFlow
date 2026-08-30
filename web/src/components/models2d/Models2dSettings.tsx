import { Check } from "lucide-react";
import { SettingsGroup, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { Model2dId } from "@/types";

const SCENES: {
  id: Model2dId;
  titleKey: "models2dVillage" | "models2dCyberCity" | "models2dGarden" | "models2dRainRoom";
  hintKey: "models2dVillageHint" | "models2dCyberCityHint" | "models2dGardenHint" | "models2dRainRoomHint";
  image: string;
}[] = [
  { id: "village", titleKey: "models2dVillage", hintKey: "models2dVillageHint", image: "/models2d/village-portrait.png" },
  { id: "cyber_city", titleKey: "models2dCyberCity", hintKey: "models2dCyberCityHint", image: "/models2d/cyber-city-portrait.png" },
  { id: "garden", titleKey: "models2dGarden", hintKey: "models2dGardenHint", image: "/models2d/garden-portrait.png" },
  { id: "rain_room", titleKey: "models2dRainRoom", hintKey: "models2dRainRoomHint", image: "/models2d/rain-room-portrait.png" },
];

export function Models2dSettings() {
  const { t, config, synced, setModel2dEnabled, setModel2dId } = useAppearance();

  return (
    <div className="settings-module settings-model2d">
      <SettingsGroup footer={t("models2dHint")}>
        <SettingsSwitchRow
          id="model2d-enabled"
          title={t("models2dBoard")}
          checked={config.model2d_enabled}
          disabled={!synced}
          onCheckedChange={setModel2dEnabled}
        />
      </SettingsGroup>

      <section className="settings-group">
        <h2 className="settings-group-label">{t("models2dPick")}</h2>
        <p className="settings-group-footer mb-2 !mt-0">{t("models2dPickHint")}</p>
        <div className="settings-model2d-grid">
          {SCENES.map((scene) => {
            const active = config.model2d_id === scene.id;
            return (
              <button
                key={scene.id}
                type="button"
                disabled={!synced}
                className={cn("settings-model2d-card", active && "is-active")}
                aria-pressed={active}
                onClick={() => setModel2dId(scene.id)}
              >
                <img src={scene.image} alt="" className="settings-model2d-art" />
                <span className="settings-model2d-copy">
                  <span className="settings-model2d-title-row">
                    <span>{t(scene.titleKey)}</span>
                    <span className="settings-model2d-check" aria-hidden={!active}>
                      {active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                    </span>
                  </span>
                  <span className="settings-model2d-hint">{t(scene.hintKey)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
