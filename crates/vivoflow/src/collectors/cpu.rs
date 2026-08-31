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
        self.samples.push_back(UsageSample { at: now, usage });
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
    query_effective_cpu_mhz().or_else(power_current_cpu_mhz)
}

#[cfg(windows)]
fn query_effective_cpu_mhz() -> Option<u32> {
    use serde::Deserialize;
    use wmi::{COMLibrary, WMIConnection};

    #[derive(Deserialize)]
    #[serde(rename = "Win32_PerfFormattedData_Counters_ProcessorInformation")]
    #[serde(rename_all = "PascalCase")]
    struct ProcessorInformation {
        name: String,
        processor_frequency: Option<u64>,
        percent_processor_performance: Option<u64>,
    }

    let com = match COMLibrary::new() {
        Ok(com) => com,
        Err(error) => {
            tracing::debug!(%error, "failed to initialize WMI for processor performance");
            return None;
        }
    };
    let wmi = match WMIConnection::new(com) {
        Ok(wmi) => wmi,
        Err(error) => {
            tracing::debug!(%error, "failed to connect to WMI for processor performance");
            return None;
        }
    };
    let rows: Vec<ProcessorInformation> = match wmi.query() {
        Ok(rows) => rows,
        Err(error) => {
            tracing::debug!(%error, "failed to query processor performance data");
            return None;
        }
    };
    let samples = rows.into_iter().map(|row| CpuFrequencySample {
        is_total: is_total_processor_instance(&row.name),
        frequency_mhz: row.processor_frequency.unwrap_or_default(),
        performance_percent: row.percent_processor_performance.unwrap_or_default(),
    });
    peak_effective_mhz(samples)
}

#[cfg(windows)]
fn power_current_cpu_mhz() -> Option<u32> {
    use windows::Win32::System::Power::{
        CallNtPowerInformation, ProcessorInformation, PROCESSOR_POWER_INFORMATION,
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

#[derive(Debug, Clone, Copy)]
struct CpuFrequencySample {
    is_total: bool,
    frequency_mhz: u64,
    performance_percent: u64,
}

fn peak_effective_mhz<I>(samples: I) -> Option<u32>
where
    I: IntoIterator<Item = CpuFrequencySample>,
{
    samples
        .into_iter()
        .filter(|sample| !sample.is_total)
        .filter_map(|sample| effective_mhz(sample.frequency_mhz, sample.performance_percent))
        .max()
}

fn effective_mhz(frequency_mhz: u64, performance_percent: u64) -> Option<u32> {
    if frequency_mhz == 0 || performance_percent == 0 {
        return None;
    }
    let effective = (frequency_mhz as f64 * performance_percent as f64 / 100.0).round();
    if !effective.is_finite() || effective <= 0.0 || effective > u32::MAX as f64 {
        None
    } else {
        Some(effective as u32)
    }
}

fn is_total_processor_instance(name: &str) -> bool {
    name.eq_ignore_ascii_case("_total")
        || name
            .rsplit(',')
            .next()
            .is_some_and(|part| part.eq_ignore_ascii_case("_total"))
}

#[cfg(test)]
mod tests {
    use super::{
        effective_mhz, is_total_processor_instance, peak_effective_mhz, CpuFrequencySample,
    };

    #[test]
    fn peak_effective_frequency_keeps_overclocked_values_and_ignores_totals() {
        let samples = [
            CpuFrequencySample {
                is_total: false,
                frequency_mhz: 1_200,
                performance_percent: 100,
            },
            CpuFrequencySample {
                is_total: false,
                frequency_mhz: 1_200,
                performance_percent: 375,
            },
            CpuFrequencySample {
                is_total: true,
                frequency_mhz: 9_999,
                performance_percent: 900,
            },
        ];

        assert_eq!(peak_effective_mhz(samples), Some(4_500));
    }

    #[test]
    fn invalid_frequency_samples_are_ignored() {
        assert_eq!(effective_mhz(0, 200), None);
        assert_eq!(effective_mhz(1_200, 0), None);
        assert!(is_total_processor_instance("_Total"));
        assert!(is_total_processor_instance("0,_Total"));
        assert!(!is_total_processor_instance("0,3"));
    }
}
