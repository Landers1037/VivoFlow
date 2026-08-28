import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Models3dRenderer } from "@/components/models3d/Models3dRenderer";
import { SettingsGroup, SettingsSegmented, SettingsSwitchRow } from "@/components/settings/SettingsList";
import {
  DEFAULT_MODEL3D_TREE_BASE_COLOR,
  DEFAULT_MODEL3D_TREE_CANOPY_COLOR,
  DEFAULT_MODEL3D_TREE_TRUNK_COLOR,
  normalizeHexColor,
  useAppearance,
} from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { Model3dId } from "@/types";

const MODEL_CARDS: {
  id: Model3dId;
  titleKey: "models3dSolarSystem" | "models3dTree";
  placeholder: string;
}[] = [
  {
    id: "solar_system",
    titleKey: "models3dSolarSystem",
    placeholder:
      "bg-[radial-gradient(circle_at_30%_40%,#3b2a12,transparent_42%),radial-gradient(circle_at_70%_55%,#1e3a5f,transparent_38%),#02040a]",
  },
  {
    id: "tree",
    titleKey: "models3dTree",
    placeholder:
      "bg-[radial-gradient(circle_at_50%_42%,#e07a28,transparent_34%),radial-gradient(circle_at_48%_78%,#8f98a3,transparent_36%),#efe8d8]",
  },
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
    setModel3dTreeCanopyShape,
    setModel3dTreeCanopyColor,
    setModel3dTreeBaseShape,
    setModel3dTreeBaseColor,
    setModel3dTreeTrunkColor,
  } = useAppearance();
  const selected = config.model3d_id;
  const [canopyDraft, setCanopyDraft] = useState(config.model3d_tree_canopy_color);
  const [baseDraft, setBaseDraft] = useState(config.model3d_tree_base_color);
  const [trunkDraft, setTrunkDraft] = useState(config.model3d_tree_trunk_color);

  useEffect(() => {
    setCanopyDraft(config.model3d_tree_canopy_color);
    setBaseDraft(config.model3d_tree_base_color);
    setTrunkDraft(config.model3d_tree_trunk_color);
  }, [
    config.model3d_tree_canopy_color,
    config.model3d_tree_base_color,
    config.model3d_tree_trunk_color,
  ]);

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
                    <div className={cn("h-full w-full", card.placeholder)} />
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
        {selected === "solar_system" ? (
          <p className="settings-group-footer">{t("models3dCredit")}</p>
        ) : (
          <p className="settings-group-footer">{t("models3dTreeHint")}</p>
        )}
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

      {selected === "tree" ? (
        <>
          <SettingsGroup label={t("models3dTreeCanopy")} footer={t("models3dTreeCanopyHint")}>
            <div className="settings-row settings-row-flush">
              <SettingsSegmented
                value={config.model3d_tree_canopy_shape}
                disabled={!synced}
                onChange={setModel3dTreeCanopyShape}
                options={[
                  { id: "round", label: t("models3dTreeCanopyRound") },
                  { id: "cone", label: t("models3dTreeCanopyCone") },
                  { id: "layered", label: t("models3dTreeCanopyLayered") },
                ]}
              />
            </div>
            <div className="px-3 pb-3">
              <ColorField
                id="tree-canopy-color"
                label={t("models3dTreeCanopyColor")}
                value={canopyDraft}
                fallback={DEFAULT_MODEL3D_TREE_CANOPY_COLOR}
                disabled={!synced}
                onChange={(value) => {
                  setCanopyDraft(value);
                  if (/^#[0-9a-fA-F]{6}$/.test(value)) setModel3dTreeCanopyColor(value);
                }}
                onBlur={() => setModel3dTreeCanopyColor(canopyDraft)}
              />
            </div>
          </SettingsGroup>
          <SettingsGroup label={t("models3dTreeBase")} footer={t("models3dTreeBaseHint")}>
            <div className="settings-row settings-row-flush">
              <SettingsSegmented
                value={config.model3d_tree_base_shape}
                disabled={!synced}
                onChange={setModel3dTreeBaseShape}
                options={[
                  { id: "square", label: t("models3dTreeBaseSquare") },
                  { id: "circle", label: t("models3dTreeBaseCircle") },
                  { id: "heart", label: t("models3dTreeBaseHeart") },
                ]}
              />
            </div>
            <div className="px-3 pb-3">
              <ColorField
                id="tree-base-color"
                label={t("models3dTreeBaseColor")}
                value={baseDraft}
                fallback={DEFAULT_MODEL3D_TREE_BASE_COLOR}
                disabled={!synced}
                onChange={(value) => {
                  setBaseDraft(value);
                  if (/^#[0-9a-fA-F]{6}$/.test(value)) setModel3dTreeBaseColor(value);
                }}
                onBlur={() => setModel3dTreeBaseColor(baseDraft)}
              />
            </div>
          </SettingsGroup>
          <SettingsGroup label={t("models3dTreeTrunk")} footer={t("models3dTreeTrunkHint")}>
            <div className="px-3 py-3">
              <ColorField
                id="tree-trunk-color"
                label={t("models3dTreeTrunk")}
                value={trunkDraft}
                fallback={DEFAULT_MODEL3D_TREE_TRUNK_COLOR}
                disabled={!synced}
                onChange={(value) => {
                  setTrunkDraft(value);
                  if (/^#[0-9a-fA-F]{6}$/.test(value)) setModel3dTreeTrunkColor(value);
                }}
                onBlur={() => setModel3dTreeTrunkColor(trunkDraft)}
              />
            </div>
          </SettingsGroup>
        </>
      ) : null}
    </div>
  );
}

const INPUT =
  "min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function ColorField({
  id,
  label,
  value,
  fallback,
  disabled,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  fallback: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type="color"
        value={normalizeHexColor(value, fallback)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background p-1 disabled:cursor-not-allowed"
      />
      <input
        id={`${id}-text`}
        value={value}
        maxLength={7}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-label={label}
        className={INPUT}
      />
    </div>
  );
}
