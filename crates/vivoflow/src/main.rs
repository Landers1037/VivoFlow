use std::net::SocketAddr;

use anyhow::Context;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let addr: SocketAddr = std::env::var("VIVOFLOW_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8787".into())
        .parse()
        .context("invalid VIVOFLOW_ADDR")?;
    vivoflow::run_https(addr).await
}
