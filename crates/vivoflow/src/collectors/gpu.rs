use crate::models::GpuMetrics;

pub struct GpuCollector {
    #[cfg(windows)]
    nvml_ok: bool,
}

impl GpuCollector {
    pub fn new() -> Self {
        Self {
            #[cfg(windows)]
            nvml_ok: true,
        }
    }

    pub fn sample(&mut self) -> Vec<GpuMetrics> {
        #[cfg(windows)]
        {
            let mut gpus = query_wmi_gpus();
            if self.nvml_ok {
                match enrich_with_nvml(&mut gpus) {
                    Ok(()) => {}
                    Err(err) => {
                        tracing::debug!("NVML unavailable: {err}");
                        self.nvml_ok = false;
                    }
                }
            }
            if gpus.is_empty() {
                gpus.push(GpuMetrics {
                    name: None,
                    vram_bytes: None,
                    vram_used_bytes: None,
                    usage_percent: None,
                    temperature_c: None,
                    memory_clock_mhz: None,
                    core_clock_mhz: None,
                });
            }
            gpus
        }
        #[cfg(not(windows))]
        {
            Vec::new()
        }
    }
}

#[cfg(windows)]
fn query_wmi_gpus() -> Vec<GpuMetrics> {
    use serde::Deserialize;
    use wmi::{COMLibrary, WMIConnection};

    #[derive(Deserialize, Debug)]
    #[serde(rename = "Win32_VideoController")]
    #[serde(rename_all = "PascalCase")]
    struct Win32VideoController {
        name: Option<String>,
        adapter_ram: Option<u32>,
    }

    let com = match COMLibrary::new() {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let wmi = match WMIConnection::new(com) {
        Ok(w) => w,
        Err(_) => return Vec::new(),
    };

    let results: Vec<Win32VideoController> = wmi.query().unwrap_or_default();
    results
        .into_iter()
        .filter(|g| {
            g.name
                .as_ref()
                .map(|n| {
                    let lower = n.to_lowercase();
                    !lower.contains("microsoft basic")
                        && !lower.contains("remote desktop")
                        && !lower.contains("orayidd")
                        && !lower.contains("virtual")
                        && !lower.contains("parsec")
                })
                .unwrap_or(false)
        })
        .map(|g| {
            let vram = g.adapter_ram.map(|v| v as u64).filter(|&v| v > 0);
            GpuMetrics {
                name: g
                    .name
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty()),
                vram_bytes: vram,
                vram_used_bytes: None,
                usage_percent: None,
                temperature_c: None,
                memory_clock_mhz: None,
                core_clock_mhz: None,
            }
        })
        .collect()
}

#[cfg(windows)]
fn enrich_with_nvml(gpus: &mut Vec<GpuMetrics>) -> Result<(), String> {
    use nvml_wrapper::enum_wrappers::device::{Clock, TemperatureSensor};
    use nvml_wrapper::Nvml;

    let nvml = Nvml::init().map_err(|e| e.to_string())?;
    let count = nvml.device_count().map_err(|e| e.to_string())?;

    for i in 0..count {
        let device = nvml.device_by_index(i).map_err(|e| e.to_string())?;
        let name = device.name().ok();
        let mem = device.memory_info().ok();
        let util = device.utilization_rates().ok();
        let temp = device.temperature(TemperatureSensor::Gpu).ok();
        let mem_clock = device.clock_info(Clock::Memory).ok();
        let core_clock = device.clock_info(Clock::Graphics).ok();

        let target = gpus.iter_mut().find(|g| match (&g.name, &name) {
            (Some(a), Some(b)) => {
                a.to_lowercase().contains(&b.to_lowercase())
                    || b.to_lowercase().contains(&a.to_lowercase())
            }
            _ => false,
        });

        if let Some(gpu) = target {
            if gpu.name.is_none() {
                gpu.name = name;
            }
            if let Some(m) = mem {
                gpu.vram_bytes = Some(m.total);
                gpu.vram_used_bytes = Some(m.used);
            }
            gpu.usage_percent = util.map(|u| u.gpu as f32);
            gpu.temperature_c = temp.map(|t| t as f32);
            gpu.memory_clock_mhz = mem_clock;
            gpu.core_clock_mhz = core_clock;
        } else {
            gpus.push(GpuMetrics {
                name,
                vram_bytes: mem.as_ref().map(|m| m.total),
                vram_used_bytes: mem.as_ref().map(|m| m.used),
                usage_percent: util.map(|u| u.gpu as f32),
                temperature_c: temp.map(|t| t as f32),
                memory_clock_mhz: mem_clock,
                core_clock_mhz: core_clock,
            });
        }
    }

    Ok(())
}
