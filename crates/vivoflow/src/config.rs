use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

fn default_accent_custom() -> String {
    "#0d9488".into()
}

fn default_mobile_auto_carousel() -> bool {
    true
}

fn default_mobile_carousel_interval_s() -> u64 {
    10
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub interval_ms: u64,
    pub enabled: EnabledModules,
    pub history_points: usize,
    #[serde(default)]
    pub ui_style: String,
    #[serde(default)]
    pub accent: String,
    #[serde(default = "default_accent_custom")]
    pub accent_custom: String,
    #[serde(default)]
    pub theme: String,
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub hide_title_bar: bool,
    #[serde(default)]
    pub mobile_card_mode: bool,
    #[serde(default = "default_mobile_auto_carousel")]
    pub mobile_auto_carousel: bool,
    #[serde(default = "default_mobile_carousel_interval_s")]
    pub mobile_carousel_interval_s: u64,
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
            ui_style: "amicro".into(),
            accent: "teal".into(),
            accent_custom: default_accent_custom(),
            theme: "system".into(),
            language: "zh".into(),
            hide_title_bar: false,
            mobile_card_mode: false,
            mobile_auto_carousel: true,
            mobile_carousel_interval_s: default_mobile_carousel_interval_s(),
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

const UI_STYLES: &[&str] = &[
    "amicro",
    "neumorph",
    "line",
    "glass",
    "console",
    "paper",
    "instrument",
    "dense",
    "clay",
    "metal",
    "ink",
    "swiss",
    "hud",
    "editorial",
];
const ACCENTS: &[&str] = &["teal", "zinc", "blue", "violet", "amber", "custom"];
const THEMES: &[&str] = &["light", "dark", "system"];
const LANGS: &[&str] = &["zh", "en"];

fn is_hex_color(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 7 || b[0] != b'#' {
        return false;
    }
    b[1..].iter().all(|c| c.is_ascii_hexdigit())
}

impl AppConfig {
    pub fn sanitize(mut self) -> Self {
        self.interval_ms = self.interval_ms.clamp(200, 60_000);
        self.history_points = self.history_points.clamp(10, 300);

        if !UI_STYLES.contains(&self.ui_style.as_str()) {
            self.ui_style = "amicro".into();
        }
        if !ACCENTS.contains(&self.accent.as_str()) {
            self.accent = "teal".into();
        }
        if !is_hex_color(&self.accent_custom) {
            self.accent_custom = default_accent_custom();
        } else {
            self.accent_custom = self.accent_custom.to_ascii_lowercase();
        }
        if !THEMES.contains(&self.theme.as_str()) {
            self.theme = "system".into();
        }
        if !LANGS.contains(&self.language.as_str()) {
            self.language = "zh".into();
        }
        self.mobile_carousel_interval_s = self.mobile_carousel_interval_s.clamp(5, 60);
        self
    }
}

pub fn config_file_path() -> PathBuf {
    if let Ok(custom) = std::env::var("VIVOFLOW_CONFIG") {
        return PathBuf::from(custom);
    }
    if let Some(base) = dirs_config_dir() {
        return base.join("VivoFlow").join("config.json");
    }
    PathBuf::from("vivoflow.config.json")
}

fn dirs_config_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config"))
    }
}

pub fn load_config() -> AppConfig {
    let path = config_file_path();
    match fs::read_to_string(&path) {
        Ok(raw) => match serde_json::from_str::<AppConfig>(&raw) {
            Ok(cfg) => {
                tracing::info!("loaded config from {}", path.display());
                cfg.sanitize()
            }
            Err(err) => {
                tracing::warn!("invalid config at {}: {err}; using defaults", path.display());
                AppConfig::default()
            }
        },
        Err(_) => {
            tracing::info!("no config file at {}; using defaults", path.display());
            AppConfig::default()
        }
    }
}

pub fn save_config(cfg: &AppConfig) -> anyhow::Result<()> {
    let path = config_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(cfg)?;
    fs::write(&path, raw)?;
    tracing::debug!("saved config to {}", path.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_config_gets_mobile_defaults() {
        let raw = r###"{
            "interval_ms": 1000,
            "enabled": {"cpu": true, "memory": true, "gpu": true, "disk": true, "network": true},
            "history_points": 60,
            "ui_style": "amicro",
            "accent": "teal",
            "accent_custom": "#0d9488",
            "theme": "system",
            "language": "zh"
        }"###;

        let cfg: AppConfig = serde_json::from_str(raw).expect("legacy config should deserialize");
        assert!(!cfg.hide_title_bar);
        assert!(!cfg.mobile_card_mode);
        assert!(cfg.mobile_auto_carousel);
        assert_eq!(cfg.mobile_carousel_interval_s, 10);
    }

    #[test]
    fn carousel_interval_is_sanitized() {
        let low = AppConfig {
            mobile_carousel_interval_s: 0,
            ..AppConfig::default()
        };
        assert_eq!(low.sanitize().mobile_carousel_interval_s, 5);

        let high = AppConfig {
            mobile_carousel_interval_s: 120,
            ..AppConfig::default()
        };
        assert_eq!(high.sanitize().mobile_carousel_interval_s, 60);
    }
}
