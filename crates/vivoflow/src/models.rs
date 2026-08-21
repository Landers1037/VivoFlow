use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    #[serde(rename = "type")]
    pub msg_type: &'static str,
    pub ts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu: Option<CpuMetrics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory: Option<MemoryMetrics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gpu: Option<Vec<GpuMetrics>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disks: Option<Vec<DiskMetrics>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<Vec<NetworkMetrics>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub cores: u32,
    pub model: Option<String>,
    pub base_mhz: Option<u32>,
    pub current_mhz: Option<u32>,
    pub usage_percent: f32,
    /// Rolling average usage % over ~5 seconds.
    pub load_5s: f32,
    /// Rolling average usage % over ~5 minutes.
    pub load_5m: f32,
    /// Rolling average usage % over ~15 minutes.
    pub load_15m: f32,
    pub temperature_c: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryModule {
    pub part_number: Option<String>,
    pub manufacturer: Option<String>,
    pub speed_mhz: Option<u32>,
    pub capacity_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub usage_percent: f32,
    pub modules: Vec<MemoryModule>,
    pub temperature_c: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuMetrics {
    pub name: Option<String>,
    pub vram_bytes: Option<u64>,
    pub vram_used_bytes: Option<u64>,
    pub usage_percent: Option<f32>,
    pub temperature_c: Option<f32>,
    pub memory_clock_mhz: Option<u32>,
    pub core_clock_mhz: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub name: String,
    pub model: Option<String>,
    pub kind: Option<String>,
    pub total_bytes: u64,
    pub used_bytes: Option<u64>,
    pub read_bps: u64,
    pub write_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub name: String,
    pub model: Option<String>,
    pub mac: Option<String>,
    pub rx_bps: u64,
    pub tx_bps: u64,
}
