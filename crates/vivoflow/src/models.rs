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
    /// Host and operating-system information for the system dashboard.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system: Option<SystemMetrics>,
    /// CPU / memory temperature samples at ~1 minute spacing (newest last).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub temp_history: Vec<TempHistoryPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub host_name: Option<String>,
    pub os_name: Option<String>,
    pub os_version: Option<String>,
    pub kernel_version: Option<String>,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempHistoryPoint {
    pub ts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_c: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mem_c: Option<f32>,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_metrics_are_serialized_in_snapshot() {
        let snapshot = Snapshot {
            msg_type: "snapshot",
            ts: 1_725_000_000_000,
            cpu: None,
            memory: None,
            gpu: None,
            disks: None,
            network: None,
            system: Some(SystemMetrics {
                host_name: Some("dev-host".into()),
                os_name: Some("Windows".into()),
                os_version: Some("11".into()),
                kernel_version: Some("10.0".into()),
                uptime_seconds: 3_600,
            }),
            temp_history: Vec::new(),
        };

        let value = serde_json::to_value(snapshot).expect("snapshot should serialize");
        assert_eq!(value["system"]["host_name"], "dev-host");
        assert_eq!(value["system"]["uptime_seconds"], 3_600);
        assert!(value.get("temp_history").is_none());
    }
}
