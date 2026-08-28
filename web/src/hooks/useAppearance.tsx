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
import type { AccentId, AppConfig, AudioColorMode, AudioVisualizerMode, ClockDotShape, ClockStyle, Lang, Model3dClockPosition, Model3dId, Model3dOrbitStyle, Model3dTreeBaseShape, Model3dTreeCanopyShape, PhotoAlbumEffect, ThemeMode, TownDensity, TownFavorite, TownPopulation, TownTime, UiStyle } from "@/types";
import {
  ACCENT_PRESETS,
  CLOCK_DOT_SHAPES,
  CLOCK_STYLES,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BLACKHOLE_COLOR,
  DEFAULT_BLACKHOLE_SPIN_SPEED,
  DEFAULT_GLASS_GRADIENT_END,
  DEFAULT_GLASS_GRADIENT_START,
  DEFAULT_ACCENT_CUSTOM,
  DEFAULT_CONFIG,
  DEFAULT_MODEL3D_CLOCK_POSITION,
  DEFAULT_MODEL3D_TREE_BASE_COLOR,
  DEFAULT_MODEL3D_TREE_CANOPY_COLOR,
  DEFAULT_MODEL3D_TREE_TRUNK_COLOR,
  DEFAULT_MODEL3D_TOWN_DENSITY,
  DEFAULT_MODEL3D_TOWN_POPULATION,
  DEFAULT_MODEL3D_TOWN_SEED,
  DEFAULT_MODEL3D_TOWN_TIME,
  MODEL3D_TOWN_GENERATOR_VERSION,
  MODEL3D_CLOCK_POSITIONS,
  MODEL3D_IDS,
  MODEL3D_ORBIT_STYLES,
  MODEL3D_TREE_BASE_SHAPES,
  MODEL3D_TREE_CANOPY_SHAPES,
  UI_STYLES,
} from "@/types";

export type { AccentId, Lang, UiStyle };
export { DEFAULT_BLACKHOLE_COLOR, DEFAULT_BLACKHOLE_SPIN_SPEED, DEFAULT_MODEL3D_TREE_BASE_COLOR, DEFAULT_MODEL3D_TREE_CANOPY_COLOR, DEFAULT_MODEL3D_TREE_TRUNK_COLOR };
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

