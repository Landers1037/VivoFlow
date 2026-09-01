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
const MAX_IMAGES: usize = 50;
const CURRENT_IMAGE_VERSION: u32 = 1;

fn default_image_version() -> u32 {
    CURRENT_IMAGE_VERSION
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredParticleImage {
    id: String,
    #[serde(default = "default_image_version")]
    version: u32,
    file_name: String,
    original_name: String,
    mime_type: String,
    size_bytes: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct StoredParticles {
    #[serde(default)]
    active_image_id: Option<String>,
    #[serde(default)]
    images: Vec<StoredParticleImage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParticleImage {
    pub id: String,
    pub version: u32,
    pub original_name: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub content_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParticleLibraryResponse {
    pub active_image_id: Option<String>,
    pub images: Vec<ParticleImage>,
}

impl StoredParticles {
    fn sanitize(&mut self) {
        self.images.truncate(MAX_IMAGES);
        if self
            .active_image_id
            .as_ref()
            .is_none_or(|id| !self.images.iter().any(|image| &image.id == id))
        {
            self.active_image_id = self.images.first().map(|image| image.id.clone());
        }
    }

    fn response(&self) -> ParticleLibraryResponse {
        ParticleLibraryResponse {
            active_image_id: self.active_image_id.clone(),
            images: self
                .images
                .iter()
                .map(|image| ParticleImage {
                    id: image.id.clone(),
                    version: image.version,
                    original_name: image.original_name.clone(),
                    mime_type: image.mime_type.clone(),
                    size_bytes: image.size_bytes,
                    content_url: format!("/api/particles/images/{}/content", image.id),
                })
                .collect(),
        }
    }

    fn set_active(&mut self, id: &str) -> bool {
        if !self.images.iter().any(|image| image.id == id) {
            return false;
        }
        self.active_image_id = Some(id.to_owned());
        true
    }

    fn remove_image(&mut self, id: &str) -> Option<StoredParticleImage> {
        let index = self.images.iter().position(|image| image.id == id)?;
        let removed = self.images.remove(index);
        if self.active_image_id.as_deref() == Some(id) {
            self.active_image_id = self
                .images
                .get(index.min(self.images.len().saturating_sub(1)))
                .map(|image| image.id.clone());
        }
        Some(removed)
    }
}

#[derive(Clone)]
pub struct ParticleStore {
    data: Arc<RwLock<StoredParticles>>,
    metadata: Arc<PathBuf>,
    storage: StorageManager,
}

impl ParticleStore {
    pub fn load(storage: StorageManager) -> anyhow::Result<Self> {
        let config_path = crate::config::config_file_path();
        let base = config_path.parent().unwrap_or_else(|| Path::new("."));
        Self::load_from(base.join("particles.json"), storage)
    }

    fn load_from(metadata: PathBuf, storage: StorageManager) -> anyhow::Result<Self> {
        fs::create_dir_all(storage.category_dir("particles"))?;
        let mut data = match fs::read_to_string(&metadata) {
            Ok(raw) => serde_json::from_str::<StoredParticles>(&raw).unwrap_or_default(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                StoredParticles::default()
            }
            Err(error) => return Err(error.into()),
        };
        data.sanitize();
        Ok(Self {
            data: Arc::new(RwLock::new(data)),
            metadata: Arc::new(metadata),
            storage,
        })
    }

    fn save_locked(&self, data: &StoredParticles) -> Result<(), ParticleError> {
        if let Some(parent) = self.metadata.parent() {
            fs::create_dir_all(parent).map_err(ParticleError::internal)?;
        }
        let raw = serde_json::to_vec_pretty(data).map_err(ParticleError::internal)?;
        let temp = self
            .metadata
            .with_extension(format!("json.tmp.{}", Uuid::new_v4()));
        fs::write(&temp, raw).map_err(ParticleError::internal)?;
        let backup = self
            .metadata
            .with_extension(format!("json.bak.{}", Uuid::new_v4()));
        if self.metadata.exists() {
            fs::rename(self.metadata.as_ref(), &backup).map_err(ParticleError::internal)?;
        }
        match fs::rename(&temp, self.metadata.as_ref()) {
            Ok(()) => {
                let _ = fs::remove_file(backup);
                Ok(())
            }
            Err(error) => {
                let _ = fs::remove_file(temp);
                if backup.exists() {
                    let _ = fs::rename(backup, self.metadata.as_ref());
                }
                Err(ParticleError::internal(error))
            }
        }
    }

    fn image_path(&self, image: &StoredParticleImage) -> PathBuf {
        self.storage
            .category_dir("particles")
            .join(&image.file_name)
    }
}

#[derive(Debug)]
struct ParticleError(StatusCode, String);

impl ParticleError {
    fn bad(message: impl Into<String>) -> Self {
        Self(StatusCode::BAD_REQUEST, message.into())
    }
    fn not_found(message: impl Into<String>) -> Self {
        Self(StatusCode::NOT_FOUND, message.into())
    }
    fn internal(error: impl std::fmt::Display) -> Self {
        tracing::error!("particle operation failed: {error}");
        Self(
            StatusCode::INTERNAL_SERVER_ERROR,
            "particle storage operation failed".into(),
        )
    }
}

impl IntoResponse for ParticleError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

#[derive(Debug, Deserialize)]
struct ActiveImage {
    id: String,
}

pub fn router(store: ParticleStore) -> Router {
    Router::new()
        .route("/api/particles", get(list))
        .route("/api/particles/active", put(set_active))
        .route(
            "/api/particles/images",
            post(upload).layer(DefaultBodyLimit::max(
                MAX_IMAGE_BYTES * MAX_IMAGES + 1024 * 1024,
            )),
        )
        .route("/api/particles/images/{id}", axum::routing::delete(remove))
        .route("/api/particles/images/{id}/content", get(content))
        .with_state(store)
}

async fn list(State(store): State<ParticleStore>) -> Json<ParticleLibraryResponse> {
    Json(store.data.read().response())
}

async fn set_active(
    State(store): State<ParticleStore>,
    Json(input): Json<ActiveImage>,
) -> Result<Json<ParticleLibraryResponse>, ParticleError> {
    let _guard = store.storage.operation_lock();
    let mut data = store.data.write();
    let previous = data.active_image_id.clone();
    if !data.set_active(&input.id) {
        return Err(ParticleError::not_found("particle image not found"));
    }
    if let Err(error) = store.save_locked(&data) {
        data.active_image_id = previous;
        return Err(error);
    }
    Ok(Json(data.response()))
}

async fn upload(
    State(store): State<ParticleStore>,
    mut multipart: Multipart,
) -> Result<Json<ParticleLibraryResponse>, ParticleError> {
    let mut pending = Vec::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(ParticleError::internal)?
    {
        if field.name() != Some("images") {
            continue;
        }
        if pending.len() >= MAX_IMAGES {
            return Err(ParticleError::bad(
                "at most 50 particle images are supported",
            ));
        }
        let original_name: String = field
            .file_name()
            .unwrap_or("image")
            .replace('\0', "")
            .chars()
            .take(255)
            .collect();
        let bytes = field.bytes().await.map_err(ParticleError::internal)?;
        if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
            return Err(ParticleError::bad(
                "each image must contain 1 byte to 25 MB",
            ));
        }
        let (mime_type, extension) = crate::illustration::image_kind(&bytes)
            .ok_or_else(|| ParticleError::bad("supported formats are JPEG, PNG, WebP and AVIF"))?;
        pending.push((original_name, bytes, mime_type, extension));
    }
    if pending.is_empty() {
        return Err(ParticleError::bad("no images were provided"));
    }

    let _guard = store.storage.operation_lock();
    let mut data = store.data.write();
    if data.images.len() + pending.len() > MAX_IMAGES {
        return Err(ParticleError::bad(
            "at most 50 particle images are supported",
        ));
    }
    let previous = data.clone();
    let directory = store.storage.category_dir("particles");
    fs::create_dir_all(&directory).map_err(ParticleError::internal)?;
    let mut created = Vec::new();
    for (original_name, bytes, mime_type, extension) in pending {
        let id = Uuid::new_v4().to_string();
        let file_name = format!("{id}.{extension}");
        let path = directory.join(&file_name);
        if let Err(error) = fs::write(&path, &bytes) {
            for file in created {
                let _ = fs::remove_file(file);
            }
            return Err(ParticleError::internal(error));
        }
        created.push(path);
        data.images.push(StoredParticleImage {
            id: id.clone(),
            version: CURRENT_IMAGE_VERSION,
            file_name,
            original_name,
            mime_type: mime_type.into(),
            size_bytes: bytes.len() as u64,
        });
        if data.active_image_id.is_none() {
            data.active_image_id = Some(id);
        }
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

async fn remove(
    State(store): State<ParticleStore>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<ParticleLibraryResponse>, ParticleError> {
    let _guard = store.storage.operation_lock();
    let mut data = store.data.write();
    let previous = data.clone();
    let removed = data
        .remove_image(&id)
        .ok_or_else(|| ParticleError::not_found("particle image not found"))?;
    if let Err(error) = store.save_locked(&data) {
        *data = previous;
        return Err(error);
    }
    let _ = fs::remove_file(store.image_path(&removed));
    Ok(Json(data.response()))
}

async fn content(
    State(store): State<ParticleStore>,
    AxumPath(id): AxumPath<String>,
) -> Result<Response, ParticleError> {
    let (path, mime_type) = {
        let data = store.data.read();
        let image = data
            .images
            .iter()
            .find(|image| image.id == id)
            .ok_or_else(|| ParticleError::not_found("particle image not found"))?;
        (store.image_path(image), image.mime_type.clone())
    };
    let bytes = tokio::fs::read(path).await.map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            ParticleError::not_found("particle image file not found")
        } else {
            ParticleError::internal(error)
        }
    })?;
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&mime_type).map_err(ParticleError::internal)?,
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=3600"),
    );
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_active_image_falls_back_to_first() {
        let mut data = StoredParticles {
            active_image_id: Some("missing".into()),
            images: vec![StoredParticleImage {
                id: "one".into(),
                version: 1,
                file_name: "one.png".into(),
                original_name: "one.png".into(),
                mime_type: "image/png".into(),
                size_bytes: 8,
            }],
        };
        data.sanitize();
        assert_eq!(data.active_image_id.as_deref(), Some("one"));
    }

    #[test]
    fn removing_active_image_selects_its_neighbor() {
        let image = |id: &str| StoredParticleImage {
            id: id.into(),
            version: 1,
            file_name: format!("{id}.png"),
            original_name: format!("{id}.png"),
            mime_type: "image/png".into(),
            size_bytes: 8,
        };
        let mut data = StoredParticles {
            active_image_id: Some("two".into()),
            images: vec![image("one"), image("two"), image("three")],
        };
        assert_eq!(data.remove_image("two").unwrap().id, "two");
        assert_eq!(data.active_image_id.as_deref(), Some("three"));
        assert!(data.set_active("one"));
        assert_eq!(data.active_image_id.as_deref(), Some("one"));
        assert!(!data.set_active("missing"));
    }
}
