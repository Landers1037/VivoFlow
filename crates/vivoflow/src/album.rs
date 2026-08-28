use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;

use crate::storage::StorageManager;
use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Multipart, Path, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, patch, post, put};
use axum::{Json, Router};
use chrono::NaiveDate;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
const MAX_BATCH_IMAGES: usize = 50;
const MAX_SCAN_IMAGES: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredImage {
    id: String,
    file_name: String,
    original_name: String,
    mime_type: String,
    size_bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredAlbum {
    id: String,
    title: String,
    description: Option<String>,
    date: Option<String>,
    show_on_home: bool,
    shuffle: bool,
    interval_s: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source_dir: Option<String>,
    #[serde(default)]
    images: Vec<StoredImage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AlbumImage {
    id: String,
    original_name: String,
    mime_type: String,
    size_bytes: u64,
    content_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Album {
    id: String,
    title: String,
    description: Option<String>,
    date: Option<String>,
    show_on_home: bool,
    shuffle: bool,
    interval_s: u64,
    source_dir: Option<String>,
    images: Vec<AlbumImage>,
}

impl From<&StoredAlbum> for Album {
    fn from(album: &StoredAlbum) -> Self {
        Self {
            id: album.id.clone(),
            title: album.title.clone(),
            description: album.description.clone(),
            date: album.date.clone(),
            show_on_home: album.show_on_home,
            shuffle: album.shuffle,
            interval_s: album.interval_s,
            source_dir: album.source_dir.clone(),
            images: album
                .images
                .iter()
                .map(|image| AlbumImage {
                    id: image.id.clone(),
                    original_name: image.original_name.clone(),
                    mime_type: image.mime_type.clone(),
                    size_bytes: image.size_bytes,
                    content_url: format!("/api/albums/{}/images/{}/content", album.id, image.id),
                })
                .collect(),
        }
    }
}

#[derive(Clone)]
pub struct AlbumStore {
    albums: Arc<RwLock<Vec<StoredAlbum>>>,
    metadata_path: Arc<PathBuf>,
    storage: StorageManager,
}

impl AlbumStore {
    pub fn load(storage: StorageManager) -> anyhow::Result<Self> {
        let config_path = crate::config::config_file_path();
        let base = config_path.parent().unwrap_or_else(|| FsPath::new("."));
        Self::load_from_storage(base.join("albums.json"), storage)
    }

    fn load_from_storage(metadata_path: PathBuf, storage: StorageManager) -> anyhow::Result<Self> {
        fs::create_dir_all(storage.category_dir("albums"))?;
        let albums = match fs::read_to_string(&metadata_path) {
            Ok(raw) => serde_json::from_str(&raw).unwrap_or_else(|error| {
                tracing::warn!(
                    "invalid album metadata at {}: {error}",
                    metadata_path.display()
                );
                Vec::new()
            }),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(error.into()),
        };
        Ok(Self {
            albums: Arc::new(RwLock::new(albums)),
            metadata_path: Arc::new(metadata_path),
            storage,
        })
    }

    #[cfg(test)]
    fn load_from(metadata_path: PathBuf, media_root: PathBuf) -> anyhow::Result<Self> {
        let root = media_root
            .parent()
            .map(FsPath::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        let storage = StorageManager::from_test_root(root)?;
        Self::load_from_storage(metadata_path, storage)
    }

    fn save_locked(&self, albums: &[StoredAlbum]) -> Result<(), ApiError> {
        if let Some(parent) = self.metadata_path.parent() {
            fs::create_dir_all(parent).map_err(ApiError::internal)?;
        }
        let temp = self.metadata_path.with_extension("json.tmp");
        let raw = serde_json::to_vec_pretty(albums).map_err(ApiError::internal)?;
        fs::write(&temp, raw).map_err(ApiError::internal)?;
        if self.metadata_path.exists() {
            fs::remove_file(self.metadata_path.as_ref()).map_err(ApiError::internal)?;
        }
        fs::rename(temp, self.metadata_path.as_ref()).map_err(ApiError::internal)
    }

    fn album_dir(&self, album_id: &str) -> PathBuf {
        self.storage.category_dir("albums").join(album_id)
    }

    fn image_file_path(&self, album_id: &str, image: &StoredImage) -> PathBuf {
        image
            .source_path
            .as_deref()
            .map(PathBuf::from)
            .unwrap_or_else(|| self.album_dir(album_id).join(&image.file_name))
    }

    fn import_from_directory(&self, album_id: &str, raw_path: &str) -> Result<Album, ApiError> {
        let _storage_guard = self.storage.operation_lock();
        let dir = resolve_directory(raw_path)?;
        let discovered = collect_local_images(&dir)?;
        let source_dir = raw_path.trim().to_string();
        let mut albums = self.albums.write();
        let index = albums
            .iter()
            .position(|album| album.id == album_id)
            .ok_or_else(|| ApiError::not_found("album not found"))?;
        let previous = albums[index].clone();
        albums[index].source_dir = Some(source_dir);
        let mut existing: HashSet<String> = albums[index]
            .images
            .iter()
            .filter_map(|image| image.source_path.clone())
            .collect();
        let mut added = 0;
        for image in discovered {
            if !existing.insert(image.source_path.clone()) {
                continue;
            }
            if added >= MAX_SCAN_IMAGES {
                break;
            }
            let id = Uuid::new_v4().to_string();
            albums[index].images.push(StoredImage {
                file_name: format!("{id}.{}", image.extension),
                original_name: image.original_name,
                mime_type: image.mime_type,
                size_bytes: image.size_bytes,
                source_path: Some(image.source_path),
                id,
            });
            added += 1;
        }
        if let Err(error) = self.save_locked(&albums) {
            albums[index] = previous;
            return Err(error);
        }
        Ok(Album::from(&albums[index]))
    }
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    fn internal(error: impl std::fmt::Display) -> Self {
        tracing::error!("album operation failed: {error}");
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: "album storage operation failed".into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

#[derive(Debug, Deserialize)]
struct CreateAlbum {
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    show_on_home: bool,
    #[serde(default)]
    shuffle: bool,
    #[serde(default = "default_interval")]
    interval_s: u64,
}

#[derive(Debug, Deserialize)]
struct UpdateAlbum {
    title: String,
    description: Option<String>,
    date: Option<String>,
    show_on_home: bool,
    shuffle: bool,
    interval_s: u64,
}

#[derive(Debug, Deserialize)]
struct OrderedIds {
    ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ImportPath {
    path: String,
}

struct LocalImage {
    original_name: String,
    source_path: String,
    mime_type: String,
    extension: &'static str,
    size_bytes: u64,
}

fn default_interval() -> u64 {
    5
}

fn image_kind(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some(("image/jpeg", "jpg"))
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        Some(("image/png", "png"))
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some(("image/gif", "gif"))
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("image/webp", "webp"))
    } else if bytes.len() >= 12
        && &bytes[4..8] == b"ftyp"
        && (&bytes[8..12] == b"avif" || &bytes[8..12] == b"avis")
    {
        Some(("image/avif", "avif"))
    } else {
        None
    }
}

fn image_extension_ok(path: &FsPath) -> bool {
    matches!(
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase())
            .as_deref(),
        Some("jpg" | "jpeg" | "png" | "gif" | "webp" | "avif")
    )
}

fn stored_source_path(path: &FsPath) -> String {
    let raw = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .into_owned();
    raw.strip_prefix(r"\\?\").unwrap_or(&raw).to_string()
}

fn resolve_directory(raw: &str) -> Result<PathBuf, ApiError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request("path must not be empty"));
    }
    if trimmed.chars().count() > 4096 {
        return Err(ApiError::bad_request("path is too long"));
    }
    let path = PathBuf::from(trimmed);
    let meta = fs::metadata(&path).map_err(|_| ApiError::bad_request("path does not exist"))?;
    if !meta.is_dir() {
        return Err(ApiError::bad_request("path must be a directory"));
    }
    Ok(path)
}

fn inspect_image_file(path: &FsPath) -> Option<LocalImage> {
    let mut file = fs::File::open(path).ok()?;
    let mut header = [0u8; 16];
    let read = file.read(&mut header).ok()?;
    let (mime_type, extension) = image_kind(&header[..read])?;
    let size_bytes = file.metadata().ok()?.len();
    if size_bytes == 0 || size_bytes > MAX_IMAGE_BYTES as u64 {
        return None;
    }
    let original_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("image")
        .replace('\0', "");
    let original_name: String = original_name.chars().take(255).collect();
    Some(LocalImage {
        original_name,
        source_path: stored_source_path(path),
        mime_type: mime_type.to_string(),
        extension,
        size_bytes,
    })
}

fn collect_local_images(dir: &FsPath) -> Result<Vec<LocalImage>, ApiError> {
    let mut files = Vec::new();
    let entries = fs::read_dir(dir)
        .map_err(|error| ApiError::bad_request(format!("cannot read directory: {error}")))?;
    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let path = entry.path();
        if path.is_file() && image_extension_ok(&path) {
            files.push(path);
        }
    }
    files.sort();
    Ok(files
        .iter()
        .filter_map(|path| inspect_image_file(path))
        .collect())
}

fn validate_fields(
    title: String,
    description: Option<String>,
    date: Option<String>,
    interval_s: u64,
) -> Result<(String, Option<String>, Option<String>, u64), ApiError> {
    let title = title.trim().to_string();
    if title.is_empty() || title.chars().count() > 120 {
        return Err(ApiError::bad_request(
            "title must contain 1 to 120 characters",
        ));
    }
    let description = description
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if description
        .as_ref()
        .is_some_and(|value| value.chars().count() > 2000)
    {
        return Err(ApiError::bad_request(
            "description must not exceed 2000 characters",
        ));
    }
    let date = date
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if let Some(value) = &date {
        NaiveDate::parse_from_str(value, "%Y-%m-%d")
            .map_err(|_| ApiError::bad_request("date must use YYYY-MM-DD"))?;
    }
    Ok((title, description, date, interval_s.clamp(1, 60)))
}

fn validate_order(existing: impl Iterator<Item = String>, ids: &[String]) -> Result<(), ApiError> {
    let existing: HashSet<_> = existing.collect();
    let supplied: HashSet<_> = ids.iter().cloned().collect();
    if supplied.len() != ids.len() || supplied != existing {
        return Err(ApiError::bad_request(
            "order must contain every id exactly once",
        ));
    }
    Ok(())
}

pub fn router(store: AlbumStore) -> Router {
    Router::new()
        .route("/api/albums", get(list_albums).post(create_album))
        .route("/api/albums/order", put(order_albums))
        .route(
            "/api/albums/{album_id}",
            patch(update_album).delete(delete_album),
        )
        .route(
            "/api/albums/{album_id}/images",
            post(upload_images).layer(DefaultBodyLimit::max(
                MAX_IMAGE_BYTES * MAX_BATCH_IMAGES + 1024 * 1024,
            )),
        )
        .route(
            "/api/albums/{album_id}/images/from-path",
            post(import_from_path),
        )
        .route("/api/albums/{album_id}/images/order", put(order_images))
        .route(
            "/api/albums/{album_id}/images/{image_id}",
            delete(delete_image),
        )
        .route(
            "/api/albums/{album_id}/images/{image_id}/content",
            get(image_content),
        )
        .with_state(store)
}

async fn list_albums(State(store): State<AlbumStore>) -> Json<Vec<Album>> {
    Json(store.albums.read().iter().map(Album::from).collect())
}

async fn create_album(
    State(store): State<AlbumStore>,
    Json(input): Json<CreateAlbum>,
) -> Result<(StatusCode, Json<Album>), ApiError> {
    let (title, description, date, interval_s) =
        validate_fields(input.title, input.description, input.date, input.interval_s)?;
    let album = StoredAlbum {
        id: Uuid::new_v4().to_string(),
        title,
        description,
        date,
        show_on_home: input.show_on_home,
        shuffle: input.shuffle,
        interval_s,
        source_dir: None,
        images: Vec::new(),
    };
    let response = Album::from(&album);
    let mut albums = store.albums.write();
    albums.push(album);
    if let Err(error) = store.save_locked(&albums) {
        albums.pop();
        return Err(error);
    }
    Ok((StatusCode::CREATED, Json(response)))
}

async fn update_album(
    State(store): State<AlbumStore>,
    Path(album_id): Path<String>,
    Json(input): Json<UpdateAlbum>,
) -> Result<Json<Album>, ApiError> {
    let (title, description, date, interval_s) =
        validate_fields(input.title, input.description, input.date, input.interval_s)?;
    let mut albums = store.albums.write();
    let index = albums
        .iter()
        .position(|album| album.id == album_id)
        .ok_or_else(|| ApiError::not_found("album not found"))?;
    let previous = albums[index].clone();
    albums[index].title = title;
    albums[index].description = description;
    albums[index].date = date;
    albums[index].show_on_home = input.show_on_home;
    albums[index].shuffle = input.shuffle;
    albums[index].interval_s = interval_s;
    if let Err(error) = store.save_locked(&albums) {
        albums[index] = previous;
        return Err(error);
    }
    Ok(Json(Album::from(&albums[index])))
}

async fn delete_album(
    State(store): State<AlbumStore>,
    Path(album_id): Path<String>,
) -> Result<Json<Album>, ApiError> {
    let _storage_guard = store.storage.operation_lock();
    let mut albums = store.albums.write();
    let index = albums
        .iter()
        .position(|album| album.id == album_id)
        .ok_or_else(|| ApiError::not_found("album not found"))?;
    let album = albums.remove(index);
    if let Err(error) = store.save_locked(&albums) {
        albums.insert(index, album);
        return Err(error);
    }
    let dir = store.album_dir(&album.id);
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(ApiError::internal)?;
    }
    Ok(Json(Album::from(&album)))
}

