import { useEffect, useState } from "react";
import { Check, Clock, Copy, Dice5, Heart, Trash2 } from "lucide-react";
import { Models3dRenderer } from "@/components/models3d/Models3dRenderer";
import { SettingsGroup, SettingsSegmented, SettingsSheetBar, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DEFAULT_MODEL3D_TREE_BASE_COLOR,
  DEFAULT_MODEL3D_TREE_CANOPY_COLOR,
  DEFAULT_MODEL3D_TREE_TRUNK_COLOR,
  DEFAULT_MODEL3D_FLOWER_FOLIAGE_COLOR,
  DEFAULT_MODEL3D_FLOWER_PETAL_COLOR,
  DEFAULT_MODEL3D_FLOWER_POT_COLOR,
  normalizeHexColor,
  useAppearance,
} from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { Model3dClockPosition, Model3dFlowerPotShape, Model3dFlowerType, Model3dId, TownFavorite, TownPopulation, TownDensity, TownTime } from "@/types";
import { MODEL3D_FLOWER_TYPES } from "@/types";

const MODEL_CARDS: {
  id: Model3dId;
  titleKey: "models3dSolarSystem" | "models3dTree" | "models3dTown" | "models3dFlower";
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
  {
    id: "town",
    titleKey: "models3dTown",
    placeholder:
      "bg-[radial-gradient(circle_at_54%_42%,#6e9f64,transparent_30%),radial-gradient(circle_at_25%_72%,#d6b76b,transparent_24%),radial-gradient(circle_at_78%_66%,#3a8ca7,transparent_24%),#17313a]",
  },
  {
    id: "flower",
    titleKey: "models3dFlower",
    placeholder:
      "bg-[radial-gradient(circle_at_50%_38%,#d94a64,transparent_26%),radial-gradient(circle_at_50%_72%,#b86f47,transparent_27%),radial-gradient(circle_at_35%_58%,#3f7d4a,transparent_18%),#f3eee4]",
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
    setModel3dFlowerType,
    setModel3dFlowerPetalColor,
    setModel3dFlowerFoliageColor,
    setModel3dFlowerPotShape,
    setModel3dFlowerPotColor,
    randomizeModel3dFlower,
  } = useAppearance();
  const selected = config.model3d_id;
  const [canopyDraft, setCanopyDraft] = useState(config.model3d_tree_canopy_color);
  const [baseDraft, setBaseDraft] = useState(config.model3d_tree_base_color);
  const [trunkDraft, setTrunkDraft] = useState(config.model3d_tree_trunk_color);
  const [flowerPetalDraft, setFlowerPetalDraft] = useState(config.model3d_flower_petal_color);
  const [flowerFoliageDraft, setFlowerFoliageDraft] = useState(config.model3d_flower_foliage_color);
  const [flowerPotDraft, setFlowerPotDraft] = useState(config.model3d_flower_pot_color);

  useEffect(() => {
    setCanopyDraft(config.model3d_tree_canopy_color);
    setBaseDraft(config.model3d_tree_base_color);
    setTrunkDraft(config.model3d_tree_trunk_color);
    setFlowerPetalDraft(config.model3d_flower_petal_color);
    setFlowerFoliageDraft(config.model3d_flower_foliage_color);
    setFlowerPotDraft(config.model3d_flower_pot_color);
  }, [
    config.model3d_tree_canopy_color,
    config.model3d_tree_base_color,
    config.model3d_tree_trunk_color,
    config.model3d_flower_petal_color,
    config.model3d_flower_foliage_color,
    config.model3d_flower_pot_color,
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
        ) : selected === "town" ? (
          <p className="settings-group-footer">{t("models3dTownHint")}</p>
        ) : selected === "flower" ? (
          <p className="settings-group-footer">{t("models3dFlowerHint")}</p>
        ) : (
          <p className="settings-group-footer">{t("models3dTreeHint")}</p>
        )}
      </section>

      <Models3dClockSettings />
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

      {selected === "flower" ? (
        <FlowerSettings
          flowerPetalDraft={flowerPetalDraft}
          flowerFoliageDraft={flowerFoliageDraft}
          flowerPotDraft={flowerPotDraft}
          setFlowerPetalDraft={setFlowerPetalDraft}
          setFlowerFoliageDraft={setFlowerFoliageDraft}
          setFlowerPotDraft={setFlowerPotDraft}
          setModel3dFlowerType={setModel3dFlowerType}
          setModel3dFlowerPetalColor={setModel3dFlowerPetalColor}
          setModel3dFlowerFoliageColor={setModel3dFlowerFoliageColor}
          setModel3dFlowerPotShape={setModel3dFlowerPotShape}
          setModel3dFlowerPotColor={setModel3dFlowerPotColor}
          randomizeModel3dFlower={randomizeModel3dFlower}
          config={config}
          synced={synced}
          t={t}
        />
      ) : null}

      {selected === "town" ? <TownSettings /> : null}
    </div>
  );
}