export function normalizeHexColor(
  raw: string | null | undefined,
  fallback = DEFAULT_ACCENT_CUSTOM,
): string {
  const s = (raw ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return fallback;
}

function normalizeTownSeed(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  return /^[0-9a-fA-F]{8}$/.test(value) ? value.toLowerCase() : DEFAULT_MODEL3D_TOWN_SEED;
}

function normalizeTownFavorite(raw: Partial<TownFavorite> | null | undefined): TownFavorite | null {
  if (!raw) return null;
  const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 128) : "";
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "";
  if (!id || !name) return null;
  const population = (['low', 'medium', 'high'] as const).includes(raw.population as TownPopulation)
    ? raw.population as TownPopulation
    : DEFAULT_MODEL3D_TOWN_POPULATION;
  const density = (['low', 'medium', 'high'] as const).includes(raw.density as TownDensity)
    ? raw.density as TownDensity
    : DEFAULT_MODEL3D_TOWN_DENSITY;
  const time = (['day', 'night'] as const).includes(raw.time as TownTime)
    ? raw.time as TownTime
    : DEFAULT_MODEL3D_TOWN_TIME;
  return {
    id,
    name,
    seed: normalizeTownSeed(raw.seed),
    generator_version: Number.isFinite(Number(raw.generator_version)) && Number(raw.generator_version) > 0
      ? Math.floor(Number(raw.generator_version))
      : MODEL3D_TOWN_GENERATOR_VERSION,
    population,
    density,
    time,
  };
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
    glass_gradient_start: normalizeHexColor(
      base.glass_gradient_start || DEFAULT_GLASS_GRADIENT_START,
      DEFAULT_GLASS_GRADIENT_START,
    ),
    glass_gradient_end: normalizeHexColor(
      base.glass_gradient_end || DEFAULT_GLASS_GRADIENT_END,
      DEFAULT_GLASS_GRADIENT_END,
    ),
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
    music_album_enabled: Boolean(base.music_album_enabled),
    illustration_enabled: Boolean(base.illustration_enabled),
    clock_enabled: Boolean(base.clock_enabled),
    clock_style: CLOCK_STYLES.includes(base.clock_style as ClockStyle)
      ? (base.clock_style as ClockStyle)
      : "lines",
    clock_show_week: base.clock_show_week !== false,
    clock_show_date: base.clock_show_date !== false,
    clock_show_seconds: base.clock_show_seconds !== false,
    clock_dot_shape: CLOCK_DOT_SHAPES.includes(base.clock_dot_shape as ClockDotShape)
      ? (base.clock_dot_shape as ClockDotShape)
      : "circle",
    audio_visualizer_enabled: Boolean(base.audio_visualizer_enabled),
    audio_device_id: typeof base.audio_device_id === "string" && base.audio_device_id.trim() ? base.audio_device_id : null,
    audio_visualizer_mode: (["particles", "grid", "aurora", "radial", "city3d", "nebula3d", "terrain3d", "crystal3d"] as const).includes(base.audio_visualizer_mode as AudioVisualizerMode) ? base.audio_visualizer_mode as AudioVisualizerMode : "particles",
    audio_color_mode: (["single", "gradient"] as const).includes(base.audio_color_mode as AudioColorMode) ? base.audio_color_mode as AudioColorMode : "gradient",
    audio_color_primary: normalizeHexColor(base.audio_color_primary || "#22d3ee"),
    audio_color_secondary: normalizeHexColor(base.audio_color_secondary || "#a855f7"),
    audio_amplitude: Number.isFinite(Number(base.audio_amplitude)) ? Math.min(2, Math.max(0.5, Number(base.audio_amplitude))) : 1,
    audio_smoothing: Number.isFinite(Number(base.audio_smoothing)) ? Math.min(0.9, Math.max(0, Number(base.audio_smoothing))) : 0.65,
    blackhole_enabled: Boolean(base.blackhole_enabled),
    blackhole_color: normalizeHexColor(base.blackhole_color, DEFAULT_BLACKHOLE_COLOR),
    blackhole_interactive: Boolean(base.blackhole_interactive),
    blackhole_spin_speed: Number.isFinite(Number(base.blackhole_spin_speed))
      ? Math.min(3, Math.max(0, Number(base.blackhole_spin_speed)))
      : DEFAULT_BLACKHOLE_SPIN_SPEED,
    model3d_enabled: Boolean(base.model3d_enabled),
    model3d_id: MODEL3D_IDS.includes(base.model3d_id as Model3dId)
      ? (base.model3d_id as Model3dId)
      : "solar_system",
    model3d_orbit_style: MODEL3D_ORBIT_STYLES.includes(base.model3d_orbit_style as Model3dOrbitStyle)
      ? (base.model3d_orbit_style as Model3dOrbitStyle)
      : "solid",
    model3d_textures_enabled: base.model3d_textures_enabled !== false,
    model3d_tree_canopy_shape: MODEL3D_TREE_CANOPY_SHAPES.includes(base.model3d_tree_canopy_shape as Model3dTreeCanopyShape)
      ? (base.model3d_tree_canopy_shape as Model3dTreeCanopyShape)
      : "layered",
    model3d_tree_canopy_color: normalizeHexColor(base.model3d_tree_canopy_color, DEFAULT_MODEL3D_TREE_CANOPY_COLOR),
    model3d_tree_base_shape: MODEL3D_TREE_BASE_SHAPES.includes(base.model3d_tree_base_shape as Model3dTreeBaseShape)
      ? (base.model3d_tree_base_shape as Model3dTreeBaseShape)
      : "square",
    model3d_tree_base_color: normalizeHexColor(base.model3d_tree_base_color, DEFAULT_MODEL3D_TREE_BASE_COLOR),
    model3d_tree_trunk_color: normalizeHexColor(base.model3d_tree_trunk_color, DEFAULT_MODEL3D_TREE_TRUNK_COLOR),
    model3d_town_seed: normalizeTownSeed(base.model3d_town_seed),
    model3d_town_generator_version:
      Number.isFinite(Number(base.model3d_town_generator_version)) && Number(base.model3d_town_generator_version) > 0
        ? Math.floor(Number(base.model3d_town_generator_version))
        : MODEL3D_TOWN_GENERATOR_VERSION,
    model3d_town_population: (['low', 'medium', 'high'] as const).includes(base.model3d_town_population as TownPopulation)
      ? base.model3d_town_population as TownPopulation
      : DEFAULT_MODEL3D_TOWN_POPULATION,
    model3d_town_density: (['low', 'medium', 'high'] as const).includes(base.model3d_town_density as TownDensity)
      ? base.model3d_town_density as TownDensity
      : DEFAULT_MODEL3D_TOWN_DENSITY,
    model3d_town_time: (['day', 'night'] as const).includes(base.model3d_town_time as TownTime)
      ? base.model3d_town_time as TownTime
      : DEFAULT_MODEL3D_TOWN_TIME,
    model3d_town_favorites: (Array.isArray(base.model3d_town_favorites) ? base.model3d_town_favorites : [])
      .map((favorite) => normalizeTownFavorite(favorite))
      .filter((favorite): favorite is TownFavorite => favorite != null)
      .slice(0, 50),
    model3d_clock_enabled: Boolean(base.model3d_clock_enabled),
    model3d_clock_position: MODEL3D_CLOCK_POSITIONS.includes(base.model3d_clock_position as Model3dClockPosition)
      ? base.model3d_clock_position as Model3dClockPosition
      : DEFAULT_MODEL3D_CLOCK_POSITION,
    model3d_clock_show_date: base.model3d_clock_show_date !== false,
    model3d_clock_show_seconds: base.model3d_clock_show_seconds !== false,
  };
}

