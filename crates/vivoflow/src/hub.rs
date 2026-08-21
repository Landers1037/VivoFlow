use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Duration;

use parking_lot::RwLock;
use tokio::sync::broadcast;

use crate::collectors::Collector;
use crate::config::{save_config, AppConfig};
use crate::models::Snapshot;

#[derive(Clone)]
pub struct MetricsHub {
    pub config: Arc<RwLock<AppConfig>>,
    latest: Arc<RwLock<Option<Snapshot>>>,
    history: Arc<RwLock<VecDeque<Snapshot>>>,
    tx: broadcast::Sender<Snapshot>,
    config_tx: broadcast::Sender<AppConfig>,
}

impl MetricsHub {
    pub fn new(config: Arc<RwLock<AppConfig>>) -> Self {
        let (tx, _) = broadcast::channel(64);
        let (config_tx, _) = broadcast::channel(16);
        Self {
            config,
            latest: Arc::new(RwLock::new(None)),
            history: Arc::new(RwLock::new(VecDeque::new())),
            tx,
            config_tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Snapshot> {
        self.tx.subscribe()
    }

    pub fn subscribe_config(&self) -> broadcast::Receiver<AppConfig> {
        self.config_tx.subscribe()
    }

    pub fn latest(&self) -> Option<Snapshot> {
        self.latest.read().clone()
    }

    pub fn history(&self) -> Vec<Snapshot> {
        self.history.read().iter().cloned().collect()
    }

    pub fn current_config(&self) -> AppConfig {
        self.config.read().clone()
    }

    pub fn set_config(&self, cfg: AppConfig) -> AppConfig {
        let cfg = cfg.sanitize();
        *self.config.write() = cfg.clone();
        if let Err(err) = save_config(&cfg) {
            tracing::warn!("failed to persist config: {err:#}");
        }
        let _ = self.config_tx.send(cfg.clone());
        cfg
    }

    pub fn spawn_collector(self) {
        tokio::spawn(async move {
            let mut collector = Collector::new();
            loop {
                let (interval_ms, history_points, enabled) = {
                    let cfg = self.config.read();
                    (cfg.interval_ms, cfg.history_points, cfg.enabled.clone())
                };

                match collector.collect(&enabled).await {
                    Ok(snapshot) => {
                        {
                            let mut latest = self.latest.write();
                            *latest = Some(snapshot.clone());
                        }
                        {
                            let mut history = self.history.write();
                            history.push_back(snapshot.clone());
                            while history.len() > history_points {
                                history.pop_front();
                            }
                        }
                        let _ = self.tx.send(snapshot);
                    }
                    Err(err) => {
                        tracing::warn!("collect failed: {err:#}");
                    }
                }

                tokio::time::sleep(Duration::from_millis(interval_ms)).await;
            }
        });
    }
}
