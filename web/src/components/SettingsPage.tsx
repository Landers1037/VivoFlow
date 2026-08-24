import { useEffect, useState } from "react";
import { ArrowLeft, Info, Palette, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ACCENT_OPTIONS,
  UI_STYLE_OPTIONS,
  useAppearance,
  type AccentId,
  type TFunction,
} from "@/hooks/useAppearance";
import type { AppConfig, Lang, ThemeMode, UiStyle } from "@/types";
import { DEFAULT_CONFIG } from "@/types";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

type TabId = "appearance" | "collection" | "about";

export function SettingsPage({
  config,
  onSave,
  onBack,
}: {
  config: AppConfig | null;
  onSave: (cfg: AppConfig) => void;
  onBack: () => void;
}) {
  const {
    t,
    config: synced,
    setAccent,
    setAccentCustom,
    setLanguage,
    setUiStyle,
    setThemeMode,
    setHideTitleBar,
    setMobileCardMode,
    setMobileAutoCarousel,
    setMobileCarouselInterval,
  } = useAppearance();
  const [tab, setTab] = useState<TabId>("appearance");
  const [savedFlash, setSavedFlash] = useState(false);
  const [local, setLocal] = useState<AppConfig>(config ?? DEFAULT_CONFIG);

  useEffect(() => {
    if (config) setLocal(config);
  }, [config]);

  const tabs: { id: TabId; label: string; icon: typeof Palette }[] = [
    { id: "appearance", label: t("appearance"), icon: Palette },
    { id: "collection", label: t("collection"), icon: Radio },
    { id: "about", label: t("about"), icon: Info },
  ];

  return (
    <div className="flex min-h-[70dvh] flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("back")} onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{t("settings")}</h1>
          {!config ? (
            <p className="text-xs text-muted-foreground">{t("connecting")}</p>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 landscape:gap-4">
        <nav
          className="flex w-[5.5rem] shrink-0 flex-col gap-1 sm:w-36"
          aria-label={t("settings")}
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex min-h-11 items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors sm:px-3",
                tab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              style={{ borderRadius: "var(--nav-radius)" }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <section className="vf-panel min-w-0 flex-1">
          {tab === "appearance" ? (
            <AppearanceTab
              t={t}
              config={synced}
              setAccent={setAccent}
              setAccentCustom={setAccentCustom}
              setLanguage={setLanguage}
              setUiStyle={setUiStyle}
              setThemeMode={setThemeMode}
              setHideTitleBar={setHideTitleBar}
              setMobileCardMode={setMobileCardMode}
              setMobileAutoCarousel={setMobileAutoCarousel}
              setMobileCarouselInterval={setMobileCarouselInterval}
            />
          ) : null}

          {tab === "collection" ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="interval">
                  {t("interval")}: {local.interval_ms}
                </Label>
                <input
                  id="interval"
                  type="range"
                  min={200}
                  max={5000}
                  step={100}
                  value={local.interval_ms}
                  onChange={(e) =>
                    setLocal((s) => ({ ...s, interval_ms: Number(e.target.value) }))
                  }
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="history">
                  {t("history")}: {local.history_points}
                </Label>
                <input
                  id="history"
                  type="range"
                  min={10}
                  max={180}
                  step={5}
                  value={local.history_points}
                  onChange={(e) =>
                    setLocal((s) => ({ ...s, history_points: Number(e.target.value) }))
                  }
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("modules")}</p>
                {(
                  [
                    ["cpu", "cpu"],
                    ["memory", "memory"],
                    ["gpu", "gpu"],
                    ["disk", "disk"],
                    ["network", "network"],
                  ] as const
                ).map(([key, labelKey]) => (
                  <div key={key} className="flex min-h-11 items-center justify-between gap-3">
                    <Label htmlFor={key}>{t(labelKey)}</Label>
                    <Switch
                      id={key}
                      checked={local.enabled[key]}
                      onCheckedChange={(checked) =>
                        setLocal((s) => ({
                          ...s,
                          enabled: { ...s.enabled, [key]: checked },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={!config}
                onClick={() => {
                  onSave({
                    ...synced,
                    interval_ms: local.interval_ms,
                    history_points: local.history_points,
                    enabled: local.enabled,
                  });
                  setSavedFlash(true);
                  window.setTimeout(() => setSavedFlash(false), 1600);
                }}
              >
                {savedFlash ? t("applied") : t("apply")}
              </Button>
            </div>
          ) : null}

          {tab === "about" ? <AboutTab t={t} /> : null}
        </section>
      </div>
    </div>
  );
}

function StylePreview({ id }: { id: UiStyle }) {
  const base = "h-10 w-full";
  switch (id) {
    case "neumorph":
      return (
        <div
          className={base}
          style={{
            borderRadius: "0.85rem",
            background: "oklch(0.9 0.01 240)",
            boxShadow:
              "4px 4px 8px oklch(0.72 0.02 240 / 55%), -3px -3px 7px oklch(1 0 0 / 85%)",
          }}
        />
      );
    case "line":
      return (
        <div
          className={`${base} border border-foreground/70 bg-transparent`}
          style={{ borderRadius: "0.1rem" }}
        />
      );
    case "glass":
      return (
        <div
          className={`${base} border border-white/40`}
          style={{
            borderRadius: "0.75rem",
            background: "color-mix(in oklch, white 45%, transparent)",
            backdropFilter: "blur(6px)",
          }}
        />
      );
    case "console":
      return (
        <div
          className={`${base} flex items-center border border-primary/60 bg-card/80 px-2 font-mono text-[10px] text-primary`}
          style={{ borderRadius: "0.2rem" }}
        >
          0xVF
        </div>
      );
    case "paper":
      return (
        <div
          className={`${base} border border-stone-300 bg-stone-50`}
          style={{
            borderRadius: "0.25rem",
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 5px, oklch(0.85 0.02 90 / 25%) 5px, oklch(0.85 0.02 90 / 25%) 6px)",
          }}
        />
      );
    case "instrument":
      return (
        <div
          className={`${base} border-2 border-primary/50`}
          style={{
            borderRadius: "999px",
            background:
              "radial-gradient(circle at 50% 40%, oklch(0.35 0.03 250), oklch(0.18 0.02 250))",
          }}
        />
      );
    case "dense":
      return (
        <div className={`${base} grid grid-cols-4 gap-0.5 border border-border p-1`} style={{ borderRadius: "0.25rem" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted" />
          ))}
        </div>
      );
    case "clay":
      return (
        <div
          className={base}
          style={{
            borderRadius: "1.1rem",
            background: "oklch(0.95 0.015 95)",
            boxShadow: "0 8px 16px oklch(0.55 0.04 80 / 18%)",
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
              "linear-gradient(135deg, oklch(0.88 0.01 250), oklch(0.72 0.015 250), oklch(0.86 0.01 250))",
          }}
        />
      );
    case "ink":
      return (
        <div
          className={`${base} border-[1.5px] border-foreground bg-transparent`}
          style={{ borderRadius: "0.05rem", boxShadow: "3px 3px 0 oklch(0.3 0 0 / 20%)" }}
        />
      );
    case "swiss":
      return (
        <div className={`${base} border-b border-foreground bg-transparent`} style={{ borderRadius: 0 }} />
      );
    case "hud":
      return (
        <div
          className={`${base} border border-primary/70`}
          style={{
            borderRadius: 0,
            backgroundImage:
              "linear-gradient(color-mix(in oklch, var(--primary) 15%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--primary) 15%, transparent) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
            backgroundColor: "oklch(0.15 0.03 220)",
          }}
        />
      );
    case "editorial":
      return (
        <div className={`${base} flex flex-col justify-end border-0 bg-transparent pb-0`} style={{ borderRadius: "0.15rem" }}>
          <span className="font-serif text-lg font-semibold leading-none">Aa</span>
          <span className="mt-1 block h-px w-full bg-border" />
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
  setLanguage: (v: Lang) => void;
  setUiStyle: (v: UiStyle) => void;
  setThemeMode: (v: ThemeMode) => void;
  setHideTitleBar: (v: boolean) => void;
  setMobileCardMode: (v: boolean) => void;
  setMobileAutoCarousel: (v: boolean) => void;
  setMobileCarouselInterval: (v: number) => void;
}) {
  const [hexDraft, setHexDraft] = useState(config.accent_custom);

  useEffect(() => {
    setHexDraft(config.accent_custom);
  }, [config.accent_custom]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>{t("uiStyle")}</Label>
        <p className="text-xs text-muted-foreground">{t("uiStyleHint")}</p>
        <div className="grid max-h-[min(52dvh,28rem)] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {UI_STYLE_OPTIONS.map((opt) => {
            const selected = config.ui_style === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUiStyle(opt.id)}
                className={cn(
                  "flex flex-col gap-2 border px-3 py-3 text-left text-sm transition-colors",
                  selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40",
                )}
                style={{ borderRadius: "var(--nav-radius)" }}
              >
                <StylePreview id={opt.id} />
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{t(opt.nameKey)}</span>
                  {selected ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      ON
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {t(opt.hintKey)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("accent")}</Label>
        <p className="text-xs text-muted-foreground">{t("accentCustomHint")}</p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-label={opt.label}
              onClick={() => setAccent(opt.id)}
              className={cn(
                "flex min-h-11 min-w-11 items-center justify-center border p-1.5 transition-colors",
                config.accent === opt.id ? "border-primary ring-2 ring-ring" : "border-border",
              )}
              style={{ borderRadius: "var(--nav-radius)" }}
            >
              <span className="h-7 w-7 rounded-full" style={{ backgroundColor: opt.swatch }} />
            </button>
          ))}
          <label
            className={cn(
              "relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center border p-1.5 transition-colors",
              config.accent === "custom" ? "border-primary ring-2 ring-ring" : "border-border",
            )}
            style={{ borderRadius: "var(--nav-radius)" }}
            title={t("accentCustom")}
          >
            <span
              className="h-7 w-7 rounded-full border border-border"
              style={{
                background: `conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)`,
              }}
            />
            <input
              type="color"
              aria-label={t("accentCustom")}
              value={config.accent_custom}
              onChange={(e) => {
                setHexDraft(e.target.value);
                setAccentCustom(e.target.value);
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="accent-hex" className="shrink-0 text-xs text-muted-foreground">
            {t("accentHex")}
          </Label>
          <input
            id="accent-hex"
            type="text"
            spellCheck={false}
            value={hexDraft}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={() => setAccentCustom(hexDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="min-h-10 flex-1 border border-border bg-background px-3 font-mono text-sm"
            style={{ borderRadius: "var(--nav-radius)" }}
            placeholder="#0d9488"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("themeMode")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["light", "themeLight"],
              ["dark", "themeDark"],
              ["system", "themeSystem"],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              onClick={() => setThemeMode(value)}
              className={cn(
                "min-h-11 border px-2 text-sm",
                config.theme === value ? "border-primary bg-primary/10 font-medium" : "border-border",
              )}
              style={{ borderRadius: "var(--nav-radius)" }}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("language")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["zh", "langZh"],
              ["en", "langEn"],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLanguage(value)}
              className={cn(
                "min-h-11 border px-2 text-sm",
                config.language === value
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border",
              )}
              style={{ borderRadius: "var(--nav-radius)" }}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-5">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="hide-title-bar">{t("hideTitleBar")}</Label>
            <p className="mt-1 text-xs text-muted-foreground">{t("hideTitleBarHint")}</p>
          </div>
          <Switch
            id="hide-title-bar"
            checked={config.hide_title_bar}
            onCheckedChange={setHideTitleBar}
          />
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="mobile-card-mode">{t("mobileCardMode")}</Label>
            <p className="mt-1 text-xs text-muted-foreground">{t("mobileCardModeHint")}</p>
          </div>
          <Switch
            id="mobile-card-mode"
            checked={config.mobile_card_mode}
            onCheckedChange={setMobileCardMode}
          />
        </div>
        <div className={cn("space-y-3", !config.mobile_card_mode && "opacity-50")}>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="mobile-auto-carousel">{t("mobileAutoCarousel")}</Label>
              <p className="mt-1 text-xs text-muted-foreground">{t("mobileAutoCarouselHint")}</p>
            </div>
            <Switch
              id="mobile-auto-carousel"
              checked={config.mobile_auto_carousel}
              disabled={!config.mobile_card_mode}
              onCheckedChange={setMobileAutoCarousel}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="carousel-interval">
              {t("carouselInterval")}: {config.mobile_carousel_interval_s}
            </Label>
            <input
              id="carousel-interval"
              type="range"
              min={5}
              max={60}
              step={1}
              value={config.mobile_carousel_interval_s}
              disabled={!config.mobile_card_mode}
              onChange={(e) => setMobileCarouselInterval(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>
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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("aboutTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("aboutDesc")}</p>
      </div>
      <div className="vf-row flex items-center justify-between px-3 py-3 text-sm">
        <span className="text-muted-foreground">{t("version")}</span>
        <span className="vf-data font-medium">{APP_VERSION}</span>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("techStack")}</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {stacks.map((line) => (
            <li key={line} className="vf-surface px-3 py-2">
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="vf-row flex items-center justify-between px-3 py-3 text-sm">
        <span className="text-muted-foreground">{t("license")}</span>
        <span className="font-medium">Apache-2.0</span>
      </div>
    </div>
  );
}
