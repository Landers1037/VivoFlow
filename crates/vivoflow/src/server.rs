use std::net::SocketAddr;
use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::extract::ws::WebSocketUpgrade;
use axum::extract::{Path, State};
use axum::http::{header, StatusCode, Uri};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::TryStreamExt;
use rust_embed::Embed;
use tower_http::cors::{Any, CorsLayer};

use crate::agent_runtime::AgentRuntime;
use crate::album::AlbumStore;
use crate::audio::AudioHub;
use crate::hub::MetricsHub;
use crate::ipc::handle_socket;
use crate::storage::StorageManager;
use crate::tls::TlsAssets;

#[derive(Embed)]
#[folder = "static"]
#[prefix = ""]
struct Assets;

#[derive(Clone)]
struct AppState {
    hub: MetricsHub,
    audio: AudioHub,
    agent: AgentRuntime,
    root_ca_pem: std::sync::Arc<Vec<u8>>,
}

pub async fn serve(
    addr: SocketAddr,
    hub: MetricsHub,
    albums: AlbumStore,
    music: crate::music::MusicStore,
    illustrations: crate::illustration::IllustrationStore,
    particles: crate::particle::ParticleStore,
    audio: AudioHub,
    storage: StorageManager,
    tls: TlsAssets,
    agent: AgentRuntime,
) -> anyhow::Result<()> {
    let root_ca_pem = std::sync::Arc::new(tokio::fs::read(&tls.root_ca_cert_path).await?);
    let app = build_app(
        hub,
        albums,
        music,
        illustrations,
        particles,
        audio,
        storage,
        agent,
        root_ca_pem,
    );

    let tls_config = axum_server::tls_rustls::RustlsConfig::from_pem_file(
        &tls.server_cert_path,
        &tls.server_key_path,
    )
    .await?;
    let server = axum_server::bind_rustls(addr, tls_config).serve(app.into_make_service());
    tokio::select! {
        result = server => result?,
        _ = shutdown_signal() => tracing::info!("shutdown signal received"),
    }
    Ok(())
}

pub async fn serve_http(
    addr: SocketAddr,
    hub: MetricsHub,
    albums: AlbumStore,
    music: crate::music::MusicStore,
    illustrations: crate::illustration::IllustrationStore,
    particles: crate::particle::ParticleStore,
    audio: AudioHub,
    storage: StorageManager,
    agent: AgentRuntime,
) -> anyhow::Result<()> {
    let app = build_app(
        hub,
        albums,
        music,
        illustrations,
        particles,
        audio,
        storage,
        agent,
        std::sync::Arc::new(Vec::new()),
    );
    let listener = tokio::net::TcpListener::bind(addr).await.map_err(|error| {
        if error.kind() == std::io::ErrorKind::AddrInUse {
            anyhow::anyhow!(
                "端口 {addr} 已被占用。请先关闭正在运行的 vivoflow.exe，然后重新打开。"
            )
        } else {
            anyhow::Error::new(error).context(format!("failed to bind {addr}"))
        }
    })?;
    let server = axum::serve(listener, app);
    tokio::select! {
        result = server => result?,
        _ = shutdown_signal() => tracing::info!("shutdown signal received"),
    }
    Ok(())
}

