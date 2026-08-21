use sysinfo::{MemoryRefreshKind, RefreshKind, System};

use crate::models::{MemoryMetrics, MemoryModule};

pub struct MemoryCollector {
    system: System,
}

impl MemoryCollector {
    pub fn new() -> Self {
        let mut system = System::new_with_specifics(
            RefreshKind::nothing().with_memory(MemoryRefreshKind::everything()),
        );
        system.refresh_memory();
        Self { system }
    }

    pub fn sample(&mut self) -> MemoryMetrics {
        self.system.refresh_memory();
        let total = self.system.total_memory();
        let used = self.system.used_memory();
        let usage_percent = if total == 0 {
            0.0
        } else {
            (used as f64 / total as f64 * 100.0) as f32
        };

        MemoryMetrics {
            total_bytes: total,
            used_bytes: used,
            usage_percent,
            modules: query_memory_modules(),
            temperature_c: None,
        }
    }
}

#[cfg(windows)]
fn query_memory_modules() -> Vec<MemoryModule> {
    use serde::Deserialize;
    use wmi::{COMLibrary, WMIConnection};

    #[derive(Deserialize, Debug)]
    #[serde(rename = "Win32_PhysicalMemory")]
    #[serde(rename_all = "PascalCase")]
    struct Win32PhysicalMemory {
        part_number: Option<String>,
        manufacturer: Option<String>,
        speed: Option<u32>,
        capacity: Option<u64>,
    }

    let com = match COMLibrary::new() {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let wmi = match WMIConnection::new(com) {
        Ok(w) => w,
        Err(_) => return Vec::new(),
    };

    let results: Vec<Win32PhysicalMemory> = wmi.query().unwrap_or_default();
    results
        .into_iter()
        .map(|m| MemoryModule {
            part_number: clean_wmi_str(m.part_number),
            manufacturer: clean_wmi_str(m.manufacturer),
            speed_mhz: m.speed.filter(|&s| s > 0),
            capacity_bytes: m.capacity.filter(|&c| c > 0),
        })
        .collect()
}

#[cfg(windows)]
fn clean_wmi_str(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty() && !v.eq_ignore_ascii_case("null") && v != "Unknown")
}

#[cfg(not(windows))]
fn query_memory_modules() -> Vec<MemoryModule> {
    Vec::new()
}
