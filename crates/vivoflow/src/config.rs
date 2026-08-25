use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

fn default_accent_custom() -> String {
    "#0d9488".into()
}

fn default_background_color() -> String {
    "#0b1a20".into()
}

fn default_mobile_auto_carousel() -> bool {
    true
}

fn default_mobile_carousel_interval_s() -> u64 {
    10
}

fn default_photo_album_effect() -> String {
    "single".into()
}

fn default_audio_visualizer_mode() -> String {
    "particles".into()
}
fn default_audio_color_mode() -> String {
    "gradient".into()
}
fn default_audio_color_primary() -> String {
    "#22d3ee".into()
}
fn default_audio_color_secondary() -> String {
    "#a855f7".into()
}
fn default_audio_amplitude() -> f32 {
    1.0
}
fn default_audio_smoothing() -> f32 {
    0.65
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
    #[serde(default = "default_background_color")]
    pub background_color: String,
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
    #[serde(default)]
    pub photo_album_enabled: bool,
    #[serde(default = "default_photo_album_effect")]
    pub photo_album_effect: String,
    #[serde(default)]
    pub audio_visualizer_enabled: bool,
    #[serde(default)]
    pub audio_device_id: Option<String>,
    #[serde(default = "default_audio_visualizer_mode")]
    pub audio_visualizer_mode: String,
    #[serde(default = "default_audio_color_mode")]
    pub audio_color_mode: String,
    #[serde(default = "default_audio_color_primary")]
    pub audio_color_primary: String,
    #[serde(default = "default_audio_color_secondary")]
    pub audio_color_secondary: String,
    #[serde(default = "default_audio_amplitude")]
    pub audio_amplitude: f32,
    #[serde(default = "default_audio_smoothing")]
    pub audio_smoothing: f32,
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
            background_color: default_background_color(),
            theme: "system".into(),
            language: "zh".into(),
            hide_title_bar: false,
            mobile_card_mode: false,
            mobile_auto_carousel: true,
            mobile_carousel_interval_s: default_mobile_carousel_interval_s(),
            photo_album_enabled: false,
            photo_album_effect: default_photo_album_effect(),
            audio_visualizer_enabled: false,
            audio_device_id: None,
            audio_visualizer_mode: default_audio_visualizer_mode(),
            audio_color_mode: default_audio_color_mode(),
            audio_color_primary: default_audio_color_primary(),
            audio_color_secondary: default_audio_color_secondary(),
            audio_amplitude: default_audio_amplitude(),
            audio_smoothing: default_audio_smoothing(),
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
        if !is_hex_color(&self.background_color) {
            self.background_color = default_background_color();
        } else {
            self.background_color = self.background_color.to_ascii_lowercase();
        }
        if !THEMES.contains(&self.theme.as_str()) {
            self.theme = "system".into();
        }
        if !LANGS.contains(&self.language.as_str()) {
            self.language = "zh".into();
        }
        self.mobile_carousel_interval_s = self.mobile_carousel_interval_s.clamp(5, 60);
        if !["single", "time_machine", "cover_flow"].contains(&self.photo_album_effect.as_str()) {
            self.photo_album_effect = default_photo_album_effect();
        }
        if ![
            "particles", "grid", "aurora", "radial", "city3d", "nebula3d", "terrain3d",
            "crystal3d",
        ]
        .contains(&self.audio_visualizer_mode.as_str())
        {
            self.audio_visualizer_mode = default_audio_visualizer_mode();
        }
        if !["single", "gradient"].contains(&self.audio_color_mode.as_str()) {
            self.audio_color_mode = default_audio_color_mode();
        }
        if !is_hex_color(&self.audio_color_primary) {
            self.audio_color_primary = default_audio_color_primary();
        } else {
            self.audio_color_primary = self.audio_color_primary.to_ascii_lowercase();
        }
        if !is_hex_color(&self.audio_color_secondary) {
            self.audio_color_secondary = default_audio_color_secondary();
        } else {
            self.audio_color_secondary = self.audio_color_secondary.to_ascii_lowercase();
        }
        self.audio_amplitude = if self.audio_amplitude.is_finite() {
            self.audio_amplitude.clamp(0.5, 2.0)
        } else {
            default_audio_amplitude()
        };
        self.audio_smoothing = if self.audio_smoothing.is_finite() {
            self.audio_smoothing.clamp(0.0, 0.9)
        } else {
            default_audio_smoothing()
        };
        self.audio_device_id = self.audio_device_id.and_then(|id| {
            let id = id.trim();
            (!id.is_empty() && id.len() <= 1024).then(|| id.to_owned())
        });
        if self.audio_visualizer_enabled {
            self.photo_album_enabled = false;
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
                tracing::warn!(
                    "invalid config at {}: {err}; using defaults",
                    path.display()
                );
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
        assert_eq!(cfg.background_color, "#0b1a20");
        assert!(!cfg.photo_album_enabled);
        assert_eq!(cfg.photo_album_effect, "single");
        assert!(!cfg.audio_visualizer_enabled);
        assert_eq!(cfg.audio_visualizer_mode, "particles");
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

    #[test]
    fn invalid_photo_album_effect_uses_default() {
        let cfg = AppConfig {
            photo_album_effect: "unknown".into(),
            ..AppConfig::default()
        };
        assert_eq!(cfg.sanitize().photo_album_effect, "single");
    }

    #[test]
    fn invalid_background_color_uses_default() {
        let cfg = AppConfig {
            background_color: "not-a-color".into(),
            ..AppConfig::default()
        };
        assert_eq!(cfg.sanitize().background_color, "#0b1a20");
    }

    #[test]
    fn audio_config_is_sanitized_and_exclusive() {
        let cfg = AppConfig {
            photo_album_enabled: true,
            audio_visualizer_enabled: true,
            audio_visualizer_mode: "unknown".into(),
            audio_color_primary: "bad".into(),
            audio_amplitude: 9.0,
            audio_smoothing: -1.0,
            ..AppConfig::default()
        }
        .sanitize();
        assert!(!cfg.photo_album_enabled);
        assert_eq!(cfg.audio_visualizer_mode, "particles");
        assert_eq!(cfg.audio_color_primary, "#22d3ee");
        assert_eq!(cfg.audio_amplitude, 2.0);
        assert_eq!(cfg.audio_smoothing, 0.0);
    }

    #[test]
    fn three_dimensional_audio_modes_are_accepted() {
        for mode in ["city3d", "nebula3d", "terrain3d", "crystal3d"] {
            let cfg = AppConfig {
                audio_visualizer_mode: mode.into(),
                ..AppConfig::default()
            }
            .sanitize();
            assert_eq!(cfg.audio_visualizer_mode, mode);
        }
    }
}
