use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

fn default_accent_custom() -> String {
    "#0d9488".into()
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
