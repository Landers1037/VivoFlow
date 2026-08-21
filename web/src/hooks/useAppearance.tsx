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
import { DEFAULT_CONFIG } from "@/types";

export type { AccentId, Lang, UiStyle };
export type TFunction = (key: MessageKey, vars?: TranslateVars) => string;

const ACCENT_HUES: Record<AccentId, { light: string; dark: string; ringLight: string; ringDark: string }> = {
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

function normalizeConfig(raw: AppConfig | null | undefined): AppConfig {
  const base = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  const accents: AccentId[] = ["teal", "zinc", "blue", "violet", "amber"];
  const themes: ThemeMode[] = ["light", "dark", "system"];
  const langs: Lang[] = ["zh", "en"];
  return {
    ...base,
    enabled: { ...DEFAULT_CONFIG.enabled, ...(raw?.enabled ?? {}) },
    ui_style: base.ui_style === "amicro" ? "amicro" : "amicro",
    accent: accents.includes(base.accent as AccentId) ? (base.accent as AccentId) : "teal",
    theme: themes.includes(base.theme as ThemeMode) ? (base.theme as ThemeMode) : "system",
    language: langs.includes(base.language as Lang) ? (base.language as Lang) : "zh",
  };
}

function applyAccent(accent: AccentId) {
  const root = document.documentElement;
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
  setLanguage: (v: Lang) => void;
  setThemeMode: (v: ThemeMode) => void;
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
    applyAccent(resolved.accent);
    document.documentElement.lang = resolved.language === "en" ? "en" : "zh-CN";
    setTheme(resolved.theme);
  }, [resolved.accent, resolved.language, resolved.theme, setTheme]);

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
      setLanguage: (language) => patch({ language }),
      setThemeMode: (theme) => patch({ theme }),
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

export const ACCENT_OPTIONS: { id: AccentId; label: string; swatch: string }[] = [
  { id: "teal", label: "Teal", swatch: "#5eead4" },
  { id: "zinc", label: "Zinc", swatch: "#a1a1aa" },
  { id: "blue", label: "Blue", swatch: "#60a5fa" },
  { id: "violet", label: "Violet", swatch: "#c084fc" },
  { id: "amber", label: "Amber", swatch: "#fbbf24" },
];
