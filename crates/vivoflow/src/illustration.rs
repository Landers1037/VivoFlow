use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Multipart, Path as AxumPath, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::storage::StorageManager;

const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
const MAX_BATCH_IMAGES: usize = 50;
const CURRENT_IMAGE_VERSION: u32 = 1;

fn default_image_version() -> u32 {
    CURRENT_IMAGE_VERSION
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IllustrationSettings {
    pub interval_s: u64,
    pub shuffle: bool,
    pub preset: String,
    pub target_short_edge: u16,
    pub palette_size: u16,
    pub smoothing: f32,
    pub contrast: f32,
    pub saturation: f32,
    pub gamma: f32,
    pub dithering: String,
    pub dithering_strength: f32,
    pub edge_enhancement: f32,
    pub sharpen: f32,
}

impl Default for IllustrationSettings {
    fn default() -> Self {
        Self {
            interval_s: 8,
            shuffle: false,
            preset: "balanced".into(),
            target_short_edge: 128,
            palette_size: 32,
            smoothing: 0.18,
            contrast: 0.08,
            saturation: 0.08,
            gamma: 1.0,
            dithering: "ordered".into(),
            dithering_strength: 0.20,
            edge_enhancement: 0.12,
            sharpen: 0.12,
        }
    }
}

impl IllustrationSettings {
    fn sanitize(mut self) -> Self {
        self.interval_s = self.interval_s.clamp(2, 60);
        self.preset = match self.preset.trim() {
            "auto" | "balanced" | "detailed" | "retro" | "painting" | "8bit" | "custom" => {
                self.preset.trim().into()
            }
            _ => "balanced".into(),
        };
        self.target_short_edge = self.target_short_edge.clamp(80, 256);
        self.palette_size = match self.palette_size {
            8 | 12 | 16 | 24 | 32 | 40 | 48 | 64 => self.palette_size,
            _ => 32,
        };
        self.smoothing = finite_clamp(self.smoothing, 0.0, 0.5, 0.18);
        self.contrast = finite_clamp(self.contrast, -0.3, 0.5, 0.08);
        self.saturation = finite_clamp(self.saturation, -0.3, 0.5, 0.08);
        self.gamma = finite_clamp(self.gamma, 0.5, 1.5, 1.0);
        self.dithering = match self.dithering.trim() {
            "none" | "ordered" | "floyd_steinberg" => self.dithering.trim().into(),
            _ => "ordered".into(),
        };
        self.dithering_strength = finite_clamp(self.dithering_strength, 0.0, 0.5, 0.2);
        if self.dithering == "floyd_steinberg" {
            self.dithering_strength = self.dithering_strength.min(0.35);
        }
        self.edge_enhancement = finite_clamp(self.edge_enhancement, 0.0, 0.25, 0.12);
        self.sharpen = finite_clamp(self.sharpen, 0.0, 0.25, 0.12);
        self
    }
}

fn finite_clamp(value: f32, min: f32, max: f32, fallback: f32) -> f32 {
    if value.is_finite() {
        value.clamp(min, max)
    } else {
        fallback
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredIllustrationImage {
    id: String,
    #[serde(default = "default_image_version")]
    version: u32,
    file_name: String,
    original_name: String,
    mime_type: String,
    size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredIllustrations {
    #[serde(default)]
    settings: IllustrationSettings,
    #[serde(default)]
    images: Vec<StoredIllustrationImage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IllustrationImage {
    pub id: String,
    pub version: u32,
    pub original_name: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub content_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct IllustrationsResponse {
    pub settings: IllustrationSettings,
    pub images: Vec<IllustrationImage>,
}

impl StoredIllustrations {
    fn response(&self) -> IllustrationsResponse {
        IllustrationsResponse {
            settings: self.settings.clone(),
            images: self
                .images
                .iter()
                .map(|image| IllustrationImage {
                    id: image.id.clone(),
                    version: image.version,
                    original_name: image.original_name.clone(),
                    mime_type: image.mime_type.clone(),
                    size_bytes: image.size_bytes,
                    content_url: format!("/api/illustrations/images/{}/content", image.id),
                })
                .collect(),
        }
    }
}

#[derive(Clone)]
pub struct IllustrationStore {
    data: Arc<RwLock<StoredIllustrations>>,
    metadata: Arc<PathBuf>,
    storage: StorageManager,
}

impl IllustrationStore {
    pub fn load(storage: StorageManager) -> anyhow::Result<Self> {
        let config_path = crate::config::config_file_path();
        let base = config_path.parent().unwrap_or_else(|| Path::new("."));
        Self::load_from(base.join("illustrations.json"), storage)
    }

    fn load_from(metadata: PathBuf, storage: StorageManager) -> anyhow::Result<Self> {
        fs::create_dir_all(storage.category_dir("illustrations"))?;
        let data = match fs::read_to_string(&metadata) {
            Ok(raw) => serde_json::from_str::<StoredIllustrations>(&raw).unwrap_or_else(|_| {
                StoredIllustrations {
                    settings: IllustrationSettings::default(),
                    images: Vec::new(),
                }
            }),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => StoredIllustrations {
                settings: IllustrationSettings::default(),
                images: Vec::new(),
            },
            Err(error) => return Err(error.into()),
        };
        let mut data = data;
        data.settings = data.settings.sanitize();
        Ok(Self {
            data: Arc::new(RwLock::new(data)),
            metadata: Arc::new(metadata),
            storage,
        })
    }

    #[cfg(test)]
    fn load_test(root: PathBuf) -> anyhow::Result<Self> {
        let storage = StorageManager::from_test_root(root.clone())?;
        Self::load_from(root.join("illustrations.json"), storage)
    }

    fn save_locked(&self, data: &StoredIllustrations) -> Result<(), IllustrationError> {
        if let Some(parent) = self.metadata.parent() {
            fs::create_dir_all(parent).map_err(IllustrationError::internal)?;
        }
        let raw = serde_json::to_vec_pretty(data).map_err(IllustrationError::internal)?;
        let temp = self
            .metadata
            .with_extension(format!("json.tmp.{}", Uuid::new_v4()));
        fs::write(&temp, raw).map_err(IllustrationError::internal)?;
        if self.metadata.exists() {
            fs::remove_file(self.metadata.as_ref()).map_err(IllustrationError::internal)?;
        }
        fs::rename(temp, self.metadata.as_ref()).map_err(IllustrationError::internal)
    }

    fn image_path(&self, image: &StoredIllustrationImage) -> PathBuf {
        self.storage
            .category_dir("illustrations")
            .join(&image.file_name)
    }
}

#[derive(Debug)]
struct IllustrationError(StatusCode, String);

impl IllustrationError {
    fn bad(message: impl Into<String>) -> Self {
        Self(StatusCode::BAD_REQUEST, message.into())
    }
    fn not_found(message: impl Into<String>) -> Self {
        Self(StatusCode::NOT_FOUND, message.into())
    }
    fn internal(error: impl std::fmt::Display) -> Self {
        tracing::error!("illustration operation failed: {error}");
        Self(
            StatusCode::INTERNAL_SERVER_ERROR,
            "illustration storage operation failed".into(),
        )
    }
}

impl IntoResponse for IllustrationError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

#[derive(Debug, Deserialize)]
struct OrderedIds {
    ids: Vec<String>,
}

pub fn router(store: IllustrationStore) -> Router {
    Router::new()
        // Keep the collection PUT as a compatibility alias; new clients use
        // the explicit `/settings` endpoint from the public API contract.
        .route("/api/illustrations", get(list).put(update_settings))
        .route("/api/illustrations/settings", put(update_settings))
        .route(
            "/api/illustrations/images",
            post(upload).layer(DefaultBodyLimit::max(
                MAX_IMAGE_BYTES * MAX_BATCH_IMAGES + 1024 * 1024,
            )),
        )
        .route("/api/illustrations/images/order", put(order))
        .route(
            "/api/illustrations/images/{id}",
            axum::routing::delete(remove),
        )
        .route("/api/illustrations/images/{id}/content", get(content))
        .with_state(store)
}

async fn list(State(store): State<IllustrationStore>) -> Json<IllustrationsResponse> {
    Json(store.data.read().response())
}

async fn update_settings(
    State(store): State<IllustrationStore>,
    Json(settings): Json<IllustrationSettings>,
) -> Result<Json<IllustrationsResponse>, IllustrationError> {
    let _guard = store.storage.operation_lock();
    let mut data = store.data.write();
    let previous = data.settings.clone();
    data.settings = settings.sanitize();
    if let Err(error) = store.save_locked(&data) {
        data.settings = previous;
        return Err(error);
    }
    Ok(Json(data.response()))
}

async fn upload(
    State(store): State<IllustrationStore>,
    mut multipart: Multipart,
) -> Result<Json<IllustrationsResponse>, IllustrationError> {
    let mut pending = Vec::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(IllustrationError::internal)?
    {
        if field.name() != Some("images") {
            continue;
        }
        if pending.len() >= MAX_BATCH_IMAGES {
            return Err(IllustrationError::bad(
                "a batch may contain at most 50 images",
            ));
        }
        let original_name = field.file_name().unwrap_or("image").replace('\0', "");
        let original_name: String = original_name.chars().take(255).collect();
        let bytes = field.bytes().await.map_err(IllustrationError::internal)?;
        if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
            return Err(IllustrationError::bad(
                "each image must contain 1 byte to 25 MB",
            ));
        }
        let (mime_type, extension) = image_kind(&bytes).ok_or_else(|| {
            IllustrationError::bad("supported formats are JPEG, PNG, WebP and AVIF")
        })?;
        pending.push((original_name, bytes, mime_type, extension));
    }
    if pending.is_empty() {
        return Err(IllustrationError::bad("no images were provided"));
    }

    let _guard = store.storage.operation_lock();
    let mut data = store.data.write();
    let previous = data.clone();
    let directory = store.storage.category_dir("illustrations");
    fs::create_dir_all(&directory).map_err(IllustrationError::internal)?;
    let mut created = Vec::new();
    for (original_name, bytes, mime_type, extension) in pending {
        let id = Uuid::new_v4().to_string();
        let file_name = format!("{id}.{extension}");
        let path = directory.join(&file_name);
        if let Err(error) = fs::write(&path, &bytes) {
            for file in created {
                let _ = fs::remove_file(file);
            }
            return Err(IllustrationError::internal(error));
        }
        created.push(path);
        data.images.push(StoredIllustrationImage {
            id,
            version: CURRENT_IMAGE_VERSION,
            file_name,
            original_name,
            mime_type: mime_type.into(),
            size_bytes: bytes.len() as u64,
        });
    }
    if let Err(error) = store.save_locked(&data) {
        *data = previous;
        for file in created {
            let _ = fs::remove_file(file);
        }
        return Err(error);
    }
    Ok(Json(data.response()))
}

async fn order(
    State(store): State<IllustrationStore>,
    Json(input): Json<OrderedIds>,
) -> Result<Json<IllustrationsResponse>, IllustrationError> {
    let _guard = store.storage.operation_lock();
    let mut data = store.data.write();
    let ids: std::collections::HashSet<_> =
        data.images.iter().map(|image| image.id.clone()).collect();
    let supplied: std::collections::HashSet<_> = input.ids.iter().cloned().collect();
    if ids != supplied || ids.len() != input.ids.len() {
        return Err(IllustrationError::bad(
            "order must contain every image exactly once",
        ));
    }
    let previous = data.images.clone();
    data.images
        .sort_by_key(|image| input.ids.iter().position(|id| id == &image.id).unwrap());
    if let Err(error) = store.save_locked(&data) {
        data.images = previous;
        return Err(error);
    }
    Ok(Json(data.response()))
}

async fn remove(
    State(store): State<IllustrationStore>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<IllustrationsResponse>, IllustrationError> {
    let _guard = store.storage.operation_lock();
    let mut data = store.data.write();
    let index = data
        .images
        .iter()
        .position(|image| image.id == id)
        .ok_or_else(|| IllustrationError::not_found("illustration not found"))?;
    let removed = data.images.remove(index);
    if let Err(error) = store.save_locked(&data) {
        data.images.insert(index, removed);
        return Err(error);
    }
    let _ = fs::remove_file(store.image_path(&removed));
    Ok(Json(data.response()))
}

async fn content(
    State(store): State<IllustrationStore>,
    AxumPath(id): AxumPath<String>,
) -> Result<Response, IllustrationError> {
    let (path, mime_type) = {
        let data = store.data.read();
        let image = data
            .images
            .iter()
            .find(|image| image.id == id)
            .ok_or_else(|| IllustrationError::not_found("illustration not found"))?;
        (store.image_path(image), image.mime_type.clone())
    };
    let bytes = tokio::fs::read(path).await.map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            IllustrationError::not_found("illustration file not found")
        } else {
            IllustrationError::internal(error)
        }
    })?;
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&mime_type).map_err(IllustrationError::internal)?,
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=3600"),
    );
    Ok(response)
}

fn image_kind(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some(("image/jpeg", "jpg"))
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        Some(("image/png", "png"))
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("image/webp", "webp"))
    } else if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
        // The major brand is usually `avif`/`avis`, but valid files may use a
        // compatible brand such as `mif1`; inspect the complete ftyp header.
        let brands = &bytes[8..bytes.len().min(128)];
        if brands
            .windows(4)
            .any(|brand| brand == b"avif" || brand == b"avis")
        {
            Some(("image/avif", "avif"))
        } else {
            None
        }
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_are_clamped_and_floyd_is_limited() {
        let settings = IllustrationSettings {
            target_short_edge: 1,
            palette_size: 3,
            dithering: "floyd_steinberg".into(),
            dithering_strength: 2.0,
            ..IllustrationSettings::default()
        }
        .sanitize();
        assert_eq!(settings.target_short_edge, 80);
        assert_eq!(settings.palette_size, 32);
        assert_eq!(settings.dithering_strength, 0.35);
    }

    #[test]
    fn accepts_only_common_image_signatures() {
        assert_eq!(
            image_kind(&[0xff, 0xd8, 0xff, 0]),
            Some(("image/jpeg", "jpg"))
        );
        assert_eq!(
            image_kind(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]),
            Some(("image/png", "png"))
        );
        let webp = *b"RIFF0000WEBP";
        assert_eq!(image_kind(&webp), Some(("image/webp", "webp")));
        let avif = *b"0000ftypavif";
        assert_eq!(image_kind(&avif), Some(("image/avif", "avif")));
        assert_eq!(image_kind(b"not-an-image"), None);
    }

    #[test]
    fn stores_original_images_without_generated_output() {
        let root = std::env::temp_dir().join(format!("vivoflow-illustration-{}", Uuid::new_v4()));
        let store = IllustrationStore::load_test(root.clone()).unwrap();
        let mut data = store.data.write();
        data.images.push(StoredIllustrationImage {
            id: "one".into(),
            version: CURRENT_IMAGE_VERSION,
            file_name: "one.png".into(),
            original_name: "source.png".into(),
            mime_type: "image/png".into(),
            size_bytes: 4,
        });
        store.save_locked(&data).unwrap();
        assert!(root.join("illustrations.json").exists());
        assert!(!root.join("illustrations/one-pixel-art.png").exists());
        let _ = fs::remove_dir_all(root);
    }
}
