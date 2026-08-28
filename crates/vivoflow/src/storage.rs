use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use parking_lot::{Mutex, MutexGuard, RwLock};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const STORAGE_CONFIG_FILE: &str = "storage.json";
pub const STORAGE_CATEGORIES: [&str; 3] = ["albums", "music_albums", "illustrations"];

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredStorageConfig {
    root_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorageCategoryUsage {
    pub bytes: u64,
    pub files: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorageStatus {
    pub root_path: String,
    pub total_bytes: u64,
    pub total_files: u64,
    pub categories: BTreeMap<String, StorageCategoryUsage>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
}

#[derive(Clone)]
pub struct StorageManager {
    root: Arc<RwLock<PathBuf>>,
    config_path: Arc<PathBuf>,
    operation_lock: Arc<Mutex<()>>,
}

impl StorageManager {
    pub fn load() -> anyhow::Result<Self> {
        let config_file = crate::config::config_file_path();
        let base = config_file
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf();
        let config_path = base.join(STORAGE_CONFIG_FILE);
        let configured = match fs::read_to_string(&config_path) {
            Ok(raw) => serde_json::from_str::<StoredStorageConfig>(&raw)
                .ok()
                .and_then(|value| non_empty_path(&value.root_path)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => None,
            Err(error) => return Err(error.into()),
        };
        Self::from_root_with_config(configured.unwrap_or(base), config_path)
    }

    fn from_root_with_config(root: PathBuf, config_path: PathBuf) -> anyhow::Result<Self> {
        fs::create_dir_all(&root)?;
        let root = root.canonicalize().unwrap_or(root);
        let manager = Self {
            root: Arc::new(RwLock::new(root)),
            config_path: Arc::new(config_path),
            operation_lock: Arc::new(Mutex::new(())),
        };
        for category in STORAGE_CATEGORIES {
            fs::create_dir_all(manager.category_dir(category))?;
        }
        Ok(manager)
    }

    #[cfg(test)]
    pub fn from_test_root(root: PathBuf) -> anyhow::Result<Self> {
        Self::from_root_with_config(root.clone(), root.join(STORAGE_CONFIG_FILE))
    }

    pub fn root(&self) -> PathBuf {
        self.root.read().clone()
    }

    pub fn category_dir(&self, category: &str) -> PathBuf {
        self.root().join(category)
    }

    pub fn operation_lock(&self) -> MutexGuard<'_, ()> {
        self.operation_lock.lock()
    }

    pub fn status(&self) -> Result<StorageStatus, String> {
        let _guard = self.operation_lock.lock();
        self.status_unlocked()
    }

    fn status_unlocked(&self) -> Result<StorageStatus, String> {
        let mut category_map = BTreeMap::new();
        let mut total_bytes = 0u64;
        let mut total_files = 0u64;
        for category in STORAGE_CATEGORIES {
            let usage = usage_for_path(&self.category_dir(category))
                .map_err(|error| format!("cannot inspect {category}: {error}"))?;
            total_bytes = total_bytes.saturating_add(usage.bytes);
            total_files = total_files.saturating_add(usage.files);
            category_map.insert(category.to_string(), usage);
        }
        Ok(StorageStatus {
            root_path: self.root().display().to_string(),
            total_bytes,
            total_files,
            categories: category_map,
            warnings: Vec::new(),
        })
    }

    pub fn set_root(&self, raw_path: &str) -> Result<StorageStatus, String> {
        let _guard = self.operation_lock.lock();
        let trimmed = raw_path.trim();
        if trimmed.is_empty() {
            return Err("storage path must not be empty".into());
        }
        if trimmed.chars().count() > 4096 {
            return Err("storage path is too long".into());
        }
        let target_input = PathBuf::from(trimmed);
        if !target_input.is_absolute() {
            return Err("storage path must be absolute".into());
        }
        fs::create_dir_all(&target_input)
            .map_err(|error| format!("cannot create storage path: {error}"))?;
        let target = target_input
            .canonicalize()
            .map_err(|error| format!("cannot resolve storage path: {error}"))?;
        let old = self.root();
        if target == old {
            self.persist_root(&target)?;
            return self.status_unlocked();
        }
        if target.starts_with(&old) || old.starts_with(&target) {
            return Err(
                "new storage path must not contain or be contained by the current path".into(),
            );
        }
        ensure_writable(&target)?;

        for category in STORAGE_CATEGORIES {
            let destination = target.join(category);
            if destination.exists() {
                let mut entries = fs::read_dir(&destination)
                    .map_err(|error| format!("cannot inspect destination {category}: {error}"))?;
                if entries.next().is_some() {
                    return Err(format!("destination directory {category} is not empty"));
                }
            }
        }

        let staging = target.join(format!(".vivoflow-storage-staging-{}", Uuid::new_v4()));
        fs::create_dir(&staging)
            .map_err(|error| format!("cannot create migration staging area: {error}"))?;
        let mut activated: Vec<(PathBuf, bool)> = Vec::new();
        let migration = (|| -> Result<(), String> {
            for category in STORAGE_CATEGORIES {
                let source = old.join(category);
                if source.exists() {
                    let expected = usage_for_path(&source)
                        .map_err(|error| format!("cannot inspect {category}: {error}"))?;
                    let staged = staging.join(category);
                    copy_dir_recursive(&source, &staged)
                        .map_err(|error| format!("cannot copy {category}: {error}"))?;
                    let actual = usage_for_path(&staged)
                        .map_err(|error| format!("cannot verify copied {category}: {error}"))?;
                    if expected.bytes != actual.bytes || expected.files != actual.files {
                        return Err(format!(
                            "copied {category} does not match the source ({} files/{} bytes vs {} files/{} bytes)",
                            actual.files, actual.bytes, expected.files, expected.bytes
                        ));
                    }
                }
            }
            for category in STORAGE_CATEGORIES {
                let source = staging.join(category);
                if !source.exists() {
                    continue;
                }
                let destination = target.join(category);
                let had_empty_destination = destination.exists();
                if destination.exists() {
                    fs::remove_dir(&destination).map_err(|error| {
                        format!("cannot prepare destination {category}: {error}")
                    })?;
                }
                fs::rename(&source, &destination)
                    .map_err(|error| format!("cannot activate {category}: {error}"))?;
                activated.push((destination, had_empty_destination));
            }
            self.persist_root(&target)?;
            *self.root.write() = target.clone();
            Ok(())
        })();
        let _ = fs::remove_dir_all(&staging);
        if let Err(error) = migration {
            for (destination, had_empty_destination) in activated {
                let _ = fs::remove_dir_all(&destination);
                if had_empty_destination {
                    let _ = fs::create_dir_all(destination);
                }
            }
            return Err(error);
        }

        let mut warnings = Vec::new();
        for category in STORAGE_CATEGORIES {
            let source = old.join(category);
            if source.exists() {
                if let Err(error) = fs::remove_dir_all(&source) {
                    warnings.push(format!("旧目录 {} 未能清理：{error}", source.display()));
                }
            }
        }
        let mut status = self.status_unlocked()?;
        status.warnings = warnings;
        Ok(status)
    }

    fn persist_root(&self, root: &Path) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let raw = serde_json::to_vec_pretty(&StoredStorageConfig {
            root_path: root.display().to_string(),
        })
        .map_err(|error| error.to_string())?;
        let temp = self
            .config_path
            .with_extension(format!("json.tmp.{}", Uuid::new_v4()));
        fs::write(&temp, raw).map_err(|error| error.to_string())?;
        let backup = self
            .config_path
            .with_extension(format!("json.bak.{}", Uuid::new_v4()));
        if self.config_path.exists() {
            fs::rename(self.config_path.as_ref(), &backup).map_err(|error| error.to_string())?;
        }
        match fs::rename(&temp, self.config_path.as_ref()) {
            Ok(()) => {
                let _ = fs::remove_file(backup);
                Ok(())
            }
            Err(error) => {
                let _ = fs::remove_file(&temp);
                if backup.exists() {
                    let _ = fs::rename(&backup, self.config_path.as_ref());
                }
                Err(error.to_string())
            }
        }
    }

    pub fn open_root(&self) -> Result<(), String> {
        let root = self.root();
        #[cfg(windows)]
        {
            std::process::Command::new("explorer.exe")
                .arg(&root)
                .spawn()
                .map_err(|error| format!("cannot open storage path: {error}"))?;
            Ok(())
        }
        #[cfg(not(windows))]
        {
            let _ = root;
            Err("opening a host folder is only supported on Windows".into())
        }
    }
}

#[derive(Debug, Deserialize)]
struct SetStoragePath {
    root_path: String,
}

#[derive(Debug)]
struct StorageError(StatusCode, String);

impl IntoResponse for StorageError {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({ "error": self.1 }))).into_response()
    }
}

