use std::time::{Duration, Instant};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;

const FRAME_SAMPLES: usize = 640;
const START_THRESHOLD: f32 = 0.02;
const STOP_THRESHOLD: f32 = 0.012;
const START_FRAMES: u8 = 3;
const STOP_FRAMES: u8 = 20;

#[derive(Default)]
struct VoiceDetector {
    listening: bool,
    loud_frames: u8,
    quiet_frames: u8,
}

impl VoiceDetector {
    fn update(&mut self, pcm: &[u8]) -> (bool, f32) {
        let mut sum = 0.0f64;
        for pair in pcm.chunks_exact(2) {
            let sample = i16::from_le_bytes([pair[0], pair[1]]) as f64 / i16::MAX as f64;
            sum += sample * sample;
        }
        let level = (sum / (pcm.len() / 2) as f64).sqrt() as f32;
        if !self.listening {
            self.loud_frames = if level >= START_THRESHOLD {
                self.loud_frames.saturating_add(1)
            } else {
                0
            };
            if self.loud_frames >= START_FRAMES {
                self.listening = true;
                self.quiet_frames = 0;
            }
        } else {
            self.quiet_frames = if level <= STOP_THRESHOLD {
                self.quiet_frames.saturating_add(1)
            } else {
                0
            };
            if self.quiet_frames >= STOP_FRAMES {
                self.listening = false;
                self.loud_frames = 0;
            }
        }
        (self.listening, (level / 0.25).clamp(0.0, 1.0))
    }

    fn reset(&mut self) {
        *self = Self::default();
    }
}

#[derive(Deserialize)]
struct ControlMessage {
    #[serde(rename = "type")]
    kind: String,
    sample_rate: Option<u32>,
    channels: Option<u8>,
    format: Option<String>,
    frame_ms: Option<u16>,
}

pub async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn send_error<S>(sender: &mut S, code: &str)
where
    S: SinkExt<Message> + Unpin,
{
    let _ = sender
        .send(Message::Text(
            json!({"type":"error","code":code}).to_string().into(),
        ))
        .await;
}

async fn handle_socket(socket: WebSocket) {
    let (mut sender, mut receiver) = socket.split();
    let mut detector = VoiceDetector::default();
    let mut started = false;
    let mut last_frame = Instant::now();
    let mut frame_window = Instant::now();
    let mut frame_count = 0u16;
    loop {
        tokio::select! {
            message = receiver.next() => match message {
                Some(Ok(Message::Text(text))) => {
                    let Ok(control) = serde_json::from_str::<ControlMessage>(&text) else { send_error(&mut sender, "invalid_control").await; continue; };
                    match control.kind.as_str() {
                        "start" if control.sample_rate == Some(16_000) && control.channels == Some(1) && control.format.as_deref() == Some("pcm_s16le") && control.frame_ms == Some(40) => {
                            started = true; detector.reset(); last_frame = Instant::now(); frame_window = Instant::now(); frame_count = 0;
                            let _ = sender.send(Message::Text(json!({"type":"ready"}).to_string().into())).await;
                        }
                        "start" => send_error(&mut sender, "unsupported_format").await,
                        "stop" => { detector.reset(); break; }
                        _ => send_error(&mut sender, "invalid_control").await,
                    }
                }
                Some(Ok(Message::Binary(bytes))) => {
                    if !started { send_error(&mut sender, "handshake_required").await; continue; }
                    if bytes.len() != FRAME_SAMPLES * 2 { send_error(&mut sender, "invalid_frame").await; continue; }
                    if frame_window.elapsed() >= Duration::from_secs(1) { frame_window = Instant::now(); frame_count = 0; }
                    frame_count += 1;
                    if frame_count > 40 { send_error(&mut sender, "rate_limited").await; break; }
                    last_frame = Instant::now();
                    let (listening, level) = detector.update(&bytes);
                    let payload = json!({"type":"voice_state","listening":listening,"level":level});
                    if sender.send(Message::Text(payload.to_string().into())).await.is_err() { break; }
                }
                Some(Ok(Message::Ping(value))) => { let _ = sender.send(Message::Pong(value)).await; }
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                Some(Ok(_)) => {}
            },
            _ = tokio::time::sleep(Duration::from_millis(250)), if started => {
                if last_frame.elapsed() >= Duration::from_secs(2) {
                    detector.reset();
                    let payload = json!({"type":"voice_state","listening":false,"level":0.0});
                    if sender.send(Message::Text(payload.to_string().into())).await.is_err() { break; }
                    last_frame = Instant::now();
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(amplitude: i16) -> Vec<u8> {
        (0..FRAME_SAMPLES)
            .flat_map(|i| {
                let value = if i % 2 == 0 { amplitude } else { -amplitude };
                value.to_le_bytes()
            })
            .collect()
    }

    #[test]
    fn requires_three_loud_frames_and_twenty_quiet_frames() {
        let mut detector = VoiceDetector::default();
        assert!(!detector.update(&frame(1_000)).0);
        assert!(!detector.update(&frame(1_000)).0);
        assert!(detector.update(&frame(1_000)).0);
        for _ in 0..19 {
            assert!(detector.update(&frame(0)).0);
        }
        assert!(!detector.update(&frame(0)).0);
    }

    #[test]
    fn a_short_pulse_does_not_trigger_listening() {
        let mut detector = VoiceDetector::default();
        assert!(!detector.update(&frame(1_000)).0);
        assert!(!detector.update(&frame(0)).0);
        assert!(!detector.update(&frame(1_000)).0);
    }
}
