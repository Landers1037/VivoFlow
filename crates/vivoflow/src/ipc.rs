use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;

use crate::audio::AudioHub;
use crate::config::AppConfig;
use crate::hub::MetricsHub;

#[derive(Debug, Deserialize)]
struct ClientMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    config: Option<AppConfig>,
    #[serde(default)]
    enabled: Option<bool>,
}

pub async fn handle_socket(socket: WebSocket, hub: MetricsHub, audio: AudioHub) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = hub.subscribe();
    let mut cfg_rx = hub.subscribe_config();
    let mut audio_rx = audio.subscribe_frames();
    let mut audio_status_rx = audio.subscribe_status();
    let mut audio_subscribed = false;

    if let Ok(text) = serde_json::to_string(&json!({
        "type": "config",
        "config": hub.current_config(),
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
                        if let Err(err) = handle_text(&text, &hub, &audio, &mut audio_subscribed, &mut sender).await {
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
            result = cfg_rx.recv() => {
                match result {
                    Ok(cfg) => {
                        if let Ok(text) = serde_json::to_string(&json!({
                            "type": "config",
                            "config": cfg,
                        })) {
                            if sender.send(Message::Text(text.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
            result = audio_rx.recv(), if audio_subscribed => {
                match result {
                    Ok(frame) => if let Ok(text) = serde_json::to_string(&frame) {
                        if sender.send(Message::Text(text.into())).await.is_err() { break; }
                    },
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
            result = audio_status_rx.recv(), if audio_subscribed => {
                match result {
                    Ok(status) => if let Ok(text) = serde_json::to_string(&status) {
                        if sender.send(Message::Text(text.into())).await.is_err() { break; }
                    },
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
    audio: &AudioHub,
    audio_subscribed: &mut bool,
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
                "config": hub.current_config(),
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
            // Persist + broadcast to all clients; this socket also receives via config_tx.
            let cfg = hub.set_config(cfg);
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
        "set_audio_subscription" => {
            *audio_subscribed = msg.enabled.unwrap_or(false);
            if *audio_subscribed {
                let text = serde_json::to_string(&audio.current_status())?;
                sender
                    .send(Message::Text(text.into()))
                    .await
                    .map_err(|e| anyhow::anyhow!(e))?;
            }
            Ok(())
        }
        other => anyhow::bail!("unknown message type: {other}"),
    }
}
