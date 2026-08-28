import { Check } from "lucide-react";
import { Models3dRenderer } from "@/components/models3d/Models3dRenderer";
import { SettingsGroup, SettingsSegmented, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { Model3dId } from "@/types";

const MODEL_CARDS: { id: Model3dId; titleKey: "models3dSolarSystem" }[] = [
  { id: "solar_system", titleKey: "models3dSolarSystem" },
];

export function Models3dSettings() {
  const {
    t,
    config,
    synced,
    setModel3dEnabled,
    setModel3dId,
    setModel3dOrbitStyle,
    setModel3dTexturesEnabled,
  } = useAppearance();
  const selected = config.model3d_id;

  return (
    <div className="settings-module space-y-1">
      <SettingsGroup footer={t("models3dHint")}>
        <SettingsSwitchRow
          id="model3d-enabled"
          title={t("models3dBoard")}
          checked={config.model3d_enabled}
          disabled={!synced}
          onCheckedChange={setModel3dEnabled}
        />
      </SettingsGroup>

      <section className="settings-group">
        <h2 className="settings-group-label">{t("models3dPick")}</h2>
        <p className="settings-group-footer mb-2 !mt-0">{t("models3dPickHint")}</p>
        <div className="settings-mode-grid">
          {MODEL_CARDS.map((card) => {
            const active = selected === card.id;
            return (
              <button
                key={card.id}
                type="button"
                disabled={!synced}
                onClick={() => setModel3dId(card.id)}
                className={cn(
                  "overflow-hidden border text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-primary bg-primary/8" : "border-border bg-card",
                )}
                style={{ borderRadius: "0.9rem" }}
                aria-pressed={active}
              >
                <div className="h-44 bg-black">
                  {active ? (
                    <Models3dRenderer preview modelId={card.id} className="h-full w-full pointer-events-none" />
                  ) : (
                    <div className="h-full w-full bg-[radial-gradient(circle_at_30%_40%,#3b2a12,transparent_42%),radial-gradient(circle_at_70%_55%,#1e3a5f,transparent_38%),#02040a]" />
                  )}
                </div>
                <div className="flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium">
                  <span>{t(card.titleKey)}</span>
                  {active ? <Check className="h-4 w-4 text-primary" /> : null}
                </div>
              </button>
            );
          })}
        </div>
        <p className="settings-group-footer">{t("models3dCredit")}</p>
      </section>

      {selected === "solar_system" ? (
        <>
          <SettingsGroup label={t("models3dOrbit")} footer={t("models3dOrbitHint")}>
            <div className="settings-row settings-row-flush">
              <SettingsSegmented
                value={config.model3d_orbit_style}
                disabled={!synced}
                onChange={setModel3dOrbitStyle}
                options={[
                  { id: "solid", label: t("models3dOrbitSolid") },
                  { id: "dashed", label: t("models3dOrbitDashed") },
                  { id: "hidden", label: t("models3dOrbitHidden") },
                ]}
              />
            </div>
          </SettingsGroup>
          <SettingsGroup footer={t("models3dTexturesHint")}>
            <SettingsSwitchRow
              id="model3d-textures"
              title={t("models3dTextures")}
              checked={config.model3d_textures_enabled}
              disabled={!synced}
              onCheckedChange={setModel3dTexturesEnabled}
            />
          </SettingsGroup>
        </>
      ) : null}
    </div>
  );
}
