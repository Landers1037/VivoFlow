import { useEffect, useState } from "react";
import { ArrowLeft, Info, Palette, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ACCENT_OPTIONS,
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
    setLanguage,
    setUiStyle,
    setThemeMode,
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
                "flex min-h-11 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors sm:px-3",
                tab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <section className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 sm:p-5">
          {tab === "appearance" ? (
            <AppearanceTab
              t={t}
              config={synced}
              setAccent={setAccent}
              setLanguage={setLanguage}
              setUiStyle={setUiStyle}
              setThemeMode={setThemeMode}
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

function AppearanceTab({
  t,
  config,
  setAccent,
  setLanguage,
  setUiStyle,
  setThemeMode,
}: {
  t: TFunction;
  config: AppConfig;
  setAccent: (v: AccentId) => void;
  setLanguage: (v: Lang) => void;
  setUiStyle: (v: UiStyle) => void;
  setThemeMode: (v: ThemeMode) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>{t("uiStyle")}</Label>
        <p className="text-xs text-muted-foreground">{t("uiStyleHint")}</p>
        <button
          type="button"
          onClick={() => setUiStyle("amicro")}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm",
            config.ui_style === "amicro" ? "border-primary bg-primary/10" : "border-border",
          )}
        >
          <span className="font-medium">Amicro</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            Soft Arc Caps
          </span>
        </button>
      </div>

      <div className="space-y-2">
        <Label>{t("accent")}</Label>
        <div className="flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-label={opt.label}
              onClick={() => setAccent(opt.id)}
              className={cn(
                "flex min-h-11 min-w-11 items-center justify-center rounded-xl border p-1.5 transition-colors",
                config.accent === opt.id ? "border-primary ring-2 ring-ring" : "border-border",
              )}
            >
              <span className="h-7 w-7 rounded-full" style={{ backgroundColor: opt.swatch }} />
            </button>
          ))}
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
                "min-h-11 rounded-xl border px-2 text-sm",
                config.theme === value ? "border-primary bg-primary/10 font-medium" : "border-border",
              )}
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
                "min-h-11 rounded-xl border px-2 text-sm",
                config.language === value
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border",
              )}
            >
              {t(labelKey)}
            </button>
          ))}
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
    "Amicro-style Motion loaders · Recharts mono charts",
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("aboutTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("aboutDesc")}</p>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-3 text-sm">
        <span className="text-muted-foreground">{t("version")}</span>
        <span className="font-medium tabular-nums">{APP_VERSION}</span>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("techStack")}</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {stacks.map((line) => (
            <li key={line} className="rounded-xl border border-border/80 px-3 py-2">
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-3 text-sm">
        <span className="text-muted-foreground">{t("license")}</span>
        <span className="font-medium">Apache-2.0</span>
      </div>
    </div>
  );
}
