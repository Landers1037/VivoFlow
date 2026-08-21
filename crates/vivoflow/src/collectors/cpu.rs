use std::collections::VecDeque;
use std::time::{Duration, Instant};

use sysinfo::{CpuRefreshKind, RefreshKind, System};

use crate::models::CpuMetrics;

struct UsageSample {
    at: Instant,
    usage: f32,
}

pub struct CpuCollector {
    system: System,
    samples: VecDeque<UsageSample>,
}

impl CpuCollector {
    pub fn new() -> Self {
        let mut system = System::new_with_specifics(
            RefreshKind::nothing().with_cpu(CpuRefreshKind::everything()),
        );
        system.refresh_cpu_all();
        Self {
            system,
            samples: VecDeque::with_capacity(1024),
        }
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

        self.push_usage(usage_percent);
        let load_5s = self.avg_usage(Duration::from_secs(5));
        let load_5m = self.avg_usage(Duration::from_secs(5 * 60));
        let load_15m = self.avg_usage(Duration::from_secs(15 * 60));

        CpuMetrics {
            cores,
            model,
            base_mhz,
            current_mhz,
            usage_percent,
            load_5s,
            load_5m,
            load_15m,
            temperature_c: crate::collectors::thermal::cpu_temperature_c(),
        }
    }

    fn push_usage(&mut self, usage: f32) {
        let now = Instant::now();
        self.samples.push_back(UsageSample {
            at: now,
            usage,
        });
        let cutoff = now
            .checked_sub(Duration::from_secs(15 * 60 + 30))
            .unwrap_or(now);
        while self.samples.front().is_some_and(|s| s.at < cutoff) {
            self.samples.pop_front();
        }
    }

    fn avg_usage(&self, window: Duration) -> f32 {
        let now = Instant::now();
        let cutoff = now.checked_sub(window).unwrap_or(now);
        let mut sum = 0.0f32;
        let mut n = 0u32;
        for s in self.samples.iter().rev() {
            if s.at < cutoff {
                break;
            }
            sum += s.usage;
            n += 1;
        }
        if n == 0 {
            self.samples.back().map(|s| s.usage).unwrap_or(0.0)
        } else {
            sum / n as f32
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
