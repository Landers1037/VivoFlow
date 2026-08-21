export interface EnabledModules {
  cpu: boolean;
  memory: boolean;
  gpu: boolean;
  disk: boolean;
  network: boolean;
}

export interface AppConfig {
  interval_ms: number;
  enabled: EnabledModules;
  history_points: number;
}

export interface CpuMetrics {
  cores: number;
  model: string | null;
  base_mhz: number | null;
  current_mhz: number | null;
  usage_percent: number;
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

export interface Snapshot {
  type: "snapshot";
  ts: number;
  cpu?: CpuMetrics;
  memory?: MemoryMetrics;
  gpu?: GpuMetrics[];
  disks?: DiskMetrics[];
  network?: NetworkMetrics[];
}

export type ConnState = "connecting" | "connected" | "disconnected";
