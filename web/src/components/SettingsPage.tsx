import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronLeft, AudioLines, Clock, Images, Info, Music2, Palette, Radio } from "lucide-react";
import { ClockSettings } from "@/components/clock/ClockSettings";
import { AlbumSettings } from "@/components/albums/AlbumSettings";
import { MusicAlbumSettings } from "@/components/music/MusicAlbumSettings";
import { AudioSettings } from "@/components/audio/AudioSettings";
import {
  SettingsGroup,
  SettingsRow,
  SettingsSegmented,
  SettingsSliderRow,
  SettingsSwitchRow,
} from "@/components/settings/SettingsList";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ACCENT_OPTIONS,
  BACKGROUND_OPTIONS,
  GLASS_GRADIENT_OPTIONS,
  UI_STYLE_OPTIONS,
  useAppearance,
  type AccentId,
  type TFunction,
} from "@/hooks/useAppearance";
import type { AppConfig, AudioFrame, AudioStatus, Lang, ThemeMode, UiStyle } from "@/types";
import { DEFAULT_CONFIG } from "@/types";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

export type SettingsPane = "index" | "appearance" | "clock" | "collection" | "albums" | "music" | "audio" | "about";

export function SettingsPage({
  config,
  onSave,
  onBack,
  audioFrame,
  audioStatus,
  onAudioSubscribe,
  resetNonce = 0,
}: {
  config: AppConfig | null;
  onSave: (cfg: AppConfig) => void;
  onBack: () => void;
  audioFrame: AudioFrame | null;
  audioStatus: AudioStatus | null;
  onAudioSubscribe: (enabled: boolean) => void;
  resetNonce?: number;
}) {
  const {
    t,
    config: synced,
    setAccent,
    setAccentCustom,
    setBackgroundColor,
    setGlassGradient,
    setLanguage,
    setUiStyle,
    setThemeMode,
    setHideTitleBar,
    setMobileCardMode,
    setMobileAutoCarousel,
    setMobileCarouselInterval,
  } = useAppearance();
  const reduceMotion = useReducedMotion();
  const [pane, setPane] = useState<SettingsPane>("index");
  const [savedFlash, setSavedFlash] = useState(false);
  const [local, setLocal] = useState<AppConfig>(config ?? DEFAULT_CONFIG);

  useEffect(() => {
    if (config) setLocal(config);
  }, [config]);

  useEffect(() => {
    setPane("index");
  }, [resetNonce]);

  const styleName = t(
    UI_STYLE_OPTIONS.find((option) => option.id === synced.ui_style)?.nameKey ?? "styleAmicro",
  );

  const open = (next: Exclude<SettingsPane, "index">) => setPane(next);
  const closePane = () => setPane("index");

  return (
    <div className={cn("settings-page", pane !== "index" && "is-drilled")}>
      <div className="settings-index" aria-hidden={pane !== "index"} inert={pane !== "index" || undefined}>
        <header className="settings-index-header">
          <div className="settings-index-tools">
            <button type="button" className="settings-back-link" aria-label={t("back")} onClick={onBack}>
              <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </button>
            <span
              className={cn("settings-live-dot", config ? "is-live" : "is-waiting")}
              title={config ? t("connected") : t("connecting")}
            />
          </div>
          <h1 className="settings-large-title">{t("settings")}</h1>
        </header>

        <SettingsGroup label={t("settingsGroupDisplay")}>
          <SettingsRow
            icon={Palette}
            title={t("appearance")}
            value={styleName}
            chevron
            onClick={() => open("appearance")}
          />
          <SettingsRow
            icon={Clock}
            title={t("clock")}
            value={synced.clock_enabled ? t("settingsOn") : t("settingsOff")}
            chevron
            onClick={() => open("clock")}
          />
        </SettingsGroup>

        <SettingsGroup label={t("settingsGroupData")}>
          <SettingsRow
            icon={Radio}
            title={t("collection")}
            chevron
            onClick={() => open("collection")}
          />
        </SettingsGroup>

        <SettingsGroup label={t("settingsGroupMedia")}>
          <SettingsRow
            icon={Images}
            title={t("albums")}
            value={synced.photo_album_enabled ? t("settingsOn") : t("settingsOff")}
            chevron
            onClick={() => open("albums")}
          />
          <SettingsRow
            icon={Music2}
            title={t("musicAlbums")}
            value={synced.music_album_enabled ? t("settingsOn") : t("settingsOff")}
            chevron
            onClick={() => open("music")}
          />
          <SettingsRow
            icon={AudioLines}
            title={t("audioVisualizer")}
            value={synced.audio_visualizer_enabled ? t("settingsOn") : t("settingsOff")}
            chevron
            onClick={() => open("audio")}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            icon={Info}
            title={t("about")}
            value={APP_VERSION}
            chevron
            onClick={() => open("about")}
          />
        </SettingsGroup>
      </div>

      <AnimatePresence>
        {pane !== "index" ? (
          <motion.section
            key={pane}
            className="settings-detail"
            initial={reduceMotion ? { opacity: 1 } : { x: "100%" }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.85 }}
            aria-label={paneLabel(t, pane)}
          >
            <header className="settings-detail-bar">
              <button type="button" className="settings-back-link" onClick={closePane}>
                <ChevronLeft className="h-6 w-6" strokeWidth={2} />
                <span>{t("settings")}</span>
              </button>
              <h1 className="settings-detail-title">{paneLabel(t, pane)}</h1>
            </header>

            <div className={cn("settings-detail-body", pane === "collection" && "has-apply-bar")}>
              {pane === "appearance" ? (
                <AppearanceTab
                  t={t}
                  config={synced}
                  setAccent={setAccent}
                  setAccentCustom={setAccentCustom}
                  setBackgroundColor={setBackgroundColor}
                  setGlassGradient={setGlassGradient}
                  setLanguage={setLanguage}
                  setUiStyle={setUiStyle}
                  setThemeMode={setThemeMode}
                  setHideTitleBar={setHideTitleBar}
                  setMobileCardMode={setMobileCardMode}
                  setMobileAutoCarousel={setMobileAutoCarousel}
                  setMobileCarouselInterval={setMobileCarouselInterval}
                />
              ) : null}

              {pane === "collection" ? (
                <CollectionTab
                  t={t}
                  local={local}
                  setLocal={setLocal}
                  config={config}
                  savedFlash={savedFlash}
                  onApply={() => {
                    onSave({
                      ...synced,
                      interval_ms: local.interval_ms,
                      history_points: local.history_points,
                      enabled: local.enabled,
                    });
                    setSavedFlash(true);
                    window.setTimeout(() => setSavedFlash(false), 1600);
                  }}
                />
              ) : null}

              {pane === "clock" ? <ClockSettings /> : null}
              {pane === "albums" ? <AlbumSettings /> : null}
              {pane === "music" ? <MusicAlbumSettings /> : null}
              {pane === "audio" ? (
                <AudioSettings
                  frame={audioFrame}
                  status={audioStatus}
                  onSubscribe={onAudioSubscribe}
                />
              ) : null}
              {pane === "about" ? <AboutTab t={t} /> : null}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function paneLabel(t: TFunction, pane: SettingsPane): string {
  switch (pane) {
    case "appearance":
      return t("appearance");
    case "clock":
      return t("clock");
    case "collection":
      return t("collection");
    case "albums":
      return t("albums");
    case "music":
      return t("musicAlbums");
    case "audio":
      return t("audioVisualizer");
    case "about":
      return t("about");
    default:
      return t("settings");
  }
}

function CollectionTab({
  t,
  local,
  setLocal,
  config,
  savedFlash,
  onApply,
}: {
  t: TFunction;
  local: AppConfig;
  setLocal: Dispatch<SetStateAction<AppConfig>>;
  config: AppConfig | null;
  savedFlash: boolean;
  onApply: () => void;
}) {
  return (
    <div className="settings-collection">
      <SettingsGroup>
        <SettingsSliderRow
          id="interval"
          title={t("interval")}
          valueLabel={String(local.interval_ms)}
          min={200}
          max={5000}
          step={100}
          value={local.interval_ms}
          onChange={(interval_ms) => setLocal((state) => ({ ...state, interval_ms }))}
        />
        <SettingsSliderRow
          id="history"
          title={t("history")}
          valueLabel={String(local.history_points)}
          min={10}
          max={180}
          step={5}
          value={local.history_points}
          onChange={(history_points) => setLocal((state) => ({ ...state, history_points }))}
        />
      </SettingsGroup>

      <SettingsGroup label={t("modules")}>
        {(
          [
            ["cpu", "cpu"],
            ["memory", "memory"],
            ["gpu", "gpu"],
            ["disk", "disk"],
            ["network", "network"],
          ] as const
        ).map(([key, labelKey]) => (
          <SettingsSwitchRow
            key={key}
            id={key}
            title={t(labelKey)}
            checked={local.enabled[key]}
            onCheckedChange={(checked) =>
              setLocal((state) => ({
                ...state,
                enabled: { ...state.enabled, [key]: checked },
              }))
            }
          />
        ))}
      </SettingsGroup>

      <div className="settings-apply-bar">
        <Button className="w-full" disabled={!config} onClick={onApply}>
          {savedFlash ? t("applied") : t("apply")}
        </Button>
      </div>
    </div>
  );
}

function StylePreview({ id }: { id: UiStyle }) {
  const base = "settings-style-preview";
  switch (id) {
    case "neumorph":
      return (
        <div
          className={base}
          style={{
            borderRadius: "0.85rem",
            background:
              "linear-gradient(145deg, oklch(0.97 0.015 242), oklch(0.86 0.025 242))",
            boxShadow:
              "6px 7px 12px oklch(0.66 0.04 242 / 30%), -5px -5px 10px oklch(1 0 0 / 86%), inset 0 1px 0 oklch(1 0 0 / 65%)",
          }}
        />
      );
    case "line":
      return (
        <div
          className={`${base} border border-primary/70 bg-transparent`}
          style={{
            borderRadius: "0.15rem",
            borderTopWidth: "2px",
            backgroundImage:
              "linear-gradient(90deg, color-mix(in oklch, var(--primary) 7%, transparent) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
      );
    case "glass":
      return (
        <div
          className={`${base} border border-white/50 shadow-lg`}
          style={{
            borderRadius: "0.75rem",
            background:
              "radial-gradient(circle at 14% -18%, oklch(1 0 0 / 46%), transparent 43%), linear-gradient(135deg, oklch(1 0 0 / 34%), color-mix(in oklch, var(--primary) 13%, transparent) 54%, oklch(1 0 0 / 11%))",
            backdropFilter: "blur(14px) saturate(150%)",
            boxShadow:
              "0 10px 20px oklch(0.28 0.08 240 / 18%), inset 0 1px 0 oklch(1 0 0 / 54%)",
          }}
        />
      );
    case "console":
      return (
        <div
          className={`${base} flex items-center border border-primary/60 px-2 font-mono text-[10px] text-primary`}
          style={{
            borderRadius: "0.2rem",
            background:
              "repeating-linear-gradient(0deg, transparent 0 3px, color-mix(in oklch, var(--primary) 8%, transparent) 4px), linear-gradient(180deg, color-mix(in oklch, var(--card) 96%, white), color-mix(in oklch, var(--card) 88%, var(--primary) 5%))",
            boxShadow: "inset 0 1px 0 oklch(1 0 0 / 65%), 0 5px 10px oklch(0.25 0.06 155 / 10%)",
          }}
        >
          <span className="mr-2 opacity-60">›</span>0xVF <span className="ml-auto opacity-60">READY</span>
        </div>
      );
    case "paper":
      return (
        <div
          className={`${base} border border-stone-300 bg-stone-50 shadow-sm`}
          style={{
            borderRadius: "0.25rem",
            backgroundImage:
              "linear-gradient(90deg, oklch(0.55 0.04 70 / 7%) 1px, transparent 1px), repeating-linear-gradient(0deg, transparent, transparent 6px, oklch(0.75 0.03 80 / 25%) 6px, oklch(0.75 0.03 80 / 25%) 7px)",
            backgroundSize: "22px 22px, auto",
          }}
        />
      );
    case "instrument":
      return (
        <div
          className={`${base} border border-primary/60`}
          style={{
            borderRadius: "0.8rem",
            background:
              "radial-gradient(circle at 50% 18%, oklch(0.36 0.06 240), transparent 58%), linear-gradient(145deg, oklch(0.28 0.045 250), oklch(0.13 0.03 250))",
            boxShadow:
              "inset 0 1px 0 oklch(1 0 0 / 16%), inset 0 0 0 1px oklch(0 0 0 / 45%), 0 8px 14px oklch(0 0 0 / 32%)",
          }}
        />
      );
    case "dense":
      return (
        <div className={`${base} grid grid-cols-4 gap-0.5 border border-border bg-card p-1`} style={{ borderRadius: "0.25rem" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn("bg-muted", i === 2 && "bg-primary/60")} />
          ))}
        </div>
      );
    case "clay":
      return (
        <div
          className={base}
          style={{
            borderRadius: "1.1rem",
            background:
              "linear-gradient(145deg, oklch(0.99 0.012 88), oklch(0.9 0.04 54))",
            border: "1px solid color-mix(in oklch, var(--primary) 16%, transparent)",
            boxShadow:
              "0 10px 18px oklch(0.48 0.06 55 / 17%), 0 2px 0 oklch(1 0 0 / 80%), inset 0 -2px 0 oklch(0.7 0.04 60 / 20%)",
          }}
        />
      );
    case "metal":
      return (
        <div
          className={`${base} border border-slate-400`}
          style={{
            borderRadius: "0.3rem",
            background:
              "linear-gradient(135deg, oklch(0.96 0.01 245), oklch(0.75 0.018 245) 44%, oklch(0.92 0.012 245) 70%, oklch(0.7 0.02 245))",
            backgroundSize: "180% 180%",
            boxShadow:
              "inset 0 1px 0 oklch(1 0 0 / 72%), inset 0 -1px 0 oklch(0.4 0.03 245 / 24%), 0 6px 12px oklch(0.3 0.04 245 / 22%)",
          }}
        />
      );
    case "ink":
      return (
        <div
          className={`${base} border-[1.5px] border-foreground bg-transparent`}
          style={{
            borderRadius: "0.05rem",
            boxShadow: "4px 4px 0 oklch(0.3 0 0 / 20%)",
            backgroundImage: "linear-gradient(0deg, oklch(0.25 0.03 38 / 5%) 1px, transparent 1px)",
            backgroundSize: "100% 7px",
          }}
        />
      );
    case "swiss":
      return (
        <div className={`${base} flex items-end border-b border-foreground bg-transparent`} style={{ borderRadius: 0 }}>
          <span className="mb-2 block h-1.5 w-8 bg-primary" />
        </div>
      );
    case "hud":
      return (
        <div
          className={`${base} border border-primary/70 shadow-lg`}
          style={{
            borderRadius: 0,
            backgroundImage:
              "linear-gradient(color-mix(in oklch, var(--primary) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--primary) 18%, transparent) 1px, transparent 1px), radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 65%)",
            backgroundSize: "8px 8px, 8px 8px, 100% 100%",
            backgroundColor: "oklch(0.12 0.04 220)",
          }}
        />
      );
    case "editorial":
      return (
        <div className={`${base} flex flex-col justify-end border-0 bg-transparent pb-0`} style={{ borderRadius: "0.15rem" }}>
          <span className="font-serif text-xl font-semibold leading-none tracking-tight">Aa</span>
          <span className="mt-1 block h-px w-full bg-primary/60" />
        </div>
      );
    default:
      return (
        <div
          className={`${base} border border-border bg-card shadow-sm`}
          style={{ borderRadius: "0.7rem" }}
        />
      );
  }
}

function AppearanceTab({
  t,
  config,
  setAccent,
  setAccentCustom,
  setBackgroundColor,
  setGlassGradient,
  setLanguage,
  setUiStyle,
  setThemeMode,
  setHideTitleBar,
  setMobileCardMode,
  setMobileAutoCarousel,
  setMobileCarouselInterval,
}: {
  t: TFunction;
  config: AppConfig;
  setAccent: (v: AccentId) => void;
  setAccentCustom: (hex: string) => void;
  setBackgroundColor: (hex: string) => void;
  setGlassGradient: (start: string, end: string) => void;
  setLanguage: (v: Lang) => void;
  setUiStyle: (v: UiStyle) => void;
  setThemeMode: (v: ThemeMode) => void;
  setHideTitleBar: (v: boolean) => void;
  setMobileCardMode: (v: boolean) => void;
  setMobileAutoCarousel: (v: boolean) => void;
  setMobileCarouselInterval: (v: number) => void;
}) {
  const [hexDraft, setHexDraft] = useState(config.accent_custom);
  const [backgroundHexDraft, setBackgroundHexDraft] = useState(config.background_color);
  const [glassGradientStartDraft, setGlassGradientStartDraft] = useState(config.glass_gradient_start);
  const [glassGradientEndDraft, setGlassGradientEndDraft] = useState(config.glass_gradient_end);

  useEffect(() => {
    setHexDraft(config.accent_custom);
  }, [config.accent_custom]);

  useEffect(() => {
    setBackgroundHexDraft(config.background_color);
  }, [config.background_color]);

  useEffect(() => {
    setGlassGradientStartDraft(config.glass_gradient_start);
    setGlassGradientEndDraft(config.glass_gradient_end);
  }, [config.glass_gradient_start, config.glass_gradient_end]);

  const customBackground = !BACKGROUND_OPTIONS.some((option) => option.swatch === config.background_color);
  const customGlass = !GLASS_GRADIENT_OPTIONS.some(
    (option) =>
      option.start === config.glass_gradient_start && option.end === config.glass_gradient_end,
  );

  return (
    <div className="settings-appearance">
      <SettingsGroup label={t("uiStyle")} footer={t("uiStyleHint")}>
        <div className="settings-style-grid">
          {UI_STYLE_OPTIONS.map((opt) => {
            const selected = config.ui_style === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUiStyle(opt.id)}
                className={cn("settings-style-cell", selected && "is-selected")}
                aria-pressed={selected}
              >
                <span className="settings-style-thumb" aria-hidden="true">
                  <StylePreview id={opt.id} />
                </span>
                <span className="settings-style-cell-name">{t(opt.nameKey)}</span>
                {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} /> : null}
              </button>
            );
          })}
        </div>
      </SettingsGroup>

      <SettingsGroup label={t("accent")} footer={t("accentCustomHint")}>
        <div className="settings-swatch-row">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-label={opt.label}
              aria-pressed={config.accent === opt.id}
              onClick={() => setAccent(opt.id)}
              className={cn("settings-swatch", config.accent === opt.id && "is-selected")}
            >
              <span style={{ backgroundColor: opt.swatch }} />
            </button>
          ))}
          <label className={cn("settings-swatch", config.accent === "custom" && "is-selected")}>
            <span
              style={{
                background: "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
            />
            <input
              type="color"
              aria-label={t("accentCustom")}
              value={config.accent_custom}
              onChange={(event) => {
                setHexDraft(event.target.value);
                setAccentCustom(event.target.value);
              }}
            />
          </label>
        </div>
        <div className="settings-hex-row">
          <Label htmlFor="accent-hex">{t("accentHex")}</Label>
          <input
            id="accent-hex"
            type="text"
            spellCheck={false}
            value={hexDraft}
            onChange={(event) => setHexDraft(event.target.value)}
            onBlur={() => setAccentCustom(hexDraft)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="settings-hex-input"
            placeholder="#0d9488"
          />
        </div>
      </SettingsGroup>

      <SettingsGroup label={t("backgroundColor")} footer={t("backgroundColorHint")}>
        <div className="settings-swatch-row">
          {BACKGROUND_OPTIONS.map((option) => {
            const selected = config.background_color === option.swatch;
            return (
              <button
                key={option.id}
                type="button"
                aria-label={t(option.labelKey)}
                aria-pressed={selected}
                className={cn("settings-swatch", selected && "is-selected")}
                onClick={() => {
                  setBackgroundHexDraft(option.swatch);
                  setBackgroundColor(option.swatch);
                }}
              >
                <span style={{ backgroundColor: option.swatch }} />
              </button>
            );
          })}
          <label className={cn("settings-swatch", customBackground && "is-selected")}>
            <span style={{ backgroundColor: config.background_color }} />
            <input
              type="color"
              aria-label={t("backgroundCustom")}
              value={config.background_color}
              onChange={(event) => {
                setBackgroundHexDraft(event.target.value);
                setBackgroundColor(event.target.value);
              }}
            />
          </label>
        </div>
        <div className="settings-hex-row">
          <Label htmlFor="background-hex">{t("backgroundHex")}</Label>
          <input
            id="background-hex"
            type="text"
            spellCheck={false}
            value={backgroundHexDraft}
            onChange={(event) => setBackgroundHexDraft(event.target.value)}
            onBlur={() => setBackgroundColor(backgroundHexDraft)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="settings-hex-input"
            placeholder="#0b1a20"
          />
        </div>
      </SettingsGroup>

      {config.ui_style === "glass" ? (
        <SettingsGroup label={t("glassGradient")} footer={t("glassGradientHint")}>
          <div className="settings-swatch-row">
            {GLASS_GRADIENT_OPTIONS.map((option) => {
              const selected =
                config.glass_gradient_start === option.start &&
                config.glass_gradient_end === option.end;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={t(option.labelKey)}
                  aria-pressed={selected}
                  className={cn("settings-swatch", selected && "is-selected")}
                  onClick={() => {
                    setGlassGradientStartDraft(option.start);
                    setGlassGradientEndDraft(option.end);
                    setGlassGradient(option.start, option.end);
                  }}
                >
                  <span
                    style={{ background: `linear-gradient(135deg, ${option.start}, ${option.end})` }}
                  />
                </button>
              );
            })}
            <span className={cn("settings-swatch", customGlass && "is-selected")} aria-hidden="true">
              <span
                style={{
                  background: `linear-gradient(135deg, ${config.glass_gradient_start}, ${config.glass_gradient_end})`,
                }}
              />
            </span>
          </div>
          <div className="settings-hex-row">
            <Label htmlFor="glass-start">{t("glassGradientStart")}</Label>
            <input
              type="color"
              aria-label={t("glassGradientStart")}
              value={config.glass_gradient_start}
              onChange={(event) => {
                setGlassGradientStartDraft(event.target.value);
                setGlassGradient(event.target.value, config.glass_gradient_end);
              }}
              className="settings-color-chip"
            />
            <input
              id="glass-start"
              type="text"
              spellCheck={false}
              value={glassGradientStartDraft}
              onChange={(event) => setGlassGradientStartDraft(event.target.value)}
              onBlur={() => setGlassGradient(glassGradientStartDraft, config.glass_gradient_end)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="settings-hex-input"
              placeholder="#d9f8ff"
            />
          </div>
          <div className="settings-hex-row">
            <Label htmlFor="glass-end">{t("glassGradientEnd")}</Label>
            <input
              type="color"
              aria-label={t("glassGradientEnd")}
              value={config.glass_gradient_end}
              onChange={(event) => {
                setGlassGradientEndDraft(event.target.value);
                setGlassGradient(config.glass_gradient_start, event.target.value);
              }}
              className="settings-color-chip"
            />
            <input
              id="glass-end"
              type="text"
              spellCheck={false}
              value={glassGradientEndDraft}
              onChange={(event) => setGlassGradientEndDraft(event.target.value)}
              onBlur={() => setGlassGradient(config.glass_gradient_start, glassGradientEndDraft)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="settings-hex-input"
              placeholder="#d7f4ee"
            />
          </div>
        </SettingsGroup>
      ) : null}

      <SettingsGroup label={t("themeMode")}>
        <div className="settings-row settings-row-flush">
          <SettingsSegmented
            value={config.theme}
            onChange={setThemeMode}
            options={[
              { id: "light", label: t("themeLight") },
              { id: "dark", label: t("themeDark") },
              { id: "system", label: t("themeSystem") },
            ]}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup label={t("language")}>
        <div className="settings-row settings-row-flush">
          <SettingsSegmented
            value={config.language}
            onChange={setLanguage}
            options={[
              { id: "zh", label: t("langZh") },
              { id: "en", label: t("langEn") },
            ]}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsSwitchRow
          id="hide-title-bar"
          title={t("hideTitleBar")}
          subtitle={t("hideTitleBarHint")}
          checked={config.hide_title_bar}
          onCheckedChange={setHideTitleBar}
        />
        <SettingsSwitchRow
          id="mobile-card-mode"
          title={t("mobileCardMode")}
          subtitle={t("mobileCardModeHint")}
          checked={config.mobile_card_mode}
          onCheckedChange={setMobileCardMode}
        />
        <SettingsSwitchRow
          id="mobile-auto-carousel"
          title={t("mobileAutoCarousel")}
          subtitle={t("mobileAutoCarouselHint")}
          checked={config.mobile_auto_carousel}
          disabled={!config.mobile_card_mode}
          onCheckedChange={setMobileAutoCarousel}
        />
        {config.mobile_card_mode && config.mobile_auto_carousel ? (
          <SettingsSliderRow
            id="carousel-interval"
            title={t("carouselInterval")}
            valueLabel={String(config.mobile_carousel_interval_s)}
            min={5}
            max={60}
            step={1}
            value={config.mobile_carousel_interval_s}
            onChange={setMobileCarouselInterval}
          />
        ) : null}
      </SettingsGroup>
    </div>
  );
}

function AboutTab({ t }: { t: TFunction }) {
  const stacks = [
    "Rust · Tokio · Axum · sysinfo · WMI · NVML",
    "Vite · React 19 · Tailwind CSS 4",
    "WebSocket JSON IPC · rust-embed",
    "Multi-style surfaces · Recharts · Motion loaders",
  ];

  return (
    <div className="settings-about">
      <p className="settings-about-lead">{t("aboutDesc")}</p>
      <SettingsGroup>
        <SettingsRow title={t("version")} value={APP_VERSION} />
        <SettingsRow title={t("license")} value="Apache-2.0" />
      </SettingsGroup>
      <SettingsGroup label={t("techStack")}>
        {stacks.map((line) => (
          <div key={line} className="settings-row settings-row-stack">
            <span className="settings-row-subtitle">{line}</span>
          </div>
        ))}
      </SettingsGroup>
    </div>
  );
}
