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
            temperature_c: crate::collectors::thermal::memory_temperature_c(),
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
        configured_clock_speed: Option<u32>,
        capacity: Option<u64>,
    }

    let com = match COMLibrary::new() {
        Ok(com) => com,
        Err(error) => {
            tracing::debug!(%error, "failed to initialize WMI for physical memory");
            return Vec::new();
        }
    };
    let wmi = match WMIConnection::new(com) {
        Ok(wmi) => wmi,
        Err(error) => {
            tracing::debug!(%error, "failed to connect to WMI for physical memory");
            return Vec::new();
        }
    };

    let results: Vec<Win32PhysicalMemory> = match wmi.query() {
        Ok(results) => results,
        Err(error) => {
            tracing::debug!(%error, "failed to query physical memory data");
            return Vec::new();
        }
    };
    results
        .into_iter()
        .map(|m| MemoryModule {
            part_number: clean_wmi_str(m.part_number),
            manufacturer: clean_wmi_str(m.manufacturer),
            speed_mhz: select_memory_speed(m.configured_clock_speed, m.speed),
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

fn select_memory_speed(configured_mhz: Option<u32>, rated_mhz: Option<u32>) -> Option<u32> {
    configured_mhz
        .filter(|&speed| speed > 0)
        .or_else(|| rated_mhz.filter(|&speed| speed > 0))
}

#[cfg(test)]
mod tests {
    use super::select_memory_speed;

    #[test]
    fn configured_memory_speed_has_priority() {
        assert_eq!(select_memory_speed(Some(6_000), Some(7_467)), Some(6_000));
    }

    #[test]
    fn rated_memory_speed_is_used_when_configured_speed_is_missing_or_zero() {
        assert_eq!(select_memory_speed(None, Some(7_467)), Some(7_467));
        assert_eq!(select_memory_speed(Some(0), Some(7_467)), Some(7_467));
        assert_eq!(select_memory_speed(Some(0), Some(0)), None);
    }
}