async fn order_albums(
    State(store): State<AlbumStore>,
    Json(input): Json<OrderedIds>,
) -> Result<Json<Vec<Album>>, ApiError> {
    let mut albums = store.albums.write();
    validate_order(albums.iter().map(|album| album.id.clone()), &input.ids)?;
    let previous = albums.clone();
    albums.sort_by_key(|album| input.ids.iter().position(|id| id == &album.id).unwrap());
    if let Err(error) = store.save_locked(&albums) {
        *albums = previous;
        return Err(error);
    }
    Ok(Json(albums.iter().map(Album::from).collect()))
}

async fn upload_images(
    State(store): State<AlbumStore>,
    Path(album_id): Path<String>,
    mut multipart: Multipart,
) -> Result<Json<Album>, ApiError> {
    let mut pending = Vec::new();
    while let Some(field) = multipart.next_field().await.map_err(ApiError::internal)? {
        if field.name() != Some("images") {
            continue;
        }
        if pending.len() >= MAX_BATCH_IMAGES {
            return Err(ApiError::bad_request(
                "a batch may contain at most 50 images",
            ));
        }
        let original_name = field.file_name().unwrap_or("image").replace('\0', "");
        let original_name: String = original_name.chars().take(255).collect();
        let bytes = field.bytes().await.map_err(ApiError::internal)?;
        if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
            return Err(ApiError::bad_request(
                "each image must contain 1 byte to 25 MB",
            ));
        }
        let (mime_type, extension) = image_kind(&bytes).ok_or_else(|| {
            ApiError::bad_request("supported formats are JPEG, PNG, WebP, GIF and AVIF")
        })?;
        pending.push((original_name, bytes, mime_type.to_string(), extension));
    }
    if pending.is_empty() {
        return Err(ApiError::bad_request("no images were provided"));
    }

    let _storage_guard = store.storage.operation_lock();
    let mut albums = store.albums.write();
    let index = albums
        .iter()
        .position(|album| album.id == album_id)
        .ok_or_else(|| ApiError::not_found("album not found"))?;
    let album_dir = store.album_dir(&album_id);
    fs::create_dir_all(&album_dir).map_err(ApiError::internal)?;
    let mut created_paths = Vec::new();
    let previous = albums[index].clone();
    for (original_name, bytes, mime_type, extension) in pending {
        let id = Uuid::new_v4().to_string();
        let file_name = format!("{id}.{extension}");
        let path = album_dir.join(&file_name);
        if let Err(error) = fs::write(&path, &bytes) {
            for created in created_paths {
                let _ = fs::remove_file(created);
            }
            return Err(ApiError::internal(error));
        }
        created_paths.push(path);
        albums[index].images.push(StoredImage {
            id,
            file_name,
            original_name,
            mime_type,
            size_bytes: bytes.len() as u64,
            source_path: None,
        });
    }
    if let Err(error) = store.save_locked(&albums) {
        albums[index] = previous;
        for created in created_paths {
            let _ = fs::remove_file(created);
        }
        return Err(error);
    }
    Ok(Json(Album::from(&albums[index])))
}

