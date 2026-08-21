mod cpu;
mod disk;
mod gpu;
mod memory;
mod network;

use anyhow::Result;
use chrono::Utc;

use crate::config::EnabledModules;
use crate::models::Snapshot;

use self::cpu::CpuCollector;
use self::disk::DiskCollector;
use self::gpu::GpuCollector;
use self::memory::MemoryCollector;
use self::network::NetworkCollector;

pub struct Collector {
    cpu: CpuCollector,
    memory: MemoryCollector,
    gpu: GpuCollector,
    disk: DiskCollector,
    network: NetworkCollector,
}

impl Collector {
    pub fn new() -> Self {
        Self {
            cpu: CpuCollector::new(),
            memory: MemoryCollector::new(),
            gpu: GpuCollector::new(),
            disk: DiskCollector::new(),
            network: NetworkCollector::new(),
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

        Ok(Snapshot {
            msg_type: "snapshot",
            ts: Utc::now().timestamp_millis(),
            cpu,
            memory,
            gpu,
            disks,
            network,
        })
    }
}