fn build_app(
    hub: MetricsHub,
    albums: AlbumStore,
    music: crate::music::MusicStore,
    illustrations: crate::illustration::IllustrationStore,
    particles: crate::particle::ParticleStore,
    audio: AudioHub,
    storage: StorageManager,
    agent: AgentRuntime,
    root_ca_pem: std::sync::Arc<Vec<u8>>,
) -> Router {
    let state = AppState {
        hub,
        audio,
        agent,
        root_ca_pem,
    };

    Router::new()
        .route("/api/health", get(health))
        .route("/api/snapshot", get(snapshot))
        .route("/api/history", get(history))
        .route("/api/config", get(get_config))
        .route("/api/audio/devices", get(audio_devices))
        .route("/api/tls/root-ca.pem", get(root_ca))
        .route("/api/agent/health", get(agent_health))
        .route("/api/agent/models", get(agent_models))
        .route("/api/agent/ollama/test", get(agent_ollama_test))
        .route("/api/agent/restart", post(agent_restart))
        .route("/api/agent/install", post(agent_install))
        .route("/api/agent/install/status", get(agent_install_status))
        .route(
            "/api/agent/download-status/{service}",
            get(agent_download_status),
        )
        .route(
            "/api/agent/download-cancel/{service}",
            post(agent_download_cancel),
        )
        .route("/api/agent/chat", post(agent_chat))
        .route("/api/agent/cancel", post(agent_cancel))
        .route("/api/agent/clear", post(agent_clear))
        .route("/api/agent/transcribe", post(agent_transcribe))
        .route("/api/agent/tts", post(agent_tts))
        .route("/api/agent/download/{service}", post(agent_download))
        .route("/ws/agent-voice", get(crate::agent_voice::ws_handler))
        .route("/ws", get(ws_handler))
        .fallback(static_handler)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
        .merge(crate::storage::router(storage.clone()))
        .merge(crate::album::router(albums))
        .merge(crate::music::router(music))
        .merge(crate::illustration::router(illustrations))
        .merge(crate::particle::router(particles))
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};
        let mut terminate = signal(SignalKind::terminate()).expect("install SIGTERM handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {},
            _ = terminate.recv() => {},
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

async fn agent_health(State(state): State<AppState>) -> Response {
    proxy_agent_get(&state.agent, "/health").await
}

async fn agent_models(State(state): State<AppState>) -> Response {
    proxy_agent_get(&state.agent, "/models").await
}

async fn agent_ollama_test(State(state): State<AppState>) -> Response {
    proxy_agent_get(&state.agent, "/ollama/test").await
}

async fn agent_restart(State(state): State<AppState>) -> Response {
    match state.agent.restart() {
        Ok(()) => Json(serde_json::json!({ "ok": true })).into_response(),
        Err(error) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "ok": false, "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn agent_install(State(state): State<AppState>) -> Response {
    proxy_agent_json(&state.agent, "/install", serde_json::json!({})).await
}

async fn agent_install_status(State(state): State<AppState>) -> Response {
    proxy_agent_get(&state.agent, "/install/status").await
}

async fn agent_download_status(
    State(state): State<AppState>,
    Path(service): Path<String>,
) -> Response {
    let service: String = service
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    proxy_agent_get(&state.agent, &format!("/download-status/{service}")).await
}

async fn agent_download_cancel(
    State(state): State<AppState>,
    Path(service): Path<String>,
) -> Response {
    let service: String = service
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    proxy_agent_json(
        &state.agent,
        &format!("/download-cancel/{service}"),
        serde_json::json!({}),
    )
    .await
}

async fn agent_chat(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    proxy_agent_json(&state.agent, "/chat", payload).await
}

async fn agent_cancel(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    proxy_agent_json(&state.agent, "/cancel", payload).await
}

async fn agent_clear(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    proxy_agent_json(&state.agent, "/clear", payload).await
}

async fn agent_transcribe(State(state): State<AppState>, body: Bytes) -> Response {
    proxy_agent_bytes(&state.agent, "/transcribe", body, "audio/wav").await
}

async fn agent_tts(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    proxy_agent_json(&state.agent, "/tts", payload).await
}

async fn agent_download(State(state): State<AppState>, Path(service): Path<String>) -> Response {
    let service: String = service
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    proxy_agent_json(
        &state.agent,
        &format!("/download/{service}"),
        serde_json::json!({}),
    )
    .await
}

async fn proxy_agent_get(agent: &AgentRuntime, path: &str) -> Response {
    let client = agent_client();
    match client
        .get(format!("{}{}", agent.base_url(), path))
        .send()
        .await
    {
        Ok(response) => response_to_response(response).await,
        Err(error) => agent_unavailable(error.to_string()),
    }
}

async fn proxy_agent_json(
    agent: &AgentRuntime,
    path: &str,
    payload: serde_json::Value,
) -> Response {
    let client = agent_client();
    match client
        .post(format!("{}{}", agent.base_url(), path))
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => response_to_response(response).await,
        Err(error) => agent_unavailable(error.to_string()),
    }
}

async fn proxy_agent_bytes(
    agent: &AgentRuntime,
    path: &str,
    body: Bytes,
    content_type: &str,
) -> Response {
    let client = agent_client();
    match client
        .post(format!("{}{}", agent.base_url(), path))
        .header(reqwest::header::CONTENT_TYPE, content_type)
        .body(body)
        .send()
        .await
    {
        Ok(response) => response_to_response(response).await,
        Err(error) => agent_unavailable(error.to_string()),
    }
}

fn agent_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30 * 60))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