function randomTownSeed(): string {
  const values = new Uint32Array(1);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(values);
    return values[0].toString(16).padStart(8, "0");
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0).toString(16).padStart(8, "0");
}

function townFavoriteId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(16)}`;
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

function applyGlassGradient(start: string, end: string) {
  const root = document.documentElement;
  root.style.setProperty(
    "--vf-glass-gradient-start",
    normalizeHexColor(start, DEFAULT_GLASS_GRADIENT_START),
  );
  root.style.setProperty(
    "--vf-glass-gradient-end",
    normalizeHexColor(end, DEFAULT_GLASS_GRADIENT_END),
  );
}

interface AppearanceContextValue {
  config: AppConfig;
  synced: boolean;
  setUiStyle: (v: UiStyle) => void;
  setAccent: (v: AccentId) => void;
  setAccentCustom: (hex: string) => void;
  setBackgroundColor: (hex: string) => void;
  setGlassGradient: (start: string, end: string) => void;
  setLanguage: (v: Lang) => void;
  setThemeMode: (v: ThemeMode) => void;
  setHideTitleBar: (v: boolean) => void;
  setMobileCardMode: (v: boolean) => void;
  setMobileAutoCarousel: (v: boolean) => void;
  setMobileCarouselInterval: (v: number) => void;
  setPhotoAlbumEnabled: (v: boolean) => void;
  setPhotoAlbumEffect: (v: PhotoAlbumEffect) => void;
  setMusicAlbumEnabled: (v: boolean) => void;
  setIllustrationEnabled: (v: boolean) => void;
  activateMusicAlbum: (id: string) => void;
  setActiveMusicAlbumId: (v: string | null) => void;
  setClockEnabled: (v: boolean) => void;
  setClockStyle: (v: ClockStyle) => void;
  setClockShowWeek: (v: boolean) => void;
  setClockShowDate: (v: boolean) => void;
  setClockShowSeconds: (v: boolean) => void;
  setClockDotShape: (v: ClockDotShape) => void;
  setAudioVisualizerEnabled: (v: boolean) => void;
  setAudioDeviceId: (v: string | null) => void;
  setAudioVisualizerMode: (v: AudioVisualizerMode) => void;
  setAudioColorMode: (v: AudioColorMode) => void;
  setAudioColors: (primary: string, secondary: string) => void;
  setAudioAmplitude: (v: number) => void;
  setAudioSmoothing: (v: number) => void;
  setBlackholeEnabled: (v: boolean) => void;
  setBlackholeColor: (hex: string) => void;
  setBlackholeInteractive: (v: boolean) => void;
  setBlackholeSpinSpeed: (v: number) => void;
  setModel3dEnabled: (v: boolean) => void;
  setModel3dId: (v: Model3dId) => void;
  setModel3dOrbitStyle: (v: Model3dOrbitStyle) => void;
  setModel3dTexturesEnabled: (v: boolean) => void;
  setModel3dTreeCanopyShape: (v: Model3dTreeCanopyShape) => void;
  setModel3dTreeCanopyColor: (hex: string) => void;
  setModel3dTreeBaseShape: (v: Model3dTreeBaseShape) => void;
  setModel3dTreeBaseColor: (hex: string) => void;
  setModel3dTreeTrunkColor: (hex: string) => void;
  setModel3dTownSeed: (seed: string) => void;
  randomizeModel3dTown: () => void;
  setModel3dTownPopulation: (v: TownPopulation) => void;
  setModel3dTownDensity: (v: TownDensity) => void;
  setModel3dTownTime: (v: TownTime) => void;
  setModel3dClockEnabled: (v: boolean) => void;
  setModel3dClockPosition: (v: Model3dClockPosition) => void;
  setModel3dClockShowDate: (v: boolean) => void;
  setModel3dClockShowSeconds: (v: boolean) => void;
  saveModel3dTownFavorite: (name: string) => void;
  loadModel3dTownFavorite: (favorite: TownFavorite) => void;
  removeModel3dTownFavorite: (id: string) => void;
  t: TFunction;
  lang: Lang;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function exclusiveFullscreen(enabled: Partial<AppConfig>): Partial<AppConfig> {
  return {
    photo_album_enabled: false,
    music_album_enabled: false,
    illustration_enabled: false,
    audio_visualizer_enabled: false,
    clock_enabled: false,
    blackhole_enabled: false,
    model3d_enabled: false,
    ...enabled,
  };
}

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
    applyGlassGradient(resolved.glass_gradient_start, resolved.glass_gradient_end);
    document.documentElement.dataset.uiStyle = resolved.ui_style;
    document.documentElement.lang = resolved.language === "en" ? "en" : "zh-CN";
    setTheme(resolved.theme);
  }, [
    resolved.accent,
    resolved.accent_custom,
    resolved.background_color,
    resolved.glass_gradient_start,
    resolved.glass_gradient_end,
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
      setGlassGradient: (glass_gradient_start, glass_gradient_end) =>
        patch({
          glass_gradient_start: normalizeHexColor(
            glass_gradient_start,
            DEFAULT_GLASS_GRADIENT_START,
          ),
          glass_gradient_end: normalizeHexColor(
            glass_gradient_end,
            DEFAULT_GLASS_GRADIENT_END,
          ),
        }),
      setLanguage: (language) => patch({ language }),
      setThemeMode: (theme) => patch({ theme }),
      setHideTitleBar: (hide_title_bar) => patch({ hide_title_bar }),
      setMobileCardMode: (mobile_card_mode) => patch({ mobile_card_mode }),
      setMobileAutoCarousel: (mobile_auto_carousel) => patch({ mobile_auto_carousel }),
      setMobileCarouselInterval: (mobile_carousel_interval_s) =>
        patch({ mobile_carousel_interval_s }),
      setPhotoAlbumEnabled: (photo_album_enabled) =>
        patch(photo_album_enabled ? exclusiveFullscreen({ photo_album_enabled: true }) : { photo_album_enabled }),
      setPhotoAlbumEffect: (photo_album_effect) => patch({ photo_album_effect }),
      setMusicAlbumEnabled: (music_album_enabled) =>
        patch(music_album_enabled ? exclusiveFullscreen({ music_album_enabled: true }) : { music_album_enabled }),
      setIllustrationEnabled: (illustration_enabled) =>
        patch(illustration_enabled ? exclusiveFullscreen({ illustration_enabled: true }) : { illustration_enabled }),
      activateMusicAlbum: (active_music_album_id) =>
        patch(exclusiveFullscreen({ active_music_album_id, music_album_enabled: true })),
      setActiveMusicAlbumId: (active_music_album_id) => patch({ active_music_album_id }),
      setClockEnabled: (clock_enabled) =>
        patch(clock_enabled ? exclusiveFullscreen({ clock_enabled: true }) : { clock_enabled }),
      setClockStyle: (clock_style) => patch({ clock_style }),
      setClockShowWeek: (clock_show_week) => patch({ clock_show_week }),
      setClockShowDate: (clock_show_date) => patch({ clock_show_date }),
      setClockShowSeconds: (clock_show_seconds) => patch({ clock_show_seconds }),
      setClockDotShape: (clock_dot_shape) => patch({ clock_dot_shape }),
      setAudioVisualizerEnabled: (audio_visualizer_enabled) =>
        patch(
          audio_visualizer_enabled
            ? exclusiveFullscreen({ audio_visualizer_enabled: true })
            : { audio_visualizer_enabled },
        ),
      setAudioDeviceId: (audio_device_id) => patch({ audio_device_id }),
      setAudioVisualizerMode: (audio_visualizer_mode) => patch({ audio_visualizer_mode }),
      setAudioColorMode: (audio_color_mode) => patch({ audio_color_mode }),
      setAudioColors: (audio_color_primary, audio_color_secondary) => patch({ audio_color_primary: normalizeHexColor(audio_color_primary), audio_color_secondary: normalizeHexColor(audio_color_secondary) }),
      setAudioAmplitude: (audio_amplitude) => patch({ audio_amplitude }),
      setAudioSmoothing: (audio_smoothing) => patch({ audio_smoothing }),
      setBlackholeEnabled: (blackhole_enabled) =>
        patch(blackhole_enabled ? exclusiveFullscreen({ blackhole_enabled: true }) : { blackhole_enabled }),
      setBlackholeColor: (hex) => patch({ blackhole_color: normalizeHexColor(hex, DEFAULT_BLACKHOLE_COLOR) }),
      setBlackholeInteractive: (blackhole_interactive) => patch({ blackhole_interactive }),
      setBlackholeSpinSpeed: (blackhole_spin_speed) => patch({ blackhole_spin_speed }),
      setModel3dEnabled: (model3d_enabled) =>
        patch(model3d_enabled ? exclusiveFullscreen({ model3d_enabled: true }) : { model3d_enabled }),
      setModel3dId: (model3d_id) => patch({ model3d_id }),
      setModel3dOrbitStyle: (model3d_orbit_style) => patch({ model3d_orbit_style }),
      setModel3dTexturesEnabled: (model3d_textures_enabled) => patch({ model3d_textures_enabled }),
      setModel3dTreeCanopyShape: (model3d_tree_canopy_shape) => patch({ model3d_tree_canopy_shape }),
      setModel3dTreeCanopyColor: (hex) =>
        patch({ model3d_tree_canopy_color: normalizeHexColor(hex, DEFAULT_MODEL3D_TREE_CANOPY_COLOR) }),
      setModel3dTreeBaseShape: (model3d_tree_base_shape) => patch({ model3d_tree_base_shape }),
      setModel3dTreeBaseColor: (hex) =>
        patch({ model3d_tree_base_color: normalizeHexColor(hex, DEFAULT_MODEL3D_TREE_BASE_COLOR) }),
      setModel3dTreeTrunkColor: (hex) =>
        patch({ model3d_tree_trunk_color: normalizeHexColor(hex, DEFAULT_MODEL3D_TREE_TRUNK_COLOR) }),
      setModel3dTownSeed: (model3d_town_seed) =>
        patch({ model3d_town_seed: normalizeTownSeed(model3d_town_seed) }),
      randomizeModel3dTown: () =>
        patch({
          model3d_town_seed: randomTownSeed(),
          model3d_town_generator_version: MODEL3D_TOWN_GENERATOR_VERSION,
        }),
      setModel3dTownPopulation: (model3d_town_population) => patch({ model3d_town_population }),
      setModel3dTownDensity: (model3d_town_density) => patch({ model3d_town_density }),
      setModel3dTownTime: (model3d_town_time) => patch({ model3d_town_time }),
      setModel3dClockEnabled: (model3d_clock_enabled) => patch({ model3d_clock_enabled }),
      setModel3dClockPosition: (model3d_clock_position) => patch({ model3d_clock_position }),
      setModel3dClockShowDate: (model3d_clock_show_date) => patch({ model3d_clock_show_date }),
      setModel3dClockShowSeconds: (model3d_clock_show_seconds) => patch({ model3d_clock_show_seconds }),
      saveModel3dTownFavorite: (name) => {
        const normalized = name.trim().slice(0, 40);
        if (!normalized || resolved.model3d_town_favorites.length >= 50) return;
        if (resolved.model3d_town_favorites.some((favorite) => favorite.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) return;
        const favorite: TownFavorite = {
          id: townFavoriteId(),
          name: normalized,
          seed: resolved.model3d_town_seed,
          generator_version: resolved.model3d_town_generator_version,
          population: resolved.model3d_town_population,
          density: resolved.model3d_town_density,
          time: resolved.model3d_town_time,
        };
        patch({ model3d_town_favorites: [...resolved.model3d_town_favorites, favorite] });
      },
      loadModel3dTownFavorite: (favorite) =>
        patch({
          model3d_id: "town",
          model3d_town_seed: normalizeTownSeed(favorite.seed),
          model3d_town_generator_version: favorite.generator_version,
          model3d_town_population: favorite.population,
          model3d_town_density: favorite.density,
          model3d_town_time: favorite.time,
        }),
      removeModel3dTownFavorite: (id) =>
        patch({ model3d_town_favorites: resolved.model3d_town_favorites.filter((favorite) => favorite.id !== id) }),
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

export const GLASS_GRADIENT_OPTIONS: {
  id: string;
  labelKey: "glassGradientMorning" | "glassGradientGlacier" | "glassGradientMint";
  start: string;
  end: string;
}[] = [
  {
    id: "morning",
    labelKey: "glassGradientMorning",
    start: DEFAULT_GLASS_GRADIENT_START,
    end: DEFAULT_GLASS_GRADIENT_END,
  },
  {
    id: "glacier",
    labelKey: "glassGradientGlacier",
    start: "#d9f2ff",
    end: "#dbe8ff",
  },
  {
    id: "mint",
    labelKey: "glassGradientMint",
    start: "#e0f7f4",
    end: "#bdebd8",
  },
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
