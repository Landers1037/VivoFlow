use std::net::SocketAddr;

use axum::extract::ws::WebSocketUpgrade;
use axum::extract::State;
use axum::http::{header, StatusCode, Uri};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use rust_embed::Embed;
use tower_http::cors::{Any, CorsLayer};

use crate::album::AlbumStore;
use crate::hub::MetricsHub;
use crate::ipc::handle_socket;

#[derive(Embed)]
#[folder = "static"]
#[prefix = ""]
struct Assets;

#[derive(Clone)]
struct AppState {
    hub: MetricsHub,
}

pub async fn serve(addr: SocketAddr, hub: MetricsHub, albums: AlbumStore) -> anyhow::Result<()> {
    let state = AppState { hub };

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/snapshot", get(snapshot))
        .route("/api/history", get(history))
        .route("/api/config", get(get_config))
        .route("/ws", get(ws_handler))
        .fallback(static_handler)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
        .merge(crate::album::router(albums));

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
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

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.hub))
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
