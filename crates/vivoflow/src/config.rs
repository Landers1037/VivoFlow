use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

fn default_accent_custom() -> String {
    "#0d9488".into()
}

fn default_background_color() -> String {
    "#0b1a20".into()
}

fn default_glass_gradient_start() -> String {
    "#d9f8ff".into()
}

fn default_glass_gradient_end() -> String {
    "#d7f4ee".into()
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

fn default_music_album_enabled() -> bool {
    false
}

fn default_clock_style() -> String {
    "lines".into()
}

fn default_clock_dot_shape() -> String {
    "circle".into()
}

fn default_clock_show() -> bool {
    true
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

fn default_blackhole_color() -> String {
    "#e8c09a".into()
}

fn default_blackhole_spin_speed() -> f32 {
    1.0
}

fn default_model3d_id() -> String {
    "solar_system".into()
}

fn default_model3d_orbit_style() -> String {
    "solid".into()
}

fn default_model3d_textures_enabled() -> bool {
    true
}

fn default_model3d_tree_canopy_shape() -> String {
    "layered".into()
}

fn default_model3d_tree_canopy_color() -> String {
    "#e07a28".into()
}

fn default_model3d_tree_base_shape() -> String {
    "square".into()
}

fn default_model3d_tree_base_color() -> String {
    "#8f98a3".into()
}

fn default_model3d_tree_trunk_color() -> String {
    "#4a301c".into()
}

fn default_model3d_town_seed() -> String {
    "6f3a9c21".into()
}

fn default_model3d_town_generator_version() -> u16 {
    1
}

fn default_model3d_town_population() -> String {
    "medium".into()
}

fn default_model3d_town_density() -> String {
    "medium".into()
}

fn default_model3d_town_time() -> String {
    "day".into()
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
    #[serde(default = "default_glass_gradient_start")]
    pub glass_gradient_start: String,
    #[serde(default = "default_glass_gradient_end")]
    pub glass_gradient_end: String,
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
    #[serde(default = "default_music_album_enabled")]
    pub music_album_enabled: bool,
    #[serde(default)]
    pub active_music_album_id: Option<String>,
    #[serde(default)]
    pub clock_enabled: bool,
    #[serde(default = "default_clock_style")]
    pub clock_style: String,
    #[serde(default = "default_clock_show")]
    pub clock_show_week: bool,
    #[serde(default = "default_clock_show")]
    pub clock_show_date: bool,
    #[serde(default = "default_clock_show")]
    pub clock_show_seconds: bool,
    #[serde(default = "default_clock_dot_shape")]
    pub clock_dot_shape: String,
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
    #[serde(default)]
    pub blackhole_enabled: bool,
    #[serde(default = "default_blackhole_color")]
    pub blackhole_color: String,
    #[serde(default)]
    pub blackhole_interactive: bool,
    #[serde(default = "default_blackhole_spin_speed")]
    pub blackhole_spin_speed: f32,
    #[serde(default)]
    pub model3d_enabled: bool,
    #[serde(default = "default_model3d_id")]
    pub model3d_id: String,
    #[serde(default = "default_model3d_orbit_style")]
    pub model3d_orbit_style: String,
    #[serde(default = "default_model3d_textures_enabled")]
    pub model3d_textures_enabled: bool,
    #[serde(default = "default_model3d_tree_canopy_shape")]
    pub model3d_tree_canopy_shape: String,
    #[serde(default = "default_model3d_tree_canopy_color")]
    pub model3d_tree_canopy_color: String,
    #[serde(default = "default_model3d_tree_base_shape")]
    pub model3d_tree_base_shape: String,
    #[serde(default = "default_model3d_tree_base_color")]
    pub model3d_tree_base_color: String,
    #[serde(default = "default_model3d_tree_trunk_color")]
    pub model3d_tree_trunk_color: String,
    #[serde(default = "default_model3d_town_seed")]
    pub model3d_town_seed: String,
    #[serde(default = "default_model3d_town_generator_version")]
    pub model3d_town_generator_version: u16,
    #[serde(default = "default_model3d_town_population")]
    pub model3d_town_population: String,
    #[serde(default = "default_model3d_town_density")]
    pub model3d_town_density: String,
    #[serde(default = "default_model3d_town_time")]
    pub model3d_town_time: String,
    #[serde(default)]
    pub model3d_town_favorites: Vec<TownFavorite>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TownFavorite {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub seed: String,
    #[serde(default = "default_model3d_town_generator_version")]
    pub generator_version: u16,
    #[serde(default = "default_model3d_town_population")]
    pub population: String,
    #[serde(default = "default_model3d_town_density")]
    pub density: String,
    #[serde(default = "default_model3d_town_time")]
    pub time: String,
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
            glass_gradient_start: default_glass_gradient_start(),
            glass_gradient_end: default_glass_gradient_end(),
            theme: "system".into(),
            language: "zh".into(),
            hide_title_bar: false,
            mobile_card_mode: false,
            mobile_auto_carousel: true,
            mobile_carousel_interval_s: default_mobile_carousel_interval_s(),
            photo_album_enabled: false,
            photo_album_effect: default_photo_album_effect(),
            music_album_enabled: default_music_album_enabled(),
            active_music_album_id: None,
            clock_enabled: false,
            clock_style: default_clock_style(),
            clock_show_week: true,
            clock_show_date: true,
            clock_show_seconds: true,
            clock_dot_shape: default_clock_dot_shape(),
            audio_visualizer_enabled: false,
            audio_device_id: None,
            audio_visualizer_mode: default_audio_visualizer_mode(),
            audio_color_mode: default_audio_color_mode(),
            audio_color_primary: default_audio_color_primary(),
            audio_color_secondary: default_audio_color_secondary(),
            audio_amplitude: default_audio_amplitude(),
            audio_smoothing: default_audio_smoothing(),
            blackhole_enabled: false,
            blackhole_color: default_blackhole_color(),
            blackhole_interactive: false,
            blackhole_spin_speed: default_blackhole_spin_speed(),
            model3d_enabled: false,
            model3d_id: default_model3d_id(),
            model3d_orbit_style: default_model3d_orbit_style(),
            model3d_textures_enabled: default_model3d_textures_enabled(),
            model3d_tree_canopy_shape: default_model3d_tree_canopy_shape(),
            model3d_tree_canopy_color: default_model3d_tree_canopy_color(),
            model3d_tree_base_shape: default_model3d_tree_base_shape(),
            model3d_tree_base_color: default_model3d_tree_base_color(),
            model3d_tree_trunk_color: default_model3d_tree_trunk_color(),
            model3d_town_seed: default_model3d_town_seed(),
            model3d_town_generator_version: default_model3d_town_generator_version(),
            model3d_town_population: default_model3d_town_population(),
            model3d_town_density: default_model3d_town_density(),
            model3d_town_time: default_model3d_town_time(),
            model3d_town_favorites: Vec::new(),
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

fn normalize_town_seed(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.len() == 8 && trimmed.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        trimmed.to_ascii_lowercase()
    } else {
        default_model3d_town_seed()
    }
}

fn sanitize_town_favorite(mut favorite: TownFavorite) -> Option<TownFavorite> {
    favorite.id = favorite.id.trim().chars().take(128).collect();
    favorite.name = favorite.name.trim().chars().take(40).collect();
    if favorite.id.is_empty() || favorite.name.is_empty() {
        return None;
    }
    favorite.seed = normalize_town_seed(&favorite.seed);
    if favorite.generator_version == 0 {
        favorite.generator_version = default_model3d_town_generator_version();
    }
    if !["low", "medium", "high"].contains(&favorite.population.as_str()) {
        favorite.population = default_model3d_town_population();
    }
    if !["low", "medium", "high"].contains(&favorite.density.as_str()) {
        favorite.density = default_model3d_town_density();
    }
    if !["day", "night"].contains(&favorite.time.as_str()) {
        favorite.time = default_model3d_town_time();
    }
    Some(favorite)
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
        if !is_hex_color(&self.glass_gradient_start) {
            self.glass_gradient_start = default_glass_gradient_start();
        } else {
            self.glass_gradient_start = self.glass_gradient_start.to_ascii_lowercase();
        }
        if !is_hex_color(&self.glass_gradient_end) {
            self.glass_gradient_end = default_glass_gradient_end();
        } else {
            self.glass_gradient_end = self.glass_gradient_end.to_ascii_lowercase();
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
            "particles",
            "grid",
            "aurora",
            "radial",
            "city3d",
            "nebula3d",
            "terrain3d",
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
        if !is_hex_color(&self.blackhole_color) {
            self.blackhole_color = default_blackhole_color();
        } else {
            self.blackhole_color = self.blackhole_color.to_ascii_lowercase();
        }
        self.blackhole_spin_speed = if self.blackhole_spin_speed.is_finite() {
            self.blackhole_spin_speed.clamp(0.0, 3.0)
        } else {
            default_blackhole_spin_speed()
        };
        self.audio_device_id = self.audio_device_id.and_then(|id| {
            let id = id.trim();
            (!id.is_empty() && id.len() <= 1024).then(|| id.to_owned())
        });
        self.active_music_album_id = self.active_music_album_id.and_then(|id| {
            let id = id.trim();
            (!id.is_empty() && id.len() <= 128).then(|| id.to_owned())
        });
        if !["lines", "dial", "pixel", "flip", "object", "dots"]
            .contains(&self.clock_style.as_str())
        {
            self.clock_style = default_clock_style();
        }
        if !["circle", "square", "rounded", "star"].contains(&self.clock_dot_shape.as_str()) {
            self.clock_dot_shape = default_clock_dot_shape();
        }
        if !["solar_system", "tree", "town"].contains(&self.model3d_id.as_str()) {
            self.model3d_id = default_model3d_id();
        }
        if !["solid", "dashed", "hidden"].contains(&self.model3d_orbit_style.as_str()) {
            self.model3d_orbit_style = default_model3d_orbit_style();
        }
        if !["round", "cone", "layered"].contains(&self.model3d_tree_canopy_shape.as_str()) {
            self.model3d_tree_canopy_shape = default_model3d_tree_canopy_shape();
        }
        if !["square", "circle", "heart"].contains(&self.model3d_tree_base_shape.as_str()) {
            self.model3d_tree_base_shape = default_model3d_tree_base_shape();
        }
        if !is_hex_color(&self.model3d_tree_canopy_color) {
            self.model3d_tree_canopy_color = default_model3d_tree_canopy_color();
        } else {
            self.model3d_tree_canopy_color = self.model3d_tree_canopy_color.to_ascii_lowercase();
        }
        if !is_hex_color(&self.model3d_tree_base_color) {
            self.model3d_tree_base_color = default_model3d_tree_base_color();
        } else {
            self.model3d_tree_base_color = self.model3d_tree_base_color.to_ascii_lowercase();
        }
        if !is_hex_color(&self.model3d_tree_trunk_color) {
            self.model3d_tree_trunk_color = default_model3d_tree_trunk_color();
        } else {
            self.model3d_tree_trunk_color = self.model3d_tree_trunk_color.to_ascii_lowercase();
        }
        self.model3d_town_seed = normalize_town_seed(&self.model3d_town_seed);
        if self.model3d_town_generator_version == 0 {
            self.model3d_town_generator_version = default_model3d_town_generator_version();
        }
        if !["low", "medium", "high"].contains(&self.model3d_town_population.as_str()) {
            self.model3d_town_population = default_model3d_town_population();
        }
        if !["low", "medium", "high"].contains(&self.model3d_town_density.as_str()) {
            self.model3d_town_density = default_model3d_town_density();
        }
        if !["day", "night"].contains(&self.model3d_town_time.as_str()) {
            self.model3d_town_time = default_model3d_town_time();
        }
        let mut favorite_names = Vec::new();
        self.model3d_town_favorites = self
            .model3d_town_favorites
            .drain(..)
            .filter_map(|favorite| sanitize_town_favorite(favorite))
            .filter(|favorite| {
                let key = favorite.name.to_lowercase();
                if favorite_names.iter().any(|name| name == &key) {
                    return false;
                }
                favorite_names.push(key);
                true
            })
            .take(50)
            .collect();
        if self.clock_enabled {
            self.photo_album_enabled = false;
            self.music_album_enabled = false;
            self.audio_visualizer_enabled = false;
            self.blackhole_enabled = false;
            self.model3d_enabled = false;
        } else if self.music_album_enabled {
            self.photo_album_enabled = false;
            self.audio_visualizer_enabled = false;
            self.blackhole_enabled = false;
            self.model3d_enabled = false;
        } else if self.audio_visualizer_enabled {
            self.photo_album_enabled = false;
            self.blackhole_enabled = false;
            self.model3d_enabled = false;
        } else if self.photo_album_enabled {
            self.blackhole_enabled = false;
            self.model3d_enabled = false;
        } else if self.blackhole_enabled {
            self.model3d_enabled = false;
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
    fn music_album_config_is_exclusive_and_preserves_active_id() {
        let cfg = AppConfig {
            photo_album_enabled: true,
            audio_visualizer_enabled: true,
            music_album_enabled: true,
            active_music_album_id: Some("  album-1  ".into()),
            ..AppConfig::default()
        }
        .sanitize();
        assert!(cfg.music_album_enabled);
        assert!(!cfg.photo_album_enabled);
        assert!(!cfg.audio_visualizer_enabled);
        assert_eq!(cfg.active_music_album_id.as_deref(), Some("album-1"));

        let disabled = AppConfig {
            music_album_enabled: false,
            active_music_album_id: Some("album-1".into()),
            ..cfg
        }
        .sanitize();
        assert!(!disabled.music_album_enabled);
        assert_eq!(disabled.active_music_album_id.as_deref(), Some("album-1"));
    }

    #[test]
    fn audio_and_photo_modules_remain_exclusive() {
        let cfg = AppConfig {
            photo_album_enabled: true,
            audio_visualizer_enabled: true,
            ..AppConfig::default()
        }
        .sanitize();
        assert!(!cfg.photo_album_enabled);
        assert!(cfg.audio_visualizer_enabled);
    }

    #[test]
    fn legacy_config_gets_music_defaults() {
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
        assert_eq!(cfg.glass_gradient_start, "#d9f8ff");
        assert_eq!(cfg.glass_gradient_end, "#d7f4ee");
        assert!(!cfg.photo_album_enabled);
        assert_eq!(cfg.photo_album_effect, "single");
        assert!(!cfg.audio_visualizer_enabled);
        assert!(!cfg.music_album_enabled);
        assert!(!cfg.clock_enabled);
        assert_eq!(cfg.clock_style, "lines");
        assert!(cfg.clock_show_week);
        assert!(cfg.clock_show_date);
        assert!(cfg.clock_show_seconds);
        assert_eq!(cfg.clock_dot_shape, "circle");
        assert_eq!(cfg.active_music_album_id, None);
        assert_eq!(cfg.audio_visualizer_mode, "particles");
        assert!(!cfg.model3d_enabled);
        assert_eq!(cfg.model3d_id, "solar_system");
        assert_eq!(cfg.model3d_orbit_style, "solid");
        assert!(cfg.model3d_textures_enabled);
        assert_eq!(cfg.model3d_tree_canopy_shape, "layered");
        assert_eq!(cfg.model3d_tree_canopy_color, "#e07a28");
        assert_eq!(cfg.model3d_tree_base_shape, "square");
        assert_eq!(cfg.model3d_tree_base_color, "#8f98a3");
        assert_eq!(cfg.model3d_tree_trunk_color, "#4a301c");
        assert_eq!(cfg.model3d_town_seed, "6f3a9c21");
        assert_eq!(cfg.model3d_town_generator_version, 1);
        assert_eq!(cfg.model3d_town_population, "medium");
        assert_eq!(cfg.model3d_town_density, "medium");
        assert_eq!(cfg.model3d_town_time, "day");
        assert!(cfg.model3d_town_favorites.is_empty());
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
    fn invalid_glass_gradient_colors_use_defaults() {
        let cfg = AppConfig {
            glass_gradient_start: "not-a-color".into(),
            glass_gradient_end: "#AABBCC".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(cfg.glass_gradient_start, "#d9f8ff");
        assert_eq!(cfg.glass_gradient_end, "#aabbcc");
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
    fn clock_module_is_exclusive_and_style_is_sanitized() {
        let cfg = AppConfig {
            clock_enabled: true,
            photo_album_enabled: true,
            audio_visualizer_enabled: true,
            music_album_enabled: true,
            clock_style: "unknown".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert!(cfg.clock_enabled);
        assert!(!cfg.photo_album_enabled);
        assert!(!cfg.audio_visualizer_enabled);
        assert!(!cfg.music_album_enabled);
        assert!(!cfg.blackhole_enabled);
        assert!(!cfg.model3d_enabled);
        assert_eq!(cfg.clock_style, "lines");
    }

    #[test]
    fn clock_dots_style_and_dot_shape_are_sanitized() {
        let ok = AppConfig {
            clock_style: "dots".into(),
            clock_dot_shape: "star".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(ok.clock_style, "dots");
        assert_eq!(ok.clock_dot_shape, "star");

        let bad = AppConfig {
            clock_style: "dots".into(),
            clock_dot_shape: "hex".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(bad.clock_dot_shape, "circle");
    }

    #[test]
    fn blackhole_module_is_exclusive_and_lowest_priority() {
        let clock_wins = AppConfig {
            clock_enabled: true,
            blackhole_enabled: true,
            ..AppConfig::default()
        }
        .sanitize();
        assert!(clock_wins.clock_enabled);
        assert!(!clock_wins.blackhole_enabled);

        let music_wins = AppConfig {
            music_album_enabled: true,
            blackhole_enabled: true,
            photo_album_enabled: true,
            ..AppConfig::default()
        }
        .sanitize();
        assert!(music_wins.music_album_enabled);
        assert!(!music_wins.blackhole_enabled);
        assert!(!music_wins.photo_album_enabled);

        let photo_wins = AppConfig {
            photo_album_enabled: true,
            blackhole_enabled: true,
            ..AppConfig::default()
        }
        .sanitize();
        assert!(photo_wins.photo_album_enabled);
        assert!(!photo_wins.blackhole_enabled);

        let only = AppConfig {
            blackhole_enabled: true,
            ..AppConfig::default()
        }
        .sanitize();
        assert!(only.blackhole_enabled);
        assert!(!only.model3d_enabled);
    }

    #[test]
    fn model3d_module_is_exclusive_and_lowest_priority() {
        let clock_wins = AppConfig {
            clock_enabled: true,
            model3d_enabled: true,
            ..AppConfig::default()
        }
        .sanitize();
        assert!(clock_wins.clock_enabled);
        assert!(!clock_wins.model3d_enabled);

        let blackhole_wins = AppConfig {
            blackhole_enabled: true,
            model3d_enabled: true,
            ..AppConfig::default()
        }
        .sanitize();
        assert!(blackhole_wins.blackhole_enabled);
        assert!(!blackhole_wins.model3d_enabled);

        let only = AppConfig {
            model3d_enabled: true,
            model3d_id: "unknown".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert!(only.model3d_enabled);
        assert_eq!(only.model3d_id, "solar_system");

        let tree = AppConfig {
            model3d_enabled: true,
            model3d_id: "tree".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert!(tree.model3d_enabled);
        assert_eq!(tree.model3d_id, "tree");

        let town = AppConfig {
            model3d_enabled: true,
            model3d_id: "town".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert!(town.model3d_enabled);
        assert_eq!(town.model3d_id, "town");
    }

    #[test]
    fn model3d_orbit_and_textures_are_sanitized() {
        let ok = AppConfig {
            model3d_orbit_style: "dashed".into(),
            model3d_textures_enabled: false,
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(ok.model3d_orbit_style, "dashed");
        assert!(!ok.model3d_textures_enabled);

        let bad = AppConfig {
            model3d_orbit_style: "glow".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(bad.model3d_orbit_style, "solid");
        assert!(bad.model3d_textures_enabled);
    }

    #[test]
    fn model3d_tree_look_is_sanitized() {
        let ok = AppConfig {
            model3d_id: "tree".into(),
            model3d_tree_canopy_shape: "cone".into(),
            model3d_tree_base_shape: "heart".into(),
            model3d_tree_canopy_color: "#FF8800".into(),
            model3d_tree_base_color: "#aabbcc".into(),
            model3d_tree_trunk_color: "#332211".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(ok.model3d_tree_canopy_shape, "cone");
        assert_eq!(ok.model3d_tree_base_shape, "heart");
        assert_eq!(ok.model3d_tree_canopy_color, "#ff8800");
        assert_eq!(ok.model3d_tree_base_color, "#aabbcc");
        assert_eq!(ok.model3d_tree_trunk_color, "#332211");

        let bad = AppConfig {
            model3d_tree_canopy_shape: "blob".into(),
            model3d_tree_base_shape: "star".into(),
            model3d_tree_canopy_color: "orange".into(),
            model3d_tree_base_color: "nope".into(),
            model3d_tree_trunk_color: "#fff".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(bad.model3d_tree_canopy_shape, "layered");
        assert_eq!(bad.model3d_tree_base_shape, "square");
        assert_eq!(bad.model3d_tree_canopy_color, "#e07a28");
        assert_eq!(bad.model3d_tree_base_color, "#8f98a3");
        assert_eq!(bad.model3d_tree_trunk_color, "#4a301c");
    }

    #[test]
    fn model3d_town_config_and_favorites_are_sanitized() {
        let cfg = AppConfig {
            model3d_id: "town".into(),
            model3d_town_seed: "  A1B2C3D4  ".into(),
            model3d_town_generator_version: 0,
            model3d_town_population: "crowded".into(),
            model3d_town_density: "thin".into(),
            model3d_town_time: "sunset".into(),
            model3d_town_favorites: vec![
                TownFavorite {
                    id: " fav-1 ".into(),
                    name: "  Riverside  ".into(),
                    seed: "BAD".into(),
                    generator_version: 0,
                    population: "high".into(),
                    density: "low".into(),
                    time: "night".into(),
                },
                TownFavorite {
                    id: "".into(),
                    name: "ignored".into(),
                    seed: "ffffffff".into(),
                    generator_version: 1,
                    population: "low".into(),
                    density: "medium".into(),
                    time: "day".into(),
                },
            ],
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(cfg.model3d_id, "town");
        assert_eq!(cfg.model3d_town_seed, "a1b2c3d4");
        assert_eq!(cfg.model3d_town_generator_version, 1);
        assert_eq!(cfg.model3d_town_population, "medium");
        assert_eq!(cfg.model3d_town_density, "medium");
        assert_eq!(cfg.model3d_town_time, "day");
        assert_eq!(cfg.model3d_town_favorites.len(), 1);
        assert_eq!(cfg.model3d_town_favorites[0].id, "fav-1");
        assert_eq!(cfg.model3d_town_favorites[0].name, "Riverside");
        assert_eq!(cfg.model3d_town_favorites[0].seed, "6f3a9c21");
    }

    #[test]
    fn model3d_town_favorites_are_limited_to_fifty() {
        let favorites = (0..55)
            .map(|index| TownFavorite {
                id: format!("id-{index}"),
                name: format!("Town {index}"),
                seed: "ffffffff".into(),
                generator_version: 1,
                population: "medium".into(),
                density: "medium".into(),
                time: "day".into(),
            })
            .collect();
        let cfg = AppConfig {
            model3d_town_favorites: favorites,
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(cfg.model3d_town_favorites.len(), 50);
        assert_eq!(cfg.model3d_town_favorites[49].id, "id-49");
    }

    #[test]
    fn model3d_town_favorites_drop_duplicate_names_case_insensitively() {
        let cfg = AppConfig {
            model3d_town_favorites: vec![
                TownFavorite {
                    id: "one".into(),
                    name: "Harbor".into(),
                    seed: "11111111".into(),
                    generator_version: 1,
                    population: "low".into(),
                    density: "low".into(),
                    time: "day".into(),
                },
                TownFavorite {
                    id: "two".into(),
                    name: " harbor ".into(),
                    seed: "22222222".into(),
                    generator_version: 1,
                    population: "high".into(),
                    density: "high".into(),
                    time: "night".into(),
                },
            ],
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(cfg.model3d_town_favorites.len(), 1);
        assert_eq!(cfg.model3d_town_favorites[0].id, "one");
    }

    #[test]
    fn blackhole_look_is_sanitized() {
        let bad = AppConfig {
            blackhole_color: "not-a-color".into(),
            blackhole_spin_speed: 9.0,
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(bad.blackhole_color, "#e8c09a");
        assert_eq!(bad.blackhole_spin_speed, 3.0);

        let low = AppConfig {
            blackhole_spin_speed: -1.0,
            blackhole_color: "#AABBCC".into(),
            ..AppConfig::default()
        }
        .sanitize();
        assert_eq!(low.blackhole_spin_speed, 0.0);
        assert_eq!(low.blackhole_color, "#aabbcc");
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
