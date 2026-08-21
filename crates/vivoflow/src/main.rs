mod collectors;
mod config;
mod hub;
mod ipc;
mod models;
mod server;

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;
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

    let config = Arc::new(parking_lot::RwLock::new(AppConfig::default()));
    let hub = MetricsHub::new(config.clone());
    hub.clone().spawn_collector();

    tracing::info!("VivoFlow listening on http://{addr}");
    tracing::info!("WebSocket JSON IPC at ws://{addr}/ws");
    serve(addr, hub).await
}
