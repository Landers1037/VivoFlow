export interface EnabledModules {
  cpu: boolean;
  memory: boolean;
  gpu: boolean;
  disk: boolean;
  network: boolean;
}

export type UiStyle =
  | "amicro"
  | "neumorph"
  | "line"
  | "glass"
  | "console"
  | "paper"
  | "instrument"
  | "dense"
  | "clay"
  | "metal"
  | "ink"
  | "swiss"
  | "hud"
  | "editorial";

export type AccentId = "teal" | "zinc" | "blue" | "violet" | "amber" | "custom";
export type ThemeMode = "light" | "dark" | "system";
export type Lang = "zh" | "en";
export type PhotoAlbumEffect = "single" | "time_machine" | "cover_flow";
export type MusicAlbumEffect = "off" | "ripple" | "bars" | "particles" | "turntable";
export const MUSIC_ALBUM_EFFECTS: MusicAlbumEffect[] = ["off", "ripple", "bars", "particles", "turntable"];
export type PixelArtPreset = "auto" | "balanced" | "detailed" | "retro" | "painting" | "8bit" | "custom";
export type DitheringMode = "none" | "ordered" | "floyd_steinberg";
export type ClockStyle = "lines" | "dial" | "pixel" | "flip" | "object" | "dots";
export type ClockDotShape = "circle" | "square" | "rounded" | "star";
export const CLOCK_TIMEZONE_OFFSETS_MINUTES = [
  -720, -660, -600, -570, -540, -480, -420, -360, -300, -240, -210, -180, -120, -60,
  0, 60, 120, 180, 210, 240, 270, 300, 330, 345, 360, 390, 420, 480, 525, 540, 570,
  600, 630, 660, 720, 765, 780, 840,
] as const;
export type ClockTimezoneOffsetMinutes = (typeof CLOCK_TIMEZONE_OFFSETS_MINUTES)[number];
export const DEFAULT_CLOCK_TIMEZONE_OFFSET_MINUTES: ClockTimezoneOffsetMinutes = 480;

export function formatClockTimezoneOffset(offsetMinutes: number) {
  const sign = offsetMinutes < 0 ? "−" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60).toString().padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

export type AudioVisualizerMode =
  | "particles"
  | "grid"
  | "aurora"
  | "radial"
  | "bars"
  | "city3d"
  | "nebula3d"
  | "terrain3d"
  | "crystal3d";

export type ThreeAudioVisualizerMode = Extract<AudioVisualizerMode, `${string}3d`>;

export const THREE_AUDIO_MODES: ThreeAudioVisualizerMode[] = [
  "city3d",
  "nebula3d",
  "terrain3d",
  "crystal3d",
];

export function isThreeAudioMode(mode: AudioVisualizerMode): mode is ThreeAudioVisualizerMode {
  return THREE_AUDIO_MODES.includes(mode as ThreeAudioVisualizerMode);
}

export type Model3dId = "solar_system" | "tree" | "town";

export type Model2dId = "village" | "cyber_city" | "garden" | "rain_room";

export const MODEL2D_IDS: Model2dId[] = ["village", "cyber_city", "garden", "rain_room"];

export const MODEL3D_IDS: Model3dId[] = ["solar_system", "tree", "town"];

export function isModel3dId(id: string): id is Model3dId {
  return MODEL3D_IDS.includes(id as Model3dId);
}

export type Model3dClockPosition =
  | "top_left"
  | "top_center"
  | "top_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right";

export const MODEL3D_CLOCK_POSITIONS: Model3dClockPosition[] = [
  "top_left",
  "top_center",
  "top_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
];

export const DEFAULT_MODEL3D_CLOCK_POSITION: Model3dClockPosition = "top_right";

export type Model3dOrbitStyle = "solid" | "dashed" | "hidden";

export const MODEL3D_ORBIT_STYLES: Model3dOrbitStyle[] = ["solid", "dashed", "hidden"];

export type Model3dTreeCanopyShape = "round" | "cone" | "layered";
export type Model3dTreeBaseShape = "square" | "circle" | "heart";

