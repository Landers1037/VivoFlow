use std::collections::HashMap;
use std::time::Instant;

use sysinfo::Disks;

use crate::models::DiskMetrics;

struct IoSample {
    at: Instant,
}

pub struct DiskCollector {
    disks: Disks,
    prev: HashMap<String, IoSample>,
    models: HashMap<String, String>,
}

impl DiskCollector {
    pub fn new() -> Self {
        let mut disks = Disks::new_with_refreshed_list();
        disks.refresh(true);
        Self {
            disks,
            prev: HashMap::new(),
            models: query_disk_models(),
        }
    }

    pub fn sample(&mut self) -> Vec<DiskMetrics> {
        self.disks.refresh(true);
        let now = Instant::now();
        let mut out = Vec::new();

        for disk in self.disks.list() {
            let name = disk.name().to_string_lossy().to_string();
            let mount = disk.mount_point().to_string_lossy().to_string();
            let key = if name.is_empty() {
                mount.clone()
            } else {
                name.clone()
            };

            let total_bytes = disk.total_space();
            let available = disk.available_space();
            let used_bytes = total_bytes.saturating_sub(available);

            // DiskUsage counters are bytes since previous refresh.
            let usage = disk.usage();
            let dt = self
                .prev
                .get(&key)
                .map(|p| now.duration_since(p.at).as_secs_f64())
                .unwrap_or(1.0)
                .max(0.001);
            let read_bps = (usage.read_bytes as f64 / dt) as u64;
            let write_bps = (usage.written_bytes as f64 / dt) as u64;

            self.prev.insert(key.clone(), IoSample { at: now });

            let model = self
                .models
                .get(&key)
                .cloned()
                .or_else(|| {
                    self.models.values().next().cloned()
                })
                .or_else(|| {
                    let fs = disk.file_system().to_string_lossy().to_string();
                    if fs.is_empty() {
                        None
                    } else {
                        Some(fs)
                    }
                });

            let kind = Some(format!("{:?}", disk.kind()));

            out.push(DiskMetrics {
                name: if mount.is_empty() { key } else { mount },
                model,
                kind,
                total_bytes,
                used_bytes: Some(used_bytes),
                read_bps,
                write_bps,
            });
        }

        out
    }
}

#[cfg(windows)]
fn query_disk_models() -> HashMap<String, String> {
    use serde::Deserialize;
    use wmi::{COMLibrary, WMIConnection};

    #[derive(Deserialize, Debug)]
    #[serde(rename = "Win32_DiskDrive")]
    #[serde(rename_all = "PascalCase")]
    struct Win32DiskDrive {
        model: Option<String>,
        device_id: Option<String>,
    }

    let mut map = HashMap::new();
    let com = match COMLibrary::new() {
        Ok(c) => c,
        Err(_) => return map,
    };
    let wmi = match WMIConnection::new(com) {
        Ok(w) => w,
        Err(_) => return map,
    };

    let results: Vec<Win32DiskDrive> = wmi.query().unwrap_or_default();
    for d in results {
        if let (Some(id), Some(model)) = (d.device_id, d.model) {
            let model = model.trim().to_string();
            if !model.is_empty() {
                map.insert(id, model);
            }
        }
    }
    map
}

#[cfg(not(windows))]
fn query_disk_models() -> HashMap<String, String> {
    HashMap::new()
}
