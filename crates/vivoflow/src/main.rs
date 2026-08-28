mod album;
mod audio;
mod collectors;
mod config;
mod hub;
mod illustration;
mod ipc;
mod models;
mod music;
mod server;
mod storage;

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use tracing_subscriber::EnvFilter;

use crate::config::load_config;
use crate::hub::MetricsHub;
use crate::server::serve;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let addr: SocketAddr = std::env::var("VIVOFLOW_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8787".into())
        .parse()
        .context("invalid VIVOFLOW_ADDR")?;

    let config = Arc::new(parking_lot::RwLock::new(load_config()));
    tracing::info!(
        "config path: {}",
        crate::config::config_file_path().display()
    );
    let hub = MetricsHub::new(config);
    hub.clone().spawn_collector();
    let audio = crate::audio::AudioHub::new(hub.config.clone());
    audio.clone().spawn();
    let storage = crate::storage::StorageManager::load()?;
    let albums = crate::album::AlbumStore::load(storage.clone())?;
    let music = crate::music::MusicStore::load(hub.config.clone(), storage.clone())?;
    let illustrations = crate::illustration::IllustrationStore::load(storage.clone())?;

    tracing::info!("VivoFlow listening on http://{addr}");
    tracing::info!("WebSocket JSON IPC at ws://{addr}/ws");
    serve(addr, hub, albums, music, illustrations, audio, storage).await
}
