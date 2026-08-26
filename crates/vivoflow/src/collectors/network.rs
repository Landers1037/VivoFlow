use std::collections::HashMap;
use std::time::Instant;

use sysinfo::Networks;

use crate::models::NetworkMetrics;

struct NetSample {
    rx: u64,
    tx: u64,
    at: Instant,
}

pub struct NetworkCollector {
    networks: Networks,
    prev: HashMap<String, NetSample>,
    models: HashMap<String, String>,
}

impl NetworkCollector {
    pub fn new() -> Self {
        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh(true);
        Self {
            networks,
            prev: HashMap::new(),
            models: query_adapter_models(),
        }
    }

    pub fn sample(&mut self) -> Vec<NetworkMetrics> {
        self.networks.refresh(true);
        let now = Instant::now();
        let mut out = Vec::new();

        for (name, data) in self.networks.list() {
            let name = name.to_string();
            let lower = name.to_lowercase();
            if lower.contains("loopback")
                || lower.contains("isatap")
                || lower.contains("teredo")
                || lower.starts_with("vethernet")
            {
                continue;
            }

            let rx = data.total_received();
            let tx = data.total_transmitted();

            let (rx_bps, tx_bps) = if let Some(prev) = self.prev.get(&name) {
                let dt = now.duration_since(prev.at).as_secs_f64().max(0.001);
                (
                    (rx.saturating_sub(prev.rx) as f64 / dt) as u64,
                    (tx.saturating_sub(prev.tx) as f64 / dt) as u64,
                )
            } else {
                (0, 0)
            };

            self.prev
                .insert(name.clone(), NetSample { rx, tx, at: now });

            let mac = {
                let m = data.mac_address().to_string();
                if m == "00:00:00:00:00:00" {
                    None
                } else {
                    Some(m)
                }
            };

            let model = self
                .models
                .get(&name)
                .cloned()
                .or_else(|| fuzzy_model(&self.models, &name));

            out.push(NetworkMetrics {
                name,
                model,
                mac,
                rx_bps,
                tx_bps,
            });
        }

        out
    }
}

fn fuzzy_model(models: &HashMap<String, String>, name: &str) -> Option<String> {
    let name_l = name.to_lowercase();
    models
        .iter()
        .find(|(k, _)| {
            let k = k.to_lowercase();
            name_l.contains(&k) || k.contains(&name_l)
        })
        .map(|(_, v)| v.clone())
}

#[cfg(windows)]
fn query_adapter_models() -> HashMap<String, String> {
    use serde::Deserialize;
    use wmi::{COMLibrary, WMIConnection};

    #[derive(Deserialize, Debug)]
    #[serde(rename = "Win32_NetworkAdapter")]
    #[serde(rename_all = "PascalCase")]
    struct Win32NetworkAdapter {
        name: Option<String>,
        product_name: Option<String>,
        net_enabled: Option<bool>,
        physical_adapter: Option<bool>,
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

    let results: Vec<Win32NetworkAdapter> = wmi.query().unwrap_or_default();
    for a in results {
        let physical = a.physical_adapter.unwrap_or(false);
        let enabled = a.net_enabled.unwrap_or(true);
        if !physical || !enabled {
            continue;
        }
        if let Some(name) = a.name {
            let model = a
                .product_name
                .unwrap_or_else(|| name.clone())
                .trim()
                .to_string();
            if !model.is_empty() {
                map.insert(name, model);
            }
        }
    }
    map
}

#[cfg(not(windows))]
fn query_adapter_models() -> HashMap<String, String> {
    HashMap::new()
}
