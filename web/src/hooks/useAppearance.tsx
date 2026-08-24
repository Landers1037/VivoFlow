import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import { translate, type MessageKey, type TranslateVars } from "@/i18n/messages";
import type { AccentId, AppConfig, Lang, ThemeMode, UiStyle } from "@/types";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_CUSTOM,
  DEFAULT_CONFIG,
  UI_STYLES,
} from "@/types";

export type { AccentId, Lang, UiStyle };
export type TFunction = (key: MessageKey, vars?: TranslateVars) => string;

const ACCENT_HUES: Record<
  Exclude<AccentId, "custom">,
  { light: string; dark: string; ringLight: string; ringDark: string }
> = {
  teal: {
    light: "oklch(0.42 0.08 200)",
    dark: "oklch(0.78 0.08 195)",
    ringLight: "oklch(0.5 0.08 200)",
    ringDark: "oklch(0.7 0.08 195)",
  },
  zinc: {
    light: "oklch(0.35 0.02 260)",
    dark: "oklch(0.85 0.01 260)",
    ringLight: "oklch(0.45 0.02 260)",
    ringDark: "oklch(0.7 0.01 260)",
  },
  blue: {
    light: "oklch(0.45 0.14 250)",
    dark: "oklch(0.75 0.12 250)",
    ringLight: "oklch(0.5 0.12 250)",
    ringDark: "oklch(0.7 0.12 250)",
  },
  violet: {
    light: "oklch(0.45 0.16 300)",
    dark: "oklch(0.76 0.12 300)",
    ringLight: "oklch(0.5 0.14 300)",
    ringDark: "oklch(0.7 0.12 300)",
  },
  amber: {
    light: "oklch(0.55 0.14 75)",
    dark: "oklch(0.8 0.12 80)",
    ringLight: "oklch(0.6 0.12 75)",
    ringDark: "oklch(0.75 0.12 80)",
  },
};

export function normalizeHexColor(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return DEFAULT_ACCENT_CUSTOM;
}

function normalizeConfig(raw: AppConfig | null | undefined): AppConfig {
  const base = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  const accents: AccentId[] = [...ACCENT_PRESETS, "custom"];
  const themes: ThemeMode[] = ["light", "dark", "system"];
  const langs: Lang[] = ["zh", "en"];
  return {
    ...base,
    enabled: { ...DEFAULT_CONFIG.enabled, ...(raw?.enabled ?? {}) },
    ui_style: UI_STYLES.includes(base.ui_style as UiStyle)
      ? (base.ui_style as UiStyle)
      : "amicro",
    accent: accents.includes(base.accent as AccentId) ? (base.accent as AccentId) : "teal",
    accent_custom: normalizeHexColor(base.accent_custom),
    theme: themes.includes(base.theme as ThemeMode) ? (base.theme as ThemeMode) : "system",
    language: langs.includes(base.language as Lang) ? (base.language as Lang) : "zh",
    hide_title_bar: Boolean(base.hide_title_bar),
    mobile_card_mode: Boolean(base.mobile_card_mode),
    mobile_auto_carousel: base.mobile_auto_carousel !== false,
    mobile_carousel_interval_s: Number.isFinite(Number(base.mobile_carousel_interval_s))
      ? Math.min(60, Math.max(5, Number(base.mobile_carousel_interval_s)))
      : DEFAULT_CONFIG.mobile_carousel_interval_s,
  };
}

function applyAccent(accent: AccentId, customHex: string) {
  const root = document.documentElement;
  if (accent === "custom") {
    const hex = normalizeHexColor(customHex);
    root.style.setProperty(
      "--accent-primary-light",
      `color-mix(in oklch, ${hex} 72%, black)`,
    );
    root.style.setProperty(
      "--accent-primary-dark",
      `color-mix(in oklch, ${hex} 68%, white)`,
    );
    root.style.setProperty("--accent-ring-light", hex);
    root.style.setProperty(
      "--accent-ring-dark",
      `color-mix(in oklch, ${hex} 80%, white)`,
    );
    root.dataset.accent = "custom";
    return;
  }
  const c = ACCENT_HUES[accent];
  root.style.setProperty("--accent-primary-light", c.light);
  root.style.setProperty("--accent-primary-dark", c.dark);
  root.style.setProperty("--accent-ring-light", c.ringLight);
  root.style.setProperty("--accent-ring-dark", c.ringDark);
  root.dataset.accent = accent;
}

