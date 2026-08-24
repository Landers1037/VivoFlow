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

export interface AppConfig {
  interval_ms: number;
  enabled: EnabledModules;
  history_points: number;
  ui_style: UiStyle;
  accent: AccentId;
  /** `#RRGGBB`，当 `accent === "custom"` 时生效 */
  accent_custom: string;
  theme: ThemeMode;
  language: Lang;
  hide_title_bar: boolean;
  mobile_card_mode: boolean;
  mobile_auto_carousel: boolean;
  mobile_carousel_interval_s: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  interval_ms: 1000,
  history_points: 60,
  enabled: { cpu: true, memory: true, gpu: true, disk: true, network: true },
  ui_style: "amicro",
  accent: "teal",
  accent_custom: DEFAULT_ACCENT_CUSTOM,
  theme: "system",
  language: "zh",
  hide_title_bar: false,
  mobile_card_mode: false,
  mobile_auto_carousel: true,
  mobile_carousel_interval_s: 10,
};

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