pub fn router(storage: StorageManager) -> Router {
    Router::new()
        .route("/api/storage", get(get_storage).put(set_storage))
        .route("/api/storage/open", post(open_storage))
        .with_state(storage)
}

async fn get_storage(
    State(storage): State<StorageManager>,
) -> Result<Json<StorageStatus>, StorageError> {
    storage
        .status()
        .map(Json)
        .map_err(|error| StorageError(StatusCode::INTERNAL_SERVER_ERROR, error))
}

async fn set_storage(
    State(storage): State<StorageManager>,
    Json(input): Json<SetStoragePath>,
) -> Result<Json<StorageStatus>, StorageError> {
    tokio::task::spawn_blocking(move || storage.set_root(&input.root_path))
        .await
        .map_err(|error| StorageError(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?
        .map(Json)
        .map_err(|error| StorageError(StatusCode::BAD_REQUEST, error))
}

async fn open_storage(State(storage): State<StorageManager>) -> Result<StatusCode, StorageError> {
    storage
        .open_root()
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|error| StorageError(StatusCode::NOT_IMPLEMENTED, error))
}

fn non_empty_path(raw: &str) -> Option<PathBuf> {
    let value = raw.trim();
    if value.is_empty() {
        None
    } else {
        Some(PathBuf::from(value))
    }
}

fn ensure_writable(path: &Path) -> Result<(), String> {
    let probe = path.join(format!(".vivoflow-write-test-{}", Uuid::new_v4()));
    fs::write(&probe, b"ok").map_err(|error| format!("storage path is not writable: {error}"))?;
    fs::remove_file(probe).map_err(|error| format!("cannot verify storage path: {error}"))
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> io::Result<()> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_dir_recursive(&source_path, &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(source_path, destination_path)?;
        }
    }
    Ok(())
}