interface AppearanceContextValue {
  config: AppConfig;
  synced: boolean;
  setUiStyle: (v: UiStyle) => void;
  setAccent: (v: AccentId) => void;
  setAccentCustom: (hex: string) => void;
  setLanguage: (v: Lang) => void;
  setThemeMode: (v: ThemeMode) => void;
  setHideTitleBar: (v: boolean) => void;
  setMobileCardMode: (v: boolean) => void;
  setMobileAutoCarousel: (v: boolean) => void;
  setMobileCarouselInterval: (v: number) => void;
  t: TFunction;
  lang: Lang;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({
  config,
  onPersist,
  children,
}: {
  config: AppConfig | null;
  onPersist: (next: AppConfig) => void;
  children: ReactNode;
}) {
  const { setTheme } = useTheme();
  const synced = config != null;
  const resolved = useMemo(() => normalizeConfig(config), [config]);

  useEffect(() => {
    applyAccent(resolved.accent, resolved.accent_custom);
    document.documentElement.dataset.uiStyle = resolved.ui_style;
    document.documentElement.lang = resolved.language === "en" ? "en" : "zh-CN";
    setTheme(resolved.theme);
  }, [
    resolved.accent,
    resolved.accent_custom,
    resolved.language,
    resolved.theme,
    resolved.ui_style,
    setTheme,
  ]);

  const patch = useCallback(
    (partial: Partial<AppConfig>) => {
      if (!synced) return;
      const next = normalizeConfig({ ...resolved, ...partial });
      onPersist(next);
    },
    [onPersist, resolved, synced],
  );

  const t = useCallback<TFunction>(
    (key, vars) => translate(resolved.language, key, vars),
    [resolved.language],
  );

  const value = useMemo<AppearanceContextValue>(
    () => ({
      config: resolved,
      synced,
      setUiStyle: (ui_style) => patch({ ui_style }),
      setAccent: (accent) => patch({ accent }),
      setAccentCustom: (hex) =>
        patch({ accent: "custom", accent_custom: normalizeHexColor(hex) }),
      setLanguage: (language) => patch({ language }),
      setThemeMode: (theme) => patch({ theme }),
      setHideTitleBar: (hide_title_bar) => patch({ hide_title_bar }),
      setMobileCardMode: (mobile_card_mode) => patch({ mobile_card_mode }),
      setMobileAutoCarousel: (mobile_auto_carousel) => patch({ mobile_auto_carousel }),
      setMobileCarouselInterval: (mobile_carousel_interval_s) =>
        patch({ mobile_carousel_interval_s }),
      t,
      lang: resolved.language,
    }),
    [resolved, synced, patch, t],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}

export const ACCENT_OPTIONS: { id: Exclude<AccentId, "custom">; label: string; swatch: string }[] =
  [
    { id: "teal", label: "Teal", swatch: "#5eead4" },
    { id: "zinc", label: "Zinc", swatch: "#a1a1aa" },
    { id: "blue", label: "Blue", swatch: "#60a5fa" },
    { id: "violet", label: "Violet", swatch: "#c084fc" },
    { id: "amber", label: "Amber", swatch: "#fbbf24" },
  ];

export const UI_STYLE_OPTIONS: {
  id: UiStyle;
  nameKey: MessageKey;
  hintKey: MessageKey;
}[] = [
  { id: "amicro", nameKey: "styleAmicro", hintKey: "styleAmicroHint" },
  { id: "neumorph", nameKey: "styleNeumorph", hintKey: "styleNeumorphHint" },
  { id: "line", nameKey: "styleLine", hintKey: "styleLineHint" },
  { id: "glass", nameKey: "styleGlass", hintKey: "styleGlassHint" },
  { id: "console", nameKey: "styleConsole", hintKey: "styleConsoleHint" },
  { id: "paper", nameKey: "stylePaper", hintKey: "stylePaperHint" },
  { id: "instrument", nameKey: "styleInstrument", hintKey: "styleInstrumentHint" },
  { id: "dense", nameKey: "styleDense", hintKey: "styleDenseHint" },
  { id: "clay", nameKey: "styleClay", hintKey: "styleClayHint" },
  { id: "metal", nameKey: "styleMetal", hintKey: "styleMetalHint" },
  { id: "ink", nameKey: "styleInk", hintKey: "styleInkHint" },
  { id: "swiss", nameKey: "styleSwiss", hintKey: "styleSwissHint" },
  { id: "hud", nameKey: "styleHud", hintKey: "styleHudHint" },
  { id: "editorial", nameKey: "styleEditorial", hintKey: "styleEditorialHint" },
];
