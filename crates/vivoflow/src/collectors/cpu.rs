use sysinfo::{CpuRefreshKind, RefreshKind, System};

use crate::models::CpuMetrics;

pub struct CpuCollector {
    system: System,
}

impl CpuCollector {
    pub fn new() -> Self {
        let mut system = System::new_with_specifics(
            RefreshKind::nothing().with_cpu(CpuRefreshKind::everything()),
        );
        system.refresh_cpu_all();
        Self { system }
    }

    pub fn sample(&mut self) -> CpuMetrics {
        self.system
            .refresh_cpu_specifics(CpuRefreshKind::everything());
        // First refresh after idle often returns 0; refresh twice for meaningful usage.
        std::thread::sleep(std::time::Duration::from_millis(50));
        self.system
            .refresh_cpu_specifics(CpuRefreshKind::everything());

        let cpus = self.system.cpus();
        let cores = cpus.len() as u32;
        let usage_percent = if cores == 0 {
            0.0
        } else {
            cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cores as f32
        };

        let model = cpus
            .first()
            .map(|c| c.brand().trim().to_string())
            .filter(|s| !s.is_empty());

        let base_mhz = cpus
            .first()
            .map(|c| c.frequency() as u32)
            .filter(|&f| f > 0);

        let current_mhz = current_cpu_mhz().or(base_mhz);

        CpuMetrics {
            cores,
            model,
            base_mhz,
            current_mhz,
            usage_percent,
        }
    }
}

#[cfg(windows)]
fn current_cpu_mhz() -> Option<u32> {
    use windows::Win32::System::Power::{
        CallNtPowerInformation, PROCESSOR_POWER_INFORMATION, ProcessorInformation,
    };

    let cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let mut buf = vec![
        PROCESSOR_POWER_INFORMATION {
            Number: 0,
            MaxMhz: 0,
            CurrentMhz: 0,
            MhzLimit: 0,
            MaxIdleState: 0,
            CurrentIdleState: 0,
        };
        cores
    ];

    let size = (std::mem::size_of::<PROCESSOR_POWER_INFORMATION>() * cores) as u32;
    let status = unsafe {
        CallNtPowerInformation(
            ProcessorInformation,
            None,
            0,
            Some(buf.as_mut_ptr() as *mut _),
            size,
        )
    };

    if status.is_ok() {
        let avg = buf.iter().map(|p| p.CurrentMhz).sum::<u32>() / cores as u32;
        if avg > 0 {
            return Some(avg);
        }
    }
    None
}

#[cfg(not(windows))]
fn current_cpu_mhz() -> Option<u32> {
    None
}
