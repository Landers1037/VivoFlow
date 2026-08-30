use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::storage::StorageManager;
use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Multipart, Path as AxumPath, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post, put};
use axum::{Json, Router};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

const MAX_COVER_BYTES: usize = 25 * 1024 * 1024;
const MAX_AUDIO_BYTES: usize = 250 * 1024 * 1024;
const MAX_TRACKS: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicTrack {
    pub id: String,
    pub title: String,
    pub file_name: String,
    pub original_name: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub lyrics: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicAlbum {
    pub id: String,
    pub title: String,
    pub cover_file: Option<String>,
    pub cover_mime: Option<String>,
    #[serde(default)]
    pub loop_playback: bool,
    #[serde(default)]
    pub default_muted: bool,
    pub tracks: Vec<MusicTrack>,
}

#[derive(Clone)]
pub struct MusicStore {
    albums: Arc<RwLock<Vec<MusicAlbum>>>,
    metadata: Arc<PathBuf>,
    storage: StorageManager,
    config: Arc<RwLock<crate::config::AppConfig>>,
}

#[derive(Debug)]
struct MusicError(StatusCode, String);
impl MusicError {
    fn bad(s: impl Into<String>) -> Self {
        Self(StatusCode::BAD_REQUEST, s.into())
    }
    fn not_found(s: impl Into<String>) -> Self {
        Self(StatusCode::NOT_FOUND, s.into())
    }
    fn internal(e: impl std::fmt::Display) -> Self {
        tracing::error!("music operation failed: {e}");
        Self(
            StatusCode::INTERNAL_SERVER_ERROR,
            "music storage operation failed".into(),
        )
    }
}
impl IntoResponse for MusicError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"error": self.1}))).into_response()
    }
}

impl MusicStore {
    pub fn load(
        config: Arc<RwLock<crate::config::AppConfig>>,
        storage: StorageManager,
    ) -> anyhow::Result<Self> {
        let base = crate::config::config_file_path()
            .parent()
            .unwrap_or(Path::new("."))
            .to_path_buf();
        let metadata = base.join("music_albums.json");
        fs::create_dir_all(storage.category_dir("music_albums"))?;
        let albums = match fs::read_to_string(&metadata) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Vec::new(),
            Err(e) => return Err(e.into()),
        };
        Ok(Self {
            albums: Arc::new(RwLock::new(albums)),
            metadata: Arc::new(metadata),
            storage,
            config,
        })
    }
    fn save(&self, albums: &[MusicAlbum]) -> Result<(), MusicError> {
        let bytes = serde_json::to_vec_pretty(albums).map_err(MusicError::internal)?;
        let tmp = self.metadata.with_extension("json.tmp");
        fs::write(&tmp, bytes).map_err(MusicError::internal)?;
        if self.metadata.exists() {
            fs::remove_file(self.metadata.as_ref()).map_err(MusicError::internal)?;
        }
        fs::rename(tmp, self.metadata.as_ref()).map_err(MusicError::internal)
    }
    fn dir(&self, id: &str) -> PathBuf {
        self.storage.category_dir("music_albums").join(id)
    }
}

#[derive(Deserialize)]
struct AlbumInput {
    title: String,
    #[serde(default)]
    loop_playback: Option<bool>,
    #[serde(default)]
    default_muted: Option<bool>,
}
#[derive(Deserialize)]
struct TrackInput {
    title: String,
    lyrics: String,
}
#[derive(Deserialize)]
struct OrderInput {
    ids: Vec<String>,
}

pub fn router(store: MusicStore) -> Router {
    Router::new()
        .route("/api/music-albums", get(list).post(create))
        .route("/api/music-albums/order", put(order))
        .route("/api/music-albums/{id}", patch(update).delete(remove))
        .route("/api/music-albums/{id}/enable", post(enable))
        .route(
            "/api/music-albums/{id}/cover",
            post(upload_cover).layer(DefaultBodyLimit::max(MAX_COVER_BYTES + 1024 * 1024)),
        )
        .route(
            "/api/music-albums/{id}/tracks",
            post(upload_tracks).layer(DefaultBodyLimit::max(MAX_AUDIO_BYTES * 10 + 1024 * 1024)),
        )
        .route("/api/music-albums/{id}/tracks/order", put(track_order))
        .route(
            "/api/music-albums/{id}/tracks/{track_id}",
            patch(update_track).delete(remove_track),
        )
        .route("/api/music-albums/{id}/cover/content", get(cover_content))
        .route(
            "/api/music-albums/{id}/tracks/{track_id}/content",
            get(track_content),
        )
        .with_state(store)
}