export const MODEL3D_TREE_CANOPY_SHAPES: Model3dTreeCanopyShape[] = ["round", "cone", "layered"];
export const MODEL3D_TREE_BASE_SHAPES: Model3dTreeBaseShape[] = ["square", "circle", "heart"];

export const DEFAULT_MODEL3D_TREE_CANOPY_COLOR = "#e07a28";
export const DEFAULT_MODEL3D_TREE_BASE_COLOR = "#8f98a3";
export const DEFAULT_MODEL3D_TREE_TRUNK_COLOR = "#4a301c";

export type TownPopulation = "low" | "medium" | "high";
export type TownDensity = "low" | "medium" | "high";
export type TownTime = "day" | "night";

export const MODEL3D_TOWN_GENERATOR_VERSION = 1;
export const DEFAULT_MODEL3D_TOWN_SEED = "6f3a9c21";
export const DEFAULT_MODEL3D_TOWN_POPULATION: TownPopulation = "medium";
export const DEFAULT_MODEL3D_TOWN_DENSITY: TownDensity = "medium";
export const DEFAULT_MODEL3D_TOWN_TIME: TownTime = "day";

export interface TownFavorite {
  id: string;
  name: string;
  seed: string;
  generator_version: number;
  population: TownPopulation;
  density: TownDensity;
  time: TownTime;
}
export type AudioColorMode = "single" | "gradient";

export const UI_STYLES: UiStyle[] = [
  "amicro",
  "neumorph",
  "line",
  "glass",
  "console",
  "paper",
  "instrument",
  "dense",
  "clay",
  "metal",
  "ink",
  "swiss",
  "hud",
  "editorial",
];

export const CLOCK_STYLES: ClockStyle[] = ["lines", "dial", "pixel", "flip", "object", "dots"];
export const CLOCK_DOT_SHAPES: ClockDotShape[] = ["circle", "square", "rounded", "star"];

export const ACCENT_PRESETS: Exclude<AccentId, "custom">[] = [
  "teal",
  "zinc",
  "blue",
  "violet",
  "amber",
];

export const DEFAULT_ACCENT_CUSTOM = "#0d9488";
export const DEFAULT_BACKGROUND_COLOR = "#0b1a20";
export const DEFAULT_GLASS_GRADIENT_START = "#d9f8ff";
export const DEFAULT_GLASS_GRADIENT_END = "#d7f4ee";
export const DEFAULT_BLACKHOLE_COLOR = "#e8c09a";
export const DEFAULT_BLACKHOLE_SPIN_SPEED = 1;

