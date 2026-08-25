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
import type { AccentId, AppConfig, AudioColorMode, AudioVisualizerMode, Lang, PhotoAlbumEffect, ThemeMode, UiStyle } from "@/types";
import {
  ACCENT_PRESETS,
  DEFAULT_BACKGROUND_COLOR,
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
    background_color: normalizeHexColor(base.background_color || DEFAULT_BACKGROUND_COLOR),
    theme: themes.includes(base.theme as ThemeMode) ? (base.theme as ThemeMode) : "system",
    language: langs.includes(base.language as Lang) ? (base.language as Lang) : "zh",
    hide_title_bar: Boolean(base.hide_title_bar),
    mobile_card_mode: Boolean(base.mobile_card_mode),
    mobile_auto_carousel: base.mobile_auto_carousel !== false,
    mobile_carousel_interval_s: Number.isFinite(Number(base.mobile_carousel_interval_s))
      ? Math.min(60, Math.max(5, Number(base.mobile_carousel_interval_s)))
      : DEFAULT_CONFIG.mobile_carousel_interval_s,
    photo_album_enabled: Boolean(base.photo_album_enabled),
    photo_album_effect: (["single", "time_machine", "cover_flow"] as const).includes(
      base.photo_album_effect as PhotoAlbumEffect,
    )
      ? (base.photo_album_effect as PhotoAlbumEffect)
      : "single",
    audio_visualizer_enabled: Boolean(base.audio_visualizer_enabled),
    audio_device_id: typeof base.audio_device_id === "string" && base.audio_device_id.trim() ? base.audio_device_id : null,
    audio_visualizer_mode: (["particles", "grid", "aurora", "radial", "city3d", "nebula3d", "terrain3d", "crystal3d"] as const).includes(base.audio_visualizer_mode as AudioVisualizerMode) ? base.audio_visualizer_mode as AudioVisualizerMode : "particles",
    audio_color_mode: (["single", "gradient"] as const).includes(base.audio_color_mode as AudioColorMode) ? base.audio_color_mode as AudioColorMode : "gradient",
    audio_color_primary: normalizeHexColor(base.audio_color_primary || "#22d3ee"),
    audio_color_secondary: normalizeHexColor(base.audio_color_secondary || "#a855f7"),
    audio_amplitude: Number.isFinite(Number(base.audio_amplitude)) ? Math.min(2, Math.max(0.5, Number(base.audio_amplitude))) : 1,
    audio_smoothing: Number.isFinite(Number(base.audio_smoothing)) ? Math.min(0.9, Math.max(0, Number(base.audio_smoothing))) : 0.65,
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

function applyBackgroundColor(backgroundColor: string) {
  document.documentElement.style.setProperty(
    "--vf-background-custom",
    normalizeHexColor(backgroundColor),
  );
}

interface AppearanceContextValue {
  config: AppConfig;
  synced: boolean;
  setUiStyle: (v: UiStyle) => void;
  setAccent: (v: AccentId) => void;
  setAccentCustom: (hex: string) => void;
  setBackgroundColor: (hex: string) => void;
  setLanguage: (v: Lang) => void;
  setThemeMode: (v: ThemeMode) => void;
  setHideTitleBar: (v: boolean) => void;
  setMobileCardMode: (v: boolean) => void;
  setMobileAutoCarousel: (v: boolean) => void;
  setMobileCarouselInterval: (v: number) => void;
  setPhotoAlbumEnabled: (v: boolean) => void;
  setPhotoAlbumEffect: (v: PhotoAlbumEffect) => void;
  setAudioVisualizerEnabled: (v: boolean) => void;
  setAudioDeviceId: (v: string | null) => void;
  setAudioVisualizerMode: (v: AudioVisualizerMode) => void;
  setAudioColorMode: (v: AudioColorMode) => void;
  setAudioColors: (primary: string, secondary: string) => void;
  setAudioAmplitude: (v: number) => void;
  setAudioSmoothing: (v: number) => void;
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
    applyBackgroundColor(resolved.background_color);
    document.documentElement.dataset.uiStyle = resolved.ui_style;
    document.documentElement.lang = resolved.language === "en" ? "en" : "zh-CN";
    setTheme(resolved.theme);
  }, [
    resolved.accent,
    resolved.accent_custom,
    resolved.background_color,
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
      setBackgroundColor: (background_color) =>
        patch({ background_color: normalizeHexColor(background_color) }),
      setLanguage: (language) => patch({ language }),
      setThemeMode: (theme) => patch({ theme }),
      setHideTitleBar: (hide_title_bar) => patch({ hide_title_bar }),
      setMobileCardMode: (mobile_card_mode) => patch({ mobile_card_mode }),
      setMobileAutoCarousel: (mobile_auto_carousel) => patch({ mobile_auto_carousel }),
      setMobileCarouselInterval: (mobile_carousel_interval_s) =>
        patch({ mobile_carousel_interval_s }),
      setPhotoAlbumEnabled: (photo_album_enabled) => patch({ photo_album_enabled, ...(photo_album_enabled ? { audio_visualizer_enabled: false } : {}) }),
      setPhotoAlbumEffect: (photo_album_effect) => patch({ photo_album_effect }),
      setAudioVisualizerEnabled: (audio_visualizer_enabled) => patch({ audio_visualizer_enabled, ...(audio_visualizer_enabled ? { photo_album_enabled: false } : {}) }),
      setAudioDeviceId: (audio_device_id) => patch({ audio_device_id }),
      setAudioVisualizerMode: (audio_visualizer_mode) => patch({ audio_visualizer_mode }),
      setAudioColorMode: (audio_color_mode) => patch({ audio_color_mode }),
      setAudioColors: (audio_color_primary, audio_color_secondary) => patch({ audio_color_primary: normalizeHexColor(audio_color_primary), audio_color_secondary: normalizeHexColor(audio_color_secondary) }),
      setAudioAmplitude: (audio_amplitude) => patch({ audio_amplitude }),
      setAudioSmoothing: (audio_smoothing) => patch({ audio_smoothing }),
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

export const BACKGROUND_OPTIONS: { id: string; labelKey: "backgroundSignal" | "backgroundOcean" | "backgroundSlate" | "backgroundPlum" | "backgroundSand"; swatch: string }[] = [
  { id: "signal", labelKey: "backgroundSignal", swatch: "#0b1a20" },
  { id: "ocean", labelKey: "backgroundOcean", swatch: "#082f49" },
  { id: "slate", labelKey: "backgroundSlate", swatch: "#17202a" },
  { id: "plum", labelKey: "backgroundPlum", swatch: "#211a2d" },
  { id: "sand", labelKey: "backgroundSand", swatch: "#f4efe7" },
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