fn usage_for_path(path: &Path) -> io::Result<StorageCategoryUsage> {
    if !path.exists() {
        return Ok(StorageCategoryUsage { bytes: 0, files: 0 });
    }
    let mut usage = StorageCategoryUsage { bytes: 0, files: 0 };
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            let nested = usage_for_path(&entry.path())?;
            usage.bytes = usage.bytes.saturating_add(nested.bytes);
            usage.files = usage.files.saturating_add(nested.files);
        } else if file_type.is_file() {
            usage.bytes = usage.bytes.saturating_add(entry.metadata()?.len());
            usage.files = usage.files.saturating_add(1);
        }
    }
    Ok(usage)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_category_usage() {
        let root = std::env::temp_dir().join(format!("vivoflow-storage-{}", Uuid::new_v4()));
        let manager = StorageManager::from_test_root(root.clone()).unwrap();
        fs::write(manager.category_dir("albums").join("one"), b"123").unwrap();
        let status = manager.status().unwrap();
        assert_eq!(status.total_bytes, 3);
        assert_eq!(status.total_files, 1);
        assert_eq!(status.categories["albums"].bytes, 3);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn migrates_managed_directories_and_rejects_nested_paths() {
        let root = std::env::temp_dir().join(format!("vivoflow-storage-old-{}", Uuid::new_v4()));
        let target = std::env::temp_dir().join(format!("vivoflow-storage-new-{}", Uuid::new_v4()));
        let manager = StorageManager::from_test_root(root.clone()).unwrap();
        fs::write(manager.category_dir("albums").join("one"), b"hello").unwrap();
        let status = manager.set_root(target.to_str().unwrap()).unwrap();
        assert_eq!(status.total_bytes, 5);
        assert!(target.join("albums/one").exists());
        assert!(manager
            .set_root(target.join("nested").to_str().unwrap())
            .is_err());
        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(target);
    }

    #[test]
    fn refuses_to_overwrite_non_empty_destination_categories() {
        let root = std::env::temp_dir().join(format!("vivoflow-storage-old-{}", Uuid::new_v4()));
        let target =
            std::env::temp_dir().join(format!("vivoflow-storage-conflict-{}", Uuid::new_v4()));
        let manager = StorageManager::from_test_root(root.clone()).unwrap();
        fs::write(manager.category_dir("albums").join("one"), b"hello").unwrap();
        fs::create_dir_all(target.join("albums")).unwrap();
        fs::write(target.join("albums/existing"), b"keep").unwrap();
        assert!(manager.set_root(target.to_str().unwrap()).is_err());
        assert!(root.join("albums/one").exists());
        assert!(target.join("albums/existing").exists());
        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(target);
    }
}