export interface AppConfig {
  interval_ms: number;
  enabled: EnabledModules;
  history_points: number;
  ui_style: UiStyle;
  accent: AccentId;
  /** `#RRGGBB`，当 `accent === "custom"` 时生效 */
  accent_custom: string;
  /** `#RRGGBB`，作为应用背景基色，随明暗主题混合 */
  background_color: string;
  /** `#RRGGBB`，毛玻璃背景渐变的起始色 */
  glass_gradient_start: string;
  /** `#RRGGBB`，毛玻璃背景渐变的结束色 */
  glass_gradient_end: string;
  theme: ThemeMode;
  language: Lang;
  hide_title_bar: boolean;
  mobile_card_mode: boolean;
  mobile_auto_carousel: boolean;
  mobile_carousel_interval_s: number;
  photo_album_enabled: boolean;
  photo_album_effect: PhotoAlbumEffect;
  music_album_enabled: boolean;
  music_album_effect: MusicAlbumEffect;
  illustration_enabled: boolean;
  active_music_album_id: string | null;
  clock_enabled: boolean;
  clock_style: ClockStyle;
  clock_timezone_offset_minutes: ClockTimezoneOffsetMinutes;
  clock_show_week: boolean;
  clock_show_date: boolean;
  clock_show_seconds: boolean;
  clock_dot_shape: ClockDotShape;
  audio_visualizer_enabled: boolean;
  audio_device_id: string | null;
  audio_visualizer_mode: AudioVisualizerMode;
  audio_color_mode: AudioColorMode;
  audio_color_primary: string;
  audio_color_secondary: string;
  audio_amplitude: number;
  audio_smoothing: number;
  blackhole_enabled: boolean;
  /** `#RRGGBB`，吸积盘色，当前画面为默认暖色 */
  blackhole_color: string;
  blackhole_interactive: boolean;
  /** 旋转速度倍率，`1` 为当前默认慢旋 */
  blackhole_spin_speed: number;
  model2d_enabled: boolean;
  model2d_id: Model2dId;
  model3d_enabled: boolean;
  model3d_id: Model3dId;
  model3d_orbit_style: Model3dOrbitStyle;
  model3d_textures_enabled: boolean;
  model3d_tree_canopy_shape: Model3dTreeCanopyShape;
  model3d_tree_canopy_color: string;
  model3d_tree_base_shape: Model3dTreeBaseShape;
  model3d_tree_base_color: string;
  model3d_tree_trunk_color: string;
  model3d_town_seed: string;
  model3d_town_generator_version: number;
  model3d_town_population: TownPopulation;
  model3d_town_density: TownDensity;
  model3d_town_time: TownTime;
  model3d_town_favorites: TownFavorite[];
  model3d_clock_enabled: boolean;
  model3d_clock_position: Model3dClockPosition;
  model3d_clock_show_date: boolean;
  model3d_clock_show_seconds: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  interval_ms: 1000,
  history_points: 60,
  enabled: { cpu: true, memory: true, gpu: true, disk: true, network: true },
  ui_style: "amicro",
  accent: "teal",
  accent_custom: DEFAULT_ACCENT_CUSTOM,
  background_color: DEFAULT_BACKGROUND_COLOR,
  glass_gradient_start: DEFAULT_GLASS_GRADIENT_START,
  glass_gradient_end: DEFAULT_GLASS_GRADIENT_END,
  theme: "system",
  language: "zh",
  hide_title_bar: false,
  mobile_card_mode: false,
  mobile_auto_carousel: true,
  mobile_carousel_interval_s: 10,
  photo_album_enabled: false,
  photo_album_effect: "single",
  music_album_enabled: false,
  music_album_effect: "off",
  illustration_enabled: false,
  active_music_album_id: null,
  clock_enabled: false,
  clock_style: "lines",
  clock_timezone_offset_minutes: DEFAULT_CLOCK_TIMEZONE_OFFSET_MINUTES,
  clock_show_week: true,
  clock_show_date: true,
  clock_show_seconds: true,
  clock_dot_shape: "circle",
  audio_visualizer_enabled: false,
  audio_device_id: null,
  audio_visualizer_mode: "particles",
  audio_color_mode: "gradient",
  audio_color_primary: "#22d3ee",
  audio_color_secondary: "#a855f7",
  audio_amplitude: 1,
  audio_smoothing: 0.65,
  blackhole_enabled: false,
  blackhole_color: DEFAULT_BLACKHOLE_COLOR,
  blackhole_interactive: false,
  blackhole_spin_speed: DEFAULT_BLACKHOLE_SPIN_SPEED,
  model2d_enabled: false,
  model2d_id: "village",
  model3d_enabled: false,
  model3d_id: "solar_system",
  model3d_orbit_style: "solid",
  model3d_textures_enabled: true,
  model3d_tree_canopy_shape: "layered",
  model3d_tree_canopy_color: DEFAULT_MODEL3D_TREE_CANOPY_COLOR,
  model3d_tree_base_shape: "square",
  model3d_tree_base_color: DEFAULT_MODEL3D_TREE_BASE_COLOR,
  model3d_tree_trunk_color: DEFAULT_MODEL3D_TREE_TRUNK_COLOR,
  model3d_town_seed: DEFAULT_MODEL3D_TOWN_SEED,
  model3d_town_generator_version: MODEL3D_TOWN_GENERATOR_VERSION,
  model3d_town_population: DEFAULT_MODEL3D_TOWN_POPULATION,
  model3d_town_density: DEFAULT_MODEL3D_TOWN_DENSITY,
  model3d_town_time: DEFAULT_MODEL3D_TOWN_TIME,
  model3d_town_favorites: [],
  model3d_clock_enabled: false,
  model3d_clock_position: DEFAULT_MODEL3D_CLOCK_POSITION,
  model3d_clock_show_date: true,
  model3d_clock_show_seconds: true,
};

