mod agent_runtime;
mod agent_voice;
mod album;
mod audio;
mod collectors;
mod config;
mod hub;
mod illustration;
mod ipc;
mod models;
mod music;
mod particle;
mod server;
mod storage;
mod tls;

use std::net::SocketAddr;
use std::sync::Arc;

use tracing_subscriber::EnvFilter;

struct Runtime {
    hub: hub::MetricsHub,
    albums: album::AlbumStore,
    music: music::MusicStore,
    illustrations: illustration::IllustrationStore,
    particles: particle::ParticleStore,
    audio: audio::AudioHub,
    storage: storage::StorageManager,
    agent: agent_runtime::AgentRuntime,
}

fn prepare() {
    // axum-server and reqwest intentionally use rustls without selecting a
    // provider at compile time. Install the single provider used by both
    // clients before any HTTPS server or HTTP client is constructed.
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .try_init();
}

fn load_runtime() -> anyhow::Result<Runtime> {
    let config = Arc::new(parking_lot::RwLock::new(config::load_config()));
    tracing::info!("config path: {}", config::config_file_path().display());
    let hub = hub::MetricsHub::new(config);
    hub.clone().spawn_collector();
    let audio = audio::AudioHub::new(hub.config.clone());
    audio.clone().spawn();
    let storage = storage::StorageManager::load()?;
    let albums = album::AlbumStore::load(storage.clone())?;
    let music = music::MusicStore::load(hub.config.clone(), storage.clone())?;
    let illustrations = illustration::IllustrationStore::load(storage.clone())?;
    let particles = particle::ParticleStore::load(storage.clone())?;
    let agent = agent_runtime::AgentRuntime::start();
    Ok(Runtime {
        hub,
        albums,
        music,
        illustrations,
        particles,
        audio,
        storage,
        agent,
    })
}

/// HTTPS listener used by the LAN binary. Generates or reuses the local CA.
pub async fn run_https(addr: SocketAddr) -> anyhow::Result<()> {
    prepare();
    let runtime = load_runtime()?;
    let tls = tls::ensure_tls_assets()?;
    tracing::info!("VivoFlow listening on https://{addr}");
    tracing::info!("WebSocket JSON IPC at wss://{addr}/ws");
    tracing::info!("root CA certificate: {}", tls.root_ca_cert_path.display());
    tracing::info!("certificate names: {}", tls.subject_alt_names.join(", "));
    server::serve(
        addr,
        runtime.hub,
        runtime.albums,
        runtime.music,
        runtime.illustrations,
        runtime.particles,
        runtime.audio,
        runtime.storage,
        tls,
        runtime.agent,
    )
    .await
}

/// Loopback HTTP listener for the desktop webview.
/// `http://127.0.0.1` is a secure context, so microphone and worklet APIs work
/// without trusting the self-signed LAN certificate.
pub async fn run_http(addr: SocketAddr) -> anyhow::Result<()> {
    prepare();
    let runtime = load_runtime()?;
    tracing::info!("VivoFlow listening on http://{addr}");
    tracing::info!("WebSocket JSON IPC at ws://{addr}/ws");
    server::serve_http(
        addr,
        runtime.hub,
        runtime.albums,
        runtime.music,
        runtime.illustrations,
        runtime.particles,
        runtime.audio,
        runtime.storage,
        runtime.agent,
    )
    .await
}
