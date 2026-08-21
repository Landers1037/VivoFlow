use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub interval_ms: u64,
    pub enabled: EnabledModules,
    pub history_points: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnabledModules {
    pub cpu: bool,
    pub memory: bool,
    pub gpu: bool,
    pub disk: bool,
    pub network: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            interval_ms: 1000,
            enabled: EnabledModules::default(),
            history_points: 60,
        }
    }
}

impl Default for EnabledModules {
    fn default() -> Self {
        Self {
            cpu: true,
            memory: true,
            gpu: true,
            disk: true,
            network: true,
        }
    }
}

impl AppConfig {
    pub fn sanitize(mut self) -> Self {
        self.interval_ms = self.interval_ms.clamp(200, 60_000);
        self.history_points = self.history_points.clamp(10, 300);
        self
    }
}