async fn import_from_path(
    State(store): State<AlbumStore>,
    Path(album_id): Path<String>,
    Json(input): Json<ImportPath>,
) -> Result<Json<Album>, ApiError> {
    store
        .import_from_directory(&album_id, &input.path)
        .map(Json)
}

async fn order_images(
    State(store): State<AlbumStore>,
    Path(album_id): Path<String>,
    Json(input): Json<OrderedIds>,
) -> Result<Json<Album>, ApiError> {
    let mut albums = store.albums.write();
    let index = albums
        .iter()
        .position(|album| album.id == album_id)
        .ok_or_else(|| ApiError::not_found("album not found"))?;
    validate_order(
        albums[index].images.iter().map(|image| image.id.clone()),
        &input.ids,
    )?;
    let previous = albums[index].images.clone();
    albums[index]
        .images
        .sort_by_key(|image| input.ids.iter().position(|id| id == &image.id).unwrap());
    if let Err(error) = store.save_locked(&albums) {
        albums[index].images = previous;
        return Err(error);
    }
    Ok(Json(Album::from(&albums[index])))
}

async fn delete_image(
    State(store): State<AlbumStore>,
    Path((album_id, image_id)): Path<(String, String)>,
) -> Result<Json<Album>, ApiError> {
    let _storage_guard = store.storage.operation_lock();
    let mut albums = store.albums.write();
    let album_index = albums
        .iter()
        .position(|album| album.id == album_id)
        .ok_or_else(|| ApiError::not_found("album not found"))?;
    let image_index = albums[album_index]
        .images
        .iter()
        .position(|image| image.id == image_id)
        .ok_or_else(|| ApiError::not_found("image not found"))?;
    let image = albums[album_index].images.remove(image_index);
    if let Err(error) = store.save_locked(&albums) {
        albums[album_index].images.insert(image_index, image);
        return Err(error);
    }
    if image.source_path.is_none() {
        let path = store.album_dir(&album_id).join(&image.file_name);
        if path.exists() {
            fs::remove_file(path).map_err(ApiError::internal)?;
        }
    }
    Ok(Json(Album::from(&albums[album_index])))
}