export interface AudioDevice { id: string; name: string; is_default: boolean; }
export interface AudioFrame {
  type: "audio_frame"; seq: number; ts: number; bins: number[]; rms: number; peak: number; beat: boolean;
}
export interface AudioStatus {
  type: "audio_status";
  state: "disabled" | "capturing" | "fallback" | "error";
  selected_device_id: string | null;
  active_device_id: string | null;
  reason: string | null;
}

export interface AlbumImage {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  content_url: string;
}

export interface PixelArtSettings {
  interval_s: number;
  shuffle: boolean;
  preset: PixelArtPreset;
  target_short_edge: number;
  palette_size: number;
  smoothing: number;
  contrast: number;
  saturation: number;
  gamma: number;
  dithering: DitheringMode;
  dithering_strength: number;
  edge_enhancement: number;
  sharpen: number;
}

export interface IllustrationImage {
  id: string;
  version: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  content_url: string;
}

export interface IllustrationsResponse {
  settings: PixelArtSettings;
  images: IllustrationImage[];
}

export interface StorageCategoryUsage {
  bytes: number;
  files: number;
}

export interface StorageStatus {
  root_path: string;
  total_bytes: number;
  total_files: number;
  categories: Record<string, StorageCategoryUsage>;
  warnings?: string[];
}

export interface Album {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  show_on_home: boolean;
  shuffle: boolean;
  interval_s: number;
  source_dir: string | null;
  images: AlbumImage[];
}

export interface MusicTrack { id: string; title: string; file_name: string; original_name: string; mime_type: string; size_bytes: number; lyrics: string; }
export interface MusicAlbum {
  id: string;
  title: string;
  cover_file: string | null;
  cover_mime: string | null;
  loop_playback: boolean;
  default_muted: boolean;
  tracks: MusicTrack[];
}

export interface CpuMetrics {
  cores: number;
  model: string | null;
  base_mhz: number | null;
  current_mhz: number | null;
  usage_percent: number;
  /** Rolling average usage % over ~5 seconds */
  load_5s: number;
  /** Rolling average usage % over ~5 minutes */
  load_5m: number;
  /** Rolling average usage % over ~15 minutes */
  load_15m: number;
  temperature_c: number | null;
}

export interface MemoryModule {
  part_number: string | null;
  manufacturer: string | null;
  speed_mhz: number | null;
  capacity_bytes: number | null;
}

export interface MemoryMetrics {
  total_bytes: number;
  used_bytes: number;
  usage_percent: number;
  modules: MemoryModule[];
  temperature_c: number | null;
}

export interface GpuMetrics {
  name: string | null;
  vram_bytes: number | null;
  vram_used_bytes: number | null;
  usage_percent: number | null;
  temperature_c: number | null;
  memory_clock_mhz: number | null;
  core_clock_mhz: number | null;
}

export interface DiskMetrics {
  name: string;
  model: string | null;
  kind: string | null;
  total_bytes: number;
  used_bytes: number | null;
  read_bps: number;
  write_bps: number;
}

export interface NetworkMetrics {
  name: string;
  model: string | null;
  mac: string | null;
  rx_bps: number;
  tx_bps: number;
}

/** Minute-spaced temperature samples (newest last), up to ~60 points. */
export interface TempHistoryPoint {
  ts: number;
  cpu_c?: number | null;
  mem_c?: number | null;
}

export interface Snapshot {
  type: "snapshot";
  ts: number;
  cpu?: CpuMetrics;
  memory?: MemoryMetrics;
  gpu?: GpuMetrics[];
  disks?: DiskMetrics[];
  network?: NetworkMetrics[];
  temp_history?: TempHistoryPoint[];
}

export type ConnState = "connecting" | "connected" | "disconnected";