async fn response_to_response(response: reqwest::Response) -> Response {
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/json")
        .to_owned();
    let tts_ms = response
        .headers()
        .get("x-vivoflow-tts-ms")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let stream = response
        .bytes_stream()
        .map_err(|error| std::io::Error::other(error.to_string()));
    let mut builder = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-store");
    if let Some(tts_ms) = tts_ms {
        builder = builder.header("x-vivoflow-tts-ms", tts_ms);
    }
    builder
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| agent_unavailable("invalid agent response".into()))
}

fn agent_unavailable(message: String) -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(serde_json::json!({ "ok": false, "error": message })),
    )
        .into_response()
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "ok": true, "service": "vivoflow" }))
}

async fn snapshot(State(state): State<AppState>) -> impl IntoResponse {
    match state.hub.latest() {
        Some(s) => Json(serde_json::to_value(s).unwrap_or_default()).into_response(),
        None => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"type":"error","message":"no snapshot yet"})),
        )
            .into_response(),
    }
}

async fn history(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "type": "history",
        "items": state.hub.history(),
    }))
}

async fn get_config(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "type": "config",
        "config": &*state.hub.config.read(),
    }))
}

async fn audio_devices() -> impl IntoResponse {
    match tokio::task::spawn_blocking(crate::audio::enumerate_devices).await {
        Ok(Ok(devices)) => Json(serde_json::json!({ "devices": devices })).into_response(),
        Ok(Err(error)) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "message": error.to_string() })),
        )
            .into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "message": error.to_string() })),
        )
            .into_response(),
    }
}

async fn root_ca(State(state): State<AppState>) -> Response {
    if state.root_ca_pem.is_empty() {
        return (StatusCode::NOT_FOUND, "TLS is not enabled").into_response();
    }
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/x-pem-file"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=vivoflow-root-ca.pem",
            ),
            (header::CACHE_CONTROL, "no-store"),
        ],
        state.root_ca_pem.as_ref().clone(),
    )
        .into_response()
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.hub, state.audio))
}

async fn static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    match Assets::get(path) {
        Some(file) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, mime.as_ref())],
                file.data,
            )
                .into_response()
        }
        None => match Assets::get("index.html") {
            Some(file) => {
                let mime = mime_guess::from_path("index.html").first_or_octet_stream();
                (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, mime.as_ref())],
                    file.data.into_owned(),
                )
                    .into_response()
            }
            None => (
                StatusCode::NOT_FOUND,
                Html(
                    "<!doctype html><meta charset=utf-8><title>VivoFlow</title>\
                     <body style='font-family:system-ui;padding:2rem'>\
                     <h1>VivoFlow</h1>\
                     <p>Frontend not built. Run <code>npm run build</code> in <code>web/</code> then rebuild.</p>\
                     <p>API: <a href=/api/health>/api/health</a> · WS: <code>/ws</code></p>\
                     </body>",
                ),
            )
                .into_response(),
        }
    }
}
