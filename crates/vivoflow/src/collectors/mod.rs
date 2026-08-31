mod cpu;
mod disk;
mod gpu;
mod memory;
mod network;
mod system;
pub(crate) mod thermal;

use std::collections::VecDeque;
use std::time::{Duration, Instant};

use anyhow::Result;
use chrono::Utc;

use crate::config::EnabledModules;
use crate::models::{Snapshot, TempHistoryPoint};

use self::cpu::CpuCollector;
use self::disk::DiskCollector;
use self::gpu::GpuCollector;
use self::memory::MemoryCollector;
use self::network::NetworkCollector;
use self::system::SystemCollector;

const TEMP_SAMPLE_INTERVAL: Duration = Duration::from_secs(60);
const TEMP_HISTORY_MAX: usize = 60;

pub struct Collector {
    cpu: CpuCollector,
    memory: MemoryCollector,
    gpu: GpuCollector,
    disk: DiskCollector,
    network: NetworkCollector,
    system: SystemCollector,
    temp_history: VecDeque<TempHistoryPoint>,
    last_temp_sample_at: Option<Instant>,
}

impl Collector {
    pub fn new() -> Self {
        Self {
            cpu: CpuCollector::new(),
            memory: MemoryCollector::new(),
            gpu: GpuCollector::new(),
            disk: DiskCollector::new(),
            network: NetworkCollector::new(),
            system: SystemCollector::new(),
            temp_history: VecDeque::with_capacity(TEMP_HISTORY_MAX),
            last_temp_sample_at: None,
        }
    }

    pub async fn collect(&mut self, enabled: &EnabledModules) -> Result<Snapshot> {
        let cpu = if enabled.cpu {
            Some(self.cpu.sample())
        } else {
            None
        };
        let memory = if enabled.memory {
            Some(self.memory.sample())
        } else {
            None
        };
        let gpu = if enabled.gpu {
            Some(self.gpu.sample())
        } else {
            None
        };
        let disks = if enabled.disk {
            Some(self.disk.sample())
        } else {
            None
        };
        let network = if enabled.network {
            Some(self.network.sample())
        } else {
            None
        };

        let cpu_c = cpu.as_ref().and_then(|c| c.temperature_c);
        let mem_c = memory.as_ref().and_then(|m| m.temperature_c);
        self.maybe_record_temp(cpu_c, mem_c);

        Ok(Snapshot {
            msg_type: "snapshot",
            ts: Utc::now().timestamp_millis(),
            cpu,
            memory,
            gpu,
            disks,
            network,
            system: Some(self.system.sample()),
            temp_history: self.temp_history.iter().cloned().collect(),
        })
    }

    fn maybe_record_temp(&mut self, cpu_c: Option<f32>, mem_c: Option<f32>) {
        if cpu_c.is_none() && mem_c.is_none() {
            return;
        }
        let now = Instant::now();
        let due = self
            .last_temp_sample_at
            .map(|t| now.duration_since(t) >= TEMP_SAMPLE_INTERVAL)
            .unwrap_or(true);
        if !due {
            return;
        }
        self.last_temp_sample_at = Some(now);
        self.temp_history.push_back(TempHistoryPoint {
            ts: Utc::now().timestamp_millis(),
            cpu_c,
            mem_c,
        });
        while self.temp_history.len() > TEMP_HISTORY_MAX {
            self.temp_history.pop_front();
        }
    }
}
