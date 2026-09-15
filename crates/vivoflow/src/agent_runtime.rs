//! Lifecycle wrapper for the local Node agent bridge.
//!
//! The bridge is intentionally a separate process: Pi is a JavaScript SDK and
//! ChatTTS is a Python model. Rust remains the only LAN-facing process.

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use parking_lot::Mutex;

#[derive(Clone)]
pub struct AgentRuntime {
    child: Arc<Mutex<Option<Child>>>,
    base_url: Arc<String>,
}

impl AgentRuntime {
    pub fn start() -> Self {
        let base_url = std::env::var("VIVOFLOW_AGENT_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8790".to_owned());
        let child = spawn_bridge().ok();
        if child.is_none() {
            tracing::warn!(
                "local agent bridge is unavailable; install Node.js and agent dependencies"
            );
        }
        Self {
            child: Arc::new(Mutex::new(child)),
            base_url: Arc::new(base_url),
        }
    }

    pub fn base_url(&self) -> &str {
        self.base_url.as_str()
    }

    pub fn restart(&self) -> anyhow::Result<()> {
        let mut slot = self.child.lock();
        if let Some(mut child) = slot.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *slot = Some(spawn_bridge()?);
        Ok(())
    }
}

impl Drop for AgentRuntime {
    fn drop(&mut self) {
        // Only the final Arc owner should terminate the process.
        if Arc::strong_count(&self.child) != 1 {
            return;
        }
        if let Some(mut child) = self.child.lock().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn spawn_bridge() -> anyhow::Result<Child> {
    let script =
        bridge_script_path().ok_or_else(|| anyhow::anyhow!("agent/index.mjs not found"))?;
    let node = std::env::var_os("VIVOFLOW_NODE").unwrap_or_else(|| "node".into());
    let config_path = crate::config::config_file_path();
    let mut command = Command::new(node);
    command
        .arg(script)
        .arg("--port")
        .arg("8790")
        .env("VIVOFLOW_CONFIG", config_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    Ok(command.spawn()?)
}

fn bridge_script_path() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(path) = std::env::var("VIVOFLOW_AGENT_SCRIPT") {
        candidates.push(PathBuf::from(path));
    }
    candidates.push(PathBuf::from("agent/index.mjs"));
    if let Some(parent) = crate::config::config_file_path().parent() {
        candidates.push(parent.join("agent/index.mjs"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("agent/index.mjs"));
        }
    }
    candidates.into_iter().find(|path| path.is_file())
}
