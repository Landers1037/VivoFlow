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
export type AudioVisualizerMode =
  | "particles"
  | "grid"
  | "aurora"
  | "radial"
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
  audio_visualizer_enabled: boolean;
  audio_device_id: string | null;
  audio_visualizer_mode: AudioVisualizerMode;
  audio_color_mode: AudioColorMode;
  audio_color_primary: string;
  audio_color_secondary: string;
  audio_amplitude: number;
  audio_smoothing: number;
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
  audio_visualizer_enabled: false,
  audio_device_id: null,
  audio_visualizer_mode: "particles",
  audio_color_mode: "gradient",
  audio_color_primary: "#22d3ee",
  audio_color_secondary: "#a855f7",
  audio_amplitude: 1,
  audio_smoothing: 0.65,
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