async fn image_content(
    State(store): State<AlbumStore>,
    Path((album_id, image_id)): Path<(String, String)>,
) -> Result<Response, ApiError> {
    let (path, mime_type) = {
        let _storage_guard = store.storage.operation_lock();
        let albums = store.albums.read();
        let album = albums
            .iter()
            .find(|album| album.id == album_id)
            .ok_or_else(|| ApiError::not_found("album not found"))?;
        let image = album
            .images
            .iter()
            .find(|image| image.id == image_id)
            .ok_or_else(|| ApiError::not_found("image not found"))?;
        (
            store.image_file_path(&album_id, image),
            image.mime_type.clone(),
        )
    };
    let bytes = tokio::fs::read(path).await.map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            ApiError::not_found("image file not found")
        } else {
            ApiError::internal(error)
        }
    })?;
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&mime_type).map_err(ApiError::internal)?,
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
    fn validates_complete_order() {
        let existing = vec!["a".to_string(), "b".to_string()];
        assert!(validate_order(existing.clone().into_iter(), &["b".into(), "a".into()]).is_ok());
        assert!(validate_order(existing.clone().into_iter(), &["a".into()]).is_err());
        assert!(validate_order(existing.into_iter(), &["a".into(), "a".into()]).is_err());
    }

    #[test]
    fn validates_and_normalizes_fields() {
        let (title, description, date, interval) = validate_fields(
            "  Summer  ".into(),
            Some("  Trip ".into()),
            Some("2026-08-24".into()),
            100,
        )
        .unwrap();
        assert_eq!(title, "Summer");
        assert_eq!(description.as_deref(), Some("Trip"));
        assert_eq!(date.as_deref(), Some("2026-08-24"));
        assert_eq!(interval, 60);
        assert!(validate_fields("".into(), None, None, 5).is_err());
        assert!(validate_fields("Title".into(), None, Some("24/08/2026".into()), 5).is_err());
    }

    #[test]
    fn recognizes_supported_image_signatures() {
        assert_eq!(
            image_kind(&[0xff, 0xd8, 0xff, 0]),
            Some(("image/jpeg", "jpg"))
        );
        assert_eq!(image_kind(b"GIF89a..."), Some(("image/gif", "gif")));
        assert_eq!(image_kind(b"not-an-image"), None);
    }

    #[test]
    fn album_store_persists_metadata() {
        let root = std::env::temp_dir().join(format!("vivoflow-album-test-{}", Uuid::new_v4()));
        let metadata = root.join("albums.json");
        let media = root.join("albums");
        let store = AlbumStore::load_from(metadata.clone(), media.clone()).unwrap();
        let album = StoredAlbum {
            id: Uuid::new_v4().to_string(),
            title: "Persisted".into(),
            description: None,
            date: Some("2026-08-24".into()),
            show_on_home: true,
            shuffle: false,
            interval_s: 5,
            source_dir: None,
            images: Vec::new(),
        };
        {
            let mut albums = store.albums.write();
            albums.push(album.clone());
            store.save_locked(&albums).unwrap();
        }
        let loaded = AlbumStore::load_from(metadata, media).unwrap();
        assert_eq!(loaded.albums.read()[0].title, album.title);
        assert!(loaded.albums.read()[0].show_on_home);
        let _ = fs::remove_dir_all(root);
    }

    fn sample_png() -> Vec<u8> {
        let mut bytes = vec![0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
        bytes.extend_from_slice(&[0; 8]);
        bytes
    }

    fn temp_store(label: &str) -> (AlbumStore, PathBuf) {
        let root = std::env::temp_dir().join(format!("vivoflow-album-{label}-{}", Uuid::new_v4()));
        let store = AlbumStore::load_from(root.join("albums.json"), root.join("albums")).unwrap();
        (store, root)
    }

    fn push_album(store: &AlbumStore, title: &str) -> String {
        let album = StoredAlbum {
            id: Uuid::new_v4().to_string(),
            title: title.into(),
            description: None,
            date: None,
            show_on_home: false,
            shuffle: false,
            interval_s: 5,
            source_dir: None,
            images: Vec::new(),
        };
        let id = album.id.clone();
        let mut albums = store.albums.write();
        albums.push(album);
        store.save_locked(&albums).unwrap();
        id
    }

    #[test]
    fn imports_images_from_a_local_directory_without_copying() {
        let (store, root) = temp_store("import");
        let album_id = push_album(&store, "Local");
        let photos = root.join("photos");
        fs::create_dir_all(&photos).unwrap();
        let png = photos.join("cover.png");
        fs::write(&png, sample_png()).unwrap();
        fs::write(photos.join("notes.txt"), b"ignore me").unwrap();

        let album = store
            .import_from_directory(&album_id, photos.to_str().unwrap())
            .unwrap();
        assert_eq!(album.images.len(), 1);
        assert_eq!(album.images[0].original_name, "cover.png");
        assert_eq!(album.source_dir.as_deref(), photos.to_str());
        assert!(png.exists());
        assert!(!store
            .album_dir(&album_id)
            .join(&format!("{}.png", album.images[0].id))
            .exists());

        let again = store
            .import_from_directory(&album_id, photos.to_str().unwrap())
            .unwrap();
        assert_eq!(again.images.len(), 1);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_missing_or_non_directory_paths() {
        let (store, root) = temp_store("bad-path");
        let album_id = push_album(&store, "Local");
        let missing = root.join("missing");
        assert!(store
            .import_from_directory(&album_id, missing.to_str().unwrap())
            .is_err());
        let file = root.join("file.png");
        fs::write(&file, sample_png()).unwrap();
        assert!(store
            .import_from_directory(&album_id, file.to_str().unwrap())
            .is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn deleting_local_image_keeps_the_original_file() {
        let (store, root) = temp_store("keep-original");
        let album_id = push_album(&store, "Local");
        let photos = root.join("photos");
        fs::create_dir_all(&photos).unwrap();
        let png = photos.join("keep.png");
        fs::write(&png, sample_png()).unwrap();
        let album = store
            .import_from_directory(&album_id, photos.to_str().unwrap())
            .unwrap();
        let image_id = album.images[0].id.clone();

        let mut albums = store.albums.write();
        let album_index = 0;
        let image = albums[album_index].images.remove(0);
        assert_eq!(image.id, image_id);
        store.save_locked(&albums).unwrap();
        drop(albums);
        assert!(image.source_path.is_some());
        assert!(png.exists());

        let _ = fs::remove_dir_all(root);
    }
}