const MODEL3D_CLOCK_POSITION_OPTIONS: {
  id: Model3dClockPosition;
  labelKey:
    | "models3dClockTopLeft"
    | "models3dClockTopCenter"
    | "models3dClockTopRight"
    | "models3dClockBottomLeft"
    | "models3dClockBottomCenter"
    | "models3dClockBottomRight";
}[] = [
  { id: "top_left", labelKey: "models3dClockTopLeft" },
  { id: "top_center", labelKey: "models3dClockTopCenter" },
  { id: "top_right", labelKey: "models3dClockTopRight" },
  { id: "bottom_left", labelKey: "models3dClockBottomLeft" },
  { id: "bottom_center", labelKey: "models3dClockBottomCenter" },
  { id: "bottom_right", labelKey: "models3dClockBottomRight" },
];

function Models3dClockSettings() {
  const {
    t,
    config,
    synced,
    setModel3dClockEnabled,
    setModel3dClockPosition,
    setModel3dClockShowDate,
    setModel3dClockShowSeconds,
  } = useAppearance();

  return (
    <>
      <SettingsGroup label={t("models3dClock")} footer={t("models3dClockHint")}>
        <SettingsSwitchRow
          id="model3d-clock-enabled"
          icon={Clock}
          title={t("models3dClockEnabled")}
          subtitle={t("models3dClockEnabledHint")}
          checked={config.model3d_clock_enabled}
          disabled={!synced}
          onCheckedChange={setModel3dClockEnabled}
        />
      </SettingsGroup>

      <SettingsGroup label={t("models3dClockPosition")} footer={t("models3dClockPositionHint")}>
        <div
          className="settings-model3d-clock-position-grid"
          role="radiogroup"
          aria-label={t("models3dClockPosition")}
        >
          {MODEL3D_CLOCK_POSITION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={config.model3d_clock_position === option.id}
              disabled={!synced}
              className={cn(
                "settings-model3d-clock-position-item",
                config.model3d_clock_position === option.id && "is-active",
              )}
              onClick={() => setModel3dClockPosition(option.id)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsSwitchRow
          id="model3d-clock-date"
          title={t("models3dClockShowDate")}
          checked={config.model3d_clock_show_date}
          disabled={!synced}
          onCheckedChange={setModel3dClockShowDate}
        />
        <SettingsSwitchRow
          id="model3d-clock-seconds"
          title={t("models3dClockShowSeconds")}
          checked={config.model3d_clock_show_seconds}
          disabled={!synced}
          onCheckedChange={setModel3dClockShowSeconds}
        />
      </SettingsGroup>
    </>
  );
}

const FLOWER_TYPE_LABEL_KEYS: Record<
  Model3dFlowerType,
  | "models3dFlowerRose"
  | "models3dFlowerTulip"
  | "models3dFlowerSunflower"
  | "models3dFlowerDaisy"
  | "models3dFlowerLily"
  | "models3dFlowerOrchid"
  | "models3dFlowerCarnation"
  | "models3dFlowerPeony"
  | "models3dFlowerLavender"
  | "models3dFlowerHydrangea"
> = {
  rose: "models3dFlowerRose",
  tulip: "models3dFlowerTulip",
  sunflower: "models3dFlowerSunflower",
  daisy: "models3dFlowerDaisy",
  lily: "models3dFlowerLily",
  orchid: "models3dFlowerOrchid",
  carnation: "models3dFlowerCarnation",
  peony: "models3dFlowerPeony",
  lavender: "models3dFlowerLavender",
  hydrangea: "models3dFlowerHydrangea",
};

function FlowerSettings({
  config,
  synced,
  t,
  flowerPetalDraft,
  flowerFoliageDraft,
  flowerPotDraft,
  setFlowerPetalDraft,
  setFlowerFoliageDraft,
  setFlowerPotDraft,
  setModel3dFlowerType,
  setModel3dFlowerPetalColor,
  setModel3dFlowerFoliageColor,
  setModel3dFlowerPotShape,
  setModel3dFlowerPotColor,
  randomizeModel3dFlower,
}: {
  config: ReturnType<typeof useAppearance>["config"];
  synced: boolean;
  t: ReturnType<typeof useAppearance>["t"];
  flowerPetalDraft: string;
  flowerFoliageDraft: string;
  flowerPotDraft: string;
  setFlowerPetalDraft: (value: string) => void;
  setFlowerFoliageDraft: (value: string) => void;
  setFlowerPotDraft: (value: string) => void;
  setModel3dFlowerType: (value: Model3dFlowerType) => void;
  setModel3dFlowerPetalColor: (value: string) => void;
  setModel3dFlowerFoliageColor: (value: string) => void;
  setModel3dFlowerPotShape: (value: Model3dFlowerPotShape) => void;
  setModel3dFlowerPotColor: (value: string) => void;
  randomizeModel3dFlower: () => void;
}) {
  return (
    <>
      <SettingsGroup label={t("models3dFlowerType")} footer={t("models3dFlowerTypeHint")}>
        <div className="settings-flower-actions">
          <span className="settings-row-subtitle">{t("models3dFlowerRandomHint")}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!synced}
            onClick={randomizeModel3dFlower}
            aria-label={t("models3dFlowerRandomize")}
          >
            <Dice5 className="h-4 w-4" />
            {t("models3dFlowerRandomize")}
          </Button>
        </div>
        <div
          className="settings-flower-type-grid"
          role="radiogroup"
          aria-label={t("models3dFlowerType")}
        >
          {MODEL3D_FLOWER_TYPES.map((flowerType) => (
            <button
              key={flowerType}
              type="button"
              role="radio"
              aria-checked={config.model3d_flower_type === flowerType}
              disabled={!synced}
              className={cn(
                "settings-flower-type-item",
                config.model3d_flower_type === flowerType && "is-active",
              )}
              onClick={() => setModel3dFlowerType(flowerType)}
            >
              {t(FLOWER_TYPE_LABEL_KEYS[flowerType])}
            </button>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup label={t("models3dFlowerPot")} footer={t("models3dFlowerPotHint")}>
        <div className="settings-row settings-row-flush">
          <SettingsSegmented<Model3dFlowerPotShape>
            value={config.model3d_flower_pot_shape}
            disabled={!synced}
            onChange={setModel3dFlowerPotShape}
            options={[
              { id: "round", label: t("models3dFlowerPotRound") },
              { id: "square", label: t("models3dFlowerPotSquare") },
              { id: "pedestal", label: t("models3dFlowerPotPedestal") },
            ]}
          />
        </div>
        <div className="px-3 pb-3">
          <ColorField
            id="flower-pot-color"
            label={t("models3dFlowerPotColor")}
            value={flowerPotDraft}
            fallback={DEFAULT_MODEL3D_FLOWER_POT_COLOR}
            disabled={!synced}
            onChange={(value) => {
              setFlowerPotDraft(value);
              if (/^#[0-9a-fA-F]{6}$/.test(value)) setModel3dFlowerPotColor(value);
            }}
            onBlur={() => setModel3dFlowerPotColor(flowerPotDraft)}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup label={t("models3dFlowerColors")} footer={t("models3dFlowerColorsHint")}>
        <div className="px-3 pt-3">
          <ColorField
            id="flower-petal-color"
            label={t("models3dFlowerPetalColor")}
            value={flowerPetalDraft}
            fallback={DEFAULT_MODEL3D_FLOWER_PETAL_COLOR}
            disabled={!synced}
            onChange={(value) => {
              setFlowerPetalDraft(value);
              if (/^#[0-9a-fA-F]{6}$/.test(value)) setModel3dFlowerPetalColor(value);
            }}
            onBlur={() => setModel3dFlowerPetalColor(flowerPetalDraft)}
          />
        </div>
        <div className="px-3 py-3">
          <ColorField
            id="flower-foliage-color"
            label={t("models3dFlowerFoliageColor")}
            value={flowerFoliageDraft}
            fallback={DEFAULT_MODEL3D_FLOWER_FOLIAGE_COLOR}
            disabled={!synced}
            onChange={(value) => {
              setFlowerFoliageDraft(value);
              if (/^#[0-9a-fA-F]{6}$/.test(value)) setModel3dFlowerFoliageColor(value);
            }}
            onBlur={() => setModel3dFlowerFoliageColor(flowerFoliageDraft)}
          />
        </div>
      </SettingsGroup>
    </>
  );
}

function TownSettings() {
  const {
    t,
    config,
    synced,
    randomizeModel3dTown,
    setModel3dTownPopulation,
    setModel3dTownDensity,
    setModel3dTownTime,
    saveModel3dTownFavorite,
    loadModel3dTownFavorite,
    removeModel3dTownFavorite,
  } = useAppearance();
  const [favoriteOpen, setFavoriteOpen] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(config.model3d_town_seed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  };

  const saveFavorite = () => {
    const name = favoriteName.trim();
    if (!name) {
      setFavoriteError(t("models3dTownFavoriteNameRequired"));
      return;
    }
    if (config.model3d_town_favorites.some((favorite) => favorite.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setFavoriteError(t("models3dTownFavoriteDuplicate"));
      return;
    }
    if (config.model3d_town_favorites.length >= 50) {
      setFavoriteError(t("models3dTownFavoriteLimit"));
      return;
    }
    saveModel3dTownFavorite(name);
    setFavoriteOpen(false);
    setFavoriteName("");
    setFavoriteError(null);
  };

  return (
    <>
      <SettingsGroup label={t("models3dTownCurrent")} footer={t("models3dTownCurrentHint")}>
        <div className="settings-town-seed-row">
          <div className="settings-town-seed-copy">
            <span className="settings-row-title">{t("models3dTownSeed")}</span>
            <code className="settings-town-seed">{config.model3d_town_seed}</code>
          </div>
          <div className="settings-town-actions">
            <Button type="button" variant="ghost" size="icon" disabled={!synced} onClick={() => void copySeed()} aria-label={t("models3dTownCopySeed")} title={copied ? t("models3dTownCopied") : t("models3dTownCopySeed")}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!synced} onClick={randomizeModel3dTown}>
              <Dice5 className="h-4 w-4" />
              {t("models3dTownRandomize")}
            </Button>
          </div>
        </div>
        <button type="button" className="settings-row" disabled={!synced || config.model3d_town_favorites.length >= 50} onClick={() => { setFavoriteOpen(true); setFavoriteError(null); }}>
          <span className="settings-row-icon"><Heart className="h-4 w-4" /></span>
          <span className="settings-row-copy"><span className="settings-row-title">{t("models3dTownFavorite")}</span><span className="settings-row-subtitle">{t("models3dTownFavoriteHint")}</span></span>
          <span className="settings-row-value">{config.model3d_town_favorites.length}/50</span>
        </button>
      </SettingsGroup>

      <SettingsGroup label={t("models3dTownPopulation")} footer={t("models3dTownPopulationHint")}>
        <div className="settings-row settings-row-flush">
          <SettingsSegmented<TownPopulation>
            value={config.model3d_town_population}
            disabled={!synced}
            onChange={setModel3dTownPopulation}
            options={[
              { id: "low", label: t("models3dTownLow") },
              { id: "medium", label: t("models3dTownMedium") },
              { id: "high", label: t("models3dTownHigh") },
            ]}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup label={t("models3dTownDensity")} footer={t("models3dTownDensityHint")}>
        <div className="settings-row settings-row-flush">
          <SettingsSegmented<TownDensity>
            value={config.model3d_town_density}
            disabled={!synced}
            onChange={setModel3dTownDensity}
            options={[
              { id: "low", label: t("models3dTownSparse") },
              { id: "medium", label: t("models3dTownMedium") },
              { id: "high", label: t("models3dTownDense") },
            ]}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup label={t("models3dTownTime")} footer={t("models3dTownTimeHint")}>
        <div className="settings-row settings-row-flush">
          <SettingsSegmented<TownTime>
            value={config.model3d_town_time}
            disabled={!synced}
            onChange={setModel3dTownTime}
            options={[
              { id: "day", label: t("models3dTownDay") },
              { id: "night", label: t("models3dTownNight") },
            ]}
          />
        </div>
      </SettingsGroup>

      {config.model3d_town_favorites.length > 0 ? (
        <SettingsGroup label={t("models3dTownFavorites")} footer={t("models3dTownFavoritesHint")}>
          {config.model3d_town_favorites.map((favorite) => (
            <TownFavoriteRow key={favorite.id} favorite={favorite} onLoad={() => loadModel3dTownFavorite(favorite)} onRemove={() => { if (window.confirm(t("models3dTownFavoriteDeleteConfirm"))) removeModel3dTownFavorite(favorite.id); }} />
          ))}
        </SettingsGroup>
      ) : null}

      <Dialog open={favoriteOpen} onOpenChange={(open) => { setFavoriteOpen(open); if (!open) setFavoriteName(""); }}>
        <DialogContent>
          <SettingsSheetBar
            title={<DialogTitle>{t("models3dTownFavorite")}</DialogTitle>}
            cancelLabel={t("settingsCancel")}
            doneLabel={t("settingsDone")}
            doneDisabled={!favoriteName.trim()}
            onCancel={() => setFavoriteOpen(false)}
            onDone={saveFavorite}
          />
          <div className="settings-sheet-body">
            <SettingsGroup footer={t("models3dTownFavoriteDialogHint")}>
              <label className="settings-row">
                <span className="settings-row-title">{t("models3dTownFavoriteName")}</span>
                <input
                  id="town-favorite-name"
                  autoFocus
                  autoComplete="off"
                  maxLength={40}
                  value={favoriteName}
                  onChange={(event) => { setFavoriteName(event.target.value); setFavoriteError(null); }}
                  onKeyDown={(event) => { if (event.key === "Enter") saveFavorite(); }}
                  className="settings-field-input"
                />
              </label>
              {favoriteError ? <p className="settings-group-footer text-destructive">{favoriteError}</p> : null}
            </SettingsGroup>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TownFavoriteRow({ favorite, onLoad, onRemove }: { favorite: TownFavorite; onLoad: () => void; onRemove: () => void }) {
  const { t } = useAppearance();
  return (
    <article className="settings-list-card">
      <span className="settings-row-icon"><Heart className="h-4 w-4" /></span>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onLoad}>
        <span className="block truncate font-medium">{favorite.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{favorite.seed} · {t(`models3dTown${capitalize(favorite.population)}` as "models3dTownLow" | "models3dTownMedium" | "models3dTownHigh")}</span>
      </button>
      <Button type="button" variant="ghost" size="icon" aria-label={t("models3dTownFavoriteDelete")} onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </article>
  );
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
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
