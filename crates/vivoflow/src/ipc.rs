use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;

use crate::config::AppConfig;
use crate::hub::MetricsHub;

#[derive(Debug, Deserialize)]
struct ClientMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    config: Option<AppConfig>,
}

pub async fn handle_socket(socket: WebSocket, hub: MetricsHub) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = hub.subscribe();

    // Send current config + latest snapshot on connect.
    if let Ok(text) = serde_json::to_string(&json!({
        "type": "config",
        "config": &*hub.config.read(),
    })) {
        let _ = sender.send(Message::Text(text.into())).await;
    }
    if let Some(snapshot) = hub.latest() {
        if let Ok(text) = serde_json::to_string(&snapshot) {
            let _ = sender.send(Message::Text(text.into())).await;
        }
    }

    loop {
        tokio::select! {
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Err(err) = handle_text(&text, &hub, &mut sender).await {
                            let _ = sender.send(Message::Text(
                                json!({"type":"error","message": err.to_string()}).to_string().into()
                            )).await;
                        }
                    }
                    Some(Ok(Message::Ping(p))) => {
                        let _ = sender.send(Message::Pong(p)).await;
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
            result = rx.recv() => {
                match result {
                    Ok(snapshot) => {
                        if let Ok(text) = serde_json::to_string(&snapshot) {
                            if sender.send(Message::Text(text.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
        }
    }
}

async fn handle_text<S>(
    text: &str,
    hub: &MetricsHub,
    sender: &mut S,
) -> anyhow::Result<()>
where
    S: SinkExt<Message> + Unpin,
    S::Error: std::error::Error + Send + Sync + 'static,
{
    let msg: ClientMessage = serde_json::from_str(text)?;
    match msg.msg_type.as_str() {
        "hello" => Ok(()),
        "get_snapshot" => {
            if let Some(snapshot) = hub.latest() {
                let text = serde_json::to_string(&snapshot)?;
                sender
                    .send(Message::Text(text.into()))
                    .await
                    .map_err(|e| anyhow::anyhow!(e))?;
            }
            Ok(())
        }
        "get_config" => {
            let text = serde_json::to_string(&json!({
                "type": "config",
                "config": &*hub.config.read(),
            }))?;
            sender
                .send(Message::Text(text.into()))
                .await
                .map_err(|e| anyhow::anyhow!(e))?;
            Ok(())
        }
        "set_config" => {
            let Some(cfg) = msg.config else {
                anyhow::bail!("missing config");
            };
            let cfg = cfg.sanitize();
            *hub.config.write() = cfg.clone();
            let text = serde_json::to_string(&json!({
                "type": "config",
                "config": cfg,
            }))?;
            sender
                .send(Message::Text(text.into()))
                .await
                .map_err(|e| anyhow::anyhow!(e))?;
            Ok(())
        }
        other => anyhow::bail!("unknown message type: {other}"),
    }
}
