//! Best-effort thermal readings via Windows performance counters / ACPI WMI.
//! Many boards omit sensors; callers must treat `None` as unavailable.

#[cfg(windows)]
pub fn cpu_temperature_c() -> Option<f32> {
    let zones = query_thermal_zones();
    pick_zone(&zones, &["CPU", "PROC", "CORE", "PKG", "TZ0", "THRM"]).or_else(|| {
        zones
            .iter()
            .map(|z| z.celsius)
            .filter(|t| *t > 1.0 && *t < 125.0)
            .reduce(|a, b| a.max(b))
    })
}

#[cfg(windows)]
pub fn memory_temperature_c() -> Option<f32> {
    let zones = query_thermal_zones();
    pick_zone(&zones, &["MEM", "DRAM", "DIMM", "RAM", "SO-DIMM"])
}

#[cfg(not(windows))]
pub fn cpu_temperature_c() -> Option<f32> {
    None
}

#[cfg(not(windows))]
pub fn memory_temperature_c() -> Option<f32> {
    None
}

#[cfg(windows)]
#[derive(Clone)]
struct ThermalZone {
    name: String,
    celsius: f32,
}

#[cfg(windows)]
fn pick_zone(zones: &[ThermalZone], needles: &[&str]) -> Option<f32> {
    zones.iter().find_map(|z| {
        let upper = z.name.to_ascii_uppercase();
        if needles.iter().any(|n| upper.contains(n)) && z.celsius > 1.0 && z.celsius < 125.0 {
            Some(z.celsius)
        } else {
            None
        }
    })
}

#[cfg(windows)]
fn kelvin10_to_c(raw: f64) -> Option<f32> {
    if raw <= 0.0 {
        return None;
    }
    let c = ((raw - 2732.0) / 10.0) as f32;
    if c > 1.0 && c < 125.0 {
        Some(c)
    } else {
        None
    }
}

#[cfg(windows)]
fn query_thermal_zones() -> Vec<ThermalZone> {
    let mut out = query_perf_thermal_zones();
    if out.is_empty() {
        out = query_acpi_thermal_zones();
    }
    out
}

#[cfg(windows)]
fn query_perf_thermal_zones() -> Vec<ThermalZone> {
    use serde::Deserialize;
    use wmi::{COMLibrary, WMIConnection};

    #[derive(Deserialize, Debug)]
    #[serde(rename = "Win32_PerfFormattedData_Counters_ThermalZoneInformation")]
    #[serde(rename_all = "PascalCase")]
    struct PerfThermal {
        name: Option<String>,
        high_precision_temperature: Option<u32>,
        temperature: Option<u32>,
    }

    let com = match COMLibrary::new() {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let wmi = match WMIConnection::new(com) {
        Ok(w) => w,
        Err(_) => return Vec::new(),
    };

    let rows: Vec<PerfThermal> = wmi.query().unwrap_or_default();
    rows.into_iter()
        .filter_map(|r| {
            let raw = r
                .high_precision_temperature
                .or(r.temperature)
                .map(|v| v as f64)?;
            let celsius = kelvin10_to_c(raw)?;
            Some(ThermalZone {
                name: r.name.unwrap_or_default(),
                celsius,
            })
        })
        .collect()
}

#[cfg(windows)]
fn query_acpi_thermal_zones() -> Vec<ThermalZone> {
    use serde::Deserialize;
    use wmi::{COMLibrary, WMIConnection};

    #[derive(Deserialize, Debug)]
    #[serde(rename = "MSAcpi_ThermalZoneTemperature")]
    #[serde(rename_all = "PascalCase")]
    struct AcpiThermal {
        instance_name: Option<String>,
        current_temperature: Option<u32>,
    }

    let com = match COMLibrary::new() {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    // root\WMI namespace for ACPI thermal
    let wmi = match WMIConnection::with_namespace_path("ROOT\\WMI", com) {
        Ok(w) => w,
        Err(_) => return Vec::new(),
    };

    let rows: Vec<AcpiThermal> = wmi.query().unwrap_or_default();
    rows.into_iter()
        .filter_map(|r| {
            let raw = r.current_temperature.map(|v| v as f64)?;
            let celsius = kelvin10_to_c(raw)?;
            Some(ThermalZone {
                name: r.instance_name.unwrap_or_default(),
                celsius,
            })
        })
        .collect()
}