async fn list(State(s): State<MusicStore>) -> Json<Vec<MusicAlbum>> {
    Json(s.albums.read().clone())
}
async fn create(
    State(s): State<MusicStore>,
    Json(i): Json<AlbumInput>,
) -> Result<(StatusCode, Json<MusicAlbum>), MusicError> {
    let title = i.title.trim();
    if title.is_empty() || title.chars().count() > 120 {
        return Err(MusicError::bad("title must contain 1 to 120 characters"));
    }
    let a = MusicAlbum {
        id: Uuid::new_v4().to_string(),
        title: title.into(),
        cover_file: None,
        cover_mime: None,
        loop_playback: i.loop_playback.unwrap_or(false),
        default_muted: i.default_muted.unwrap_or(false),
        tracks: vec![],
    };
    let mut xs = s.albums.write();
    xs.push(a.clone());
    s.save(&xs)?;
    Ok((StatusCode::CREATED, Json(a)))
}
async fn update(
    State(s): State<MusicStore>,
    AxumPath(id): AxumPath<String>,
    Json(i): Json<AlbumInput>,
) -> Result<Json<MusicAlbum>, MusicError> {
    let title = i.title.trim();
    if title.is_empty() || title.chars().count() > 120 {
        return Err(MusicError::bad("title must contain 1 to 120 characters"));
    }
    let mut xs = s.albums.write();
    let n = xs
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| MusicError::not_found("album not found"))?;
    xs[n].title = title.into();
    if let Some(loop_playback) = i.loop_playback {
        xs[n].loop_playback = loop_playback;
    }
    if let Some(default_muted) = i.default_muted {
        xs[n].default_muted = default_muted;
    }
    let a = xs[n].clone();
    s.save(&xs)?;
    Ok(Json(a))
}
async fn remove(
    State(s): State<MusicStore>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<MusicAlbum>, MusicError> {
    let _storage_guard = s.storage.operation_lock();
    let mut xs = s.albums.write();
    let n = xs
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| MusicError::not_found("album not found"))?;
    let a = xs.remove(n);
    s.save(&xs)?;
    let _ = fs::remove_dir_all(s.dir(&id));
    if s.config.read().active_music_album_id.as_deref() == Some(&id) {
        let mut c = s.config.write();
        c.active_music_album_id = None;
        c.music_album_enabled = false;
        crate::config::save_config(&c).map_err(MusicError::internal)?;
    }
    Ok(Json(a))
}
async fn enable(
    State(s): State<MusicStore>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<MusicAlbum>, MusicError> {
    let a = {
        let xs = s.albums.read();
        xs.iter()
            .find(|a| a.id == id)
            .cloned()
            .ok_or_else(|| MusicError::not_found("album not found"))?
    };
    let mut c = s.config.write();
    c.music_album_enabled = true;
    c.photo_album_enabled = false;
    c.illustration_enabled = false;
    c.audio_visualizer_enabled = false;
    c.clock_enabled = false;
    c.blackhole_enabled = false;
    c.model2d_enabled = false;
    c.model3d_enabled = false;
    c.active_music_album_id = Some(id);
    crate::config::save_config(&c).map_err(MusicError::internal)?;
    Ok(Json(a))
}
async fn order(
    State(s): State<MusicStore>,
    Json(i): Json<OrderInput>,
) -> Result<Json<Vec<MusicAlbum>>, MusicError> {
    let mut xs = s.albums.write();
    if i.ids.len() != xs.len()
        || i.ids.iter().collect::<std::collections::HashSet<_>>().len() != xs.len()
    {
        return Err(MusicError::bad(
            "order must contain every album exactly once",
        ));
    }
    xs.sort_by_key(|a| i.ids.iter().position(|x| x == &a.id).unwrap());
    s.save(&xs)?;
    Ok(Json(xs.clone()))
}

fn image_kind(b: &[u8]) -> Option<(&'static str, &'static str)> {
    if b.starts_with(&[0xff, 0xd8, 0xff]) {
        Some(("image/jpeg", "jpg"))
    } else if b.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some(("image/png", "png"))
    } else if b.starts_with(b"GIF8") {
        Some(("image/gif", "gif"))
    } else if b.len() > 12 && &b[..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some(("image/webp", "webp"))
    } else {
        None
    }
}
fn audio_kind(name: &str, b: &[u8]) -> Option<(&'static str, &'static str)> {
    let ext = Path::new(name).extension()?.to_str()?.to_ascii_lowercase();
    match ext.as_str() {
        "mp3" if b.starts_with(b"ID3") || b.starts_with(&[0xff, 0xfb]) => {
            Some(("audio/mpeg", "mp3"))
        }
        "wav" if b.starts_with(b"RIFF") => Some(("audio/wav", "wav")),
        "ogg" if b.starts_with(b"OggS") => Some(("audio/ogg", "ogg")),
        "m4a" if b.len() > 8 && &b[4..8] == b"ftyp" => Some(("audio/mp4", "m4a")),
        _ => None,
    }
}
async fn upload_cover(
    State(s): State<MusicStore>,
    AxumPath(id): AxumPath<String>,
    mut mp: Multipart,
) -> Result<Json<MusicAlbum>, MusicError> {
    let f = mp
        .next_field()
        .await
        .map_err(|e| MusicError::bad(format!("invalid multipart upload: {e}")))?
        .ok_or_else(|| MusicError::bad("cover is required"))?;
    let b = f
        .bytes()
        .await
        .map_err(|e| MusicError::bad(format!("invalid cover upload: {e}")))?;
    if b.len() > MAX_COVER_BYTES {
        return Err(MusicError::bad("cover exceeds 25 MB"));
    }
    let (mime, ext) = image_kind(&b).ok_or_else(|| MusicError::bad("unsupported cover format"))?;
    let _storage_guard = s.storage.operation_lock();
    let mut xs = s.albums.write();
    let n = xs
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| MusicError::not_found("album not found"))?;
    fs::create_dir_all(s.dir(&id)).map_err(MusicError::internal)?;
    let old = xs[n].cover_file.clone();
    let file = format!("cover-{}.{}", Uuid::new_v4(), ext);
    fs::write(s.dir(&id).join(&file), &b).map_err(MusicError::internal)?;
    xs[n].cover_file = Some(file);
    xs[n].cover_mime = Some(mime.into());
    let a = xs[n].clone();
    s.save(&xs)?;
    if let Some(old) = old {
        let _ = fs::remove_file(s.dir(&id).join(old));
    }
    Ok(Json(a))
}
async fn upload_tracks(
    State(s): State<MusicStore>,
    AxumPath(id): AxumPath<String>,
    mut mp: Multipart,
) -> Result<Json<MusicAlbum>, MusicError> {
    let mut pending = Vec::new();
    while let Some(f) = mp
        .next_field()
        .await
        .map_err(|e| MusicError::bad(format!("invalid multipart upload: {e}")))?
    {
        if f.name() != Some("tracks") {
            continue;
        }
        let name = f.file_name().unwrap_or("track").to_string();
        let b = f
            .bytes()
            .await
            .map_err(|e| MusicError::bad(format!("invalid audio upload: {e}")))?;
        if b.len() > MAX_AUDIO_BYTES {
            return Err(MusicError::bad("audio exceeds 250 MB"));
        }
        let (mime, ext) = audio_kind(&name, &b)
            .ok_or_else(|| MusicError::bad("supported audio formats are MP3, WAV, OGG and M4A"))?;
        pending.push((name, b, mime, ext));
        if pending.len() > MAX_TRACKS {
            return Err(MusicError::bad("too many tracks"));
        }
    }
    let _storage_guard = s.storage.operation_lock();
    let mut xs = s.albums.write();
    let n = xs
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| MusicError::not_found("album not found"))?;
    if xs[n].tracks.len() + pending.len() > MAX_TRACKS {
        return Err(MusicError::bad("album supports at most 100 tracks"));
    }
    fs::create_dir_all(s.dir(&id)).map_err(MusicError::internal)?;
    for (name, b, mime, ext) in pending {
        let tid = Uuid::new_v4().to_string();
        let file = format!("{}.{}", tid, ext);
        fs::write(s.dir(&id).join(&file), &b).map_err(MusicError::internal)?;
        xs[n].tracks.push(MusicTrack {
            id: tid,
            title: Path::new(&name)
                .file_stem()
                .and_then(|x| x.to_str())
                .unwrap_or("Untitled")
                .into(),
            file_name: file,
            original_name: name,
            mime_type: mime.into(),
            size_bytes: b.len() as u64,
            lyrics: String::new(),
        });
    }
    let a = xs[n].clone();
    s.save(&xs)?;
    Ok(Json(a))
}
async fn update_track(
    State(s): State<MusicStore>,
    AxumPath((id, tid)): AxumPath<(String, String)>,
    Json(i): Json<TrackInput>,
) -> Result<Json<MusicAlbum>, MusicError> {
    if i.title.trim().is_empty()
        || i.title.chars().count() > 200
        || i.lyrics.chars().count() > 100000
    {
        return Err(MusicError::bad("invalid track fields"));
    }
    let mut xs = s.albums.write();
    let n = xs
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| MusicError::not_found("album not found"))?;
    let t = xs[n]
        .tracks
        .iter_mut()
        .find(|t| t.id == tid)
        .ok_or_else(|| MusicError::not_found("track not found"))?;
    t.title = i.title.trim().into();
    t.lyrics = i.lyrics;
    s.save(&xs)?;
    Ok(Json(xs[n].clone()))
}
async fn remove_track(
    State(s): State<MusicStore>,
    AxumPath((id, tid)): AxumPath<(String, String)>,
) -> Result<Json<MusicAlbum>, MusicError> {
    let _storage_guard = s.storage.operation_lock();
    let mut xs = s.albums.write();
    let n = xs
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| MusicError::not_found("album not found"))?;
    let p = xs[n]
        .tracks
        .iter()
        .position(|t| t.id == tid)
        .ok_or_else(|| MusicError::not_found("track not found"))?;
    let t = xs[n].tracks.remove(p);
    let result = xs[n].clone();
    s.save(&xs)?;
    let _ = fs::remove_file(s.dir(&id).join(t.file_name));
    Ok(Json(result))
}
async fn track_order(
    State(s): State<MusicStore>,
    AxumPath(id): AxumPath<String>,
    Json(i): Json<OrderInput>,
) -> Result<Json<MusicAlbum>, MusicError> {
    let mut xs = s.albums.write();
    let n = xs
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| MusicError::not_found("album not found"))?;
    if i.ids.len() != xs[n].tracks.len()
        || i.ids.iter().collect::<std::collections::HashSet<_>>().len() != xs[n].tracks.len()
        || i.ids
            .iter()
            .any(|id| !xs[n].tracks.iter().any(|t| &t.id == id))
    {
        return Err(MusicError::bad(
            "order must contain every track exactly once",
        ));
    }
    xs[n]
        .tracks
        .sort_by_key(|t| i.ids.iter().position(|x| x == &t.id).unwrap());
    let result = xs[n].clone();
    s.save(&xs)?;
    Ok(Json(result))
}
async fn file_response(path: PathBuf, mime: String) -> Result<Response, MusicError> {
    let b = tokio::fs::read(path).await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            MusicError::not_found("media not found")
        } else {
            MusicError::internal(e)
        }
    })?;
    let mut r = Response::new(Body::from(b));
    r.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&mime).map_err(MusicError::internal)?,
    );
    r.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=3600"),
    );
    Ok(r)
}
async fn cover_content(
    State(s): State<MusicStore>,
    AxumPath(id): AxumPath<String>,
) -> Result<Response, MusicError> {
    let (path, mime) = {
        let _storage_guard = s.storage.operation_lock();
        let a = s
            .albums
            .read()
            .iter()
            .find(|a| a.id == id)
            .cloned()
            .ok_or_else(|| MusicError::not_found("album not found"))?;
        let f = a
            .cover_file
            .ok_or_else(|| MusicError::not_found("cover not found"))?;
        (
            s.dir(&id).join(f),
            a.cover_mime.unwrap_or_else(|| "image/jpeg".into()),
        )
    };
    file_response(path, mime).await
}
async fn track_content(
    State(s): State<MusicStore>,
    AxumPath((id, tid)): AxumPath<(String, String)>,
) -> Result<Response, MusicError> {
    let (path, mime) = {
        let _storage_guard = s.storage.operation_lock();
        let a = s
            .albums
            .read()
            .iter()
            .find(|a| a.id == id)
            .cloned()
            .ok_or_else(|| MusicError::not_found("album not found"))?;
        let t = a
            .tracks
            .into_iter()
            .find(|t| t.id == tid)
            .ok_or_else(|| MusicError::not_found("track not found"))?;
        (s.dir(&id).join(t.file_name), t.mime_type)
    };
    file_response(path, mime).await
}
