#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::time::Duration;

use tauri::{Listener, Manager};

const SERVER_ADDR: &str = "127.0.0.1:8787";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            configure_agent_script(app);
            let window = app
                .get_webview_window("main")
                .expect("main window is declared in tauri.conf.json");
            match std::net::TcpListener::bind(SERVER_ADDR) {
                Ok(listener) => {
                    drop(listener);
                    let window_for_error = window.clone();
                    tauri::async_runtime::spawn(async move {
                        let addr = SERVER_ADDR.parse().expect("static server address");
                        if let Err(error) = vivoflow::run_http(addr).await {
                            let message = error.to_string();
                            eprintln!("VivoFlow server error: {message}");
                            present_error(window_for_error, message);
                        }
                    });
                }
                Err(error) => {
                    let message = if error.kind() == std::io::ErrorKind::AddrInUse {
                        "端口 8787 已被占用。请先关闭正在运行的 vivoflow.exe，然后重新打开。"
                            .to_string()
                    } else {
                        format!("无法监听 {SERVER_ADDR}：{error}")
                    };
                    eprintln!("VivoFlow: {message}");
                    present_error(window, message);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running VivoFlow");
}

fn configure_agent_script(app: &tauri::App) {
    let dev_script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("agent")
        .join("index.mjs");
    let bundled = app
        .path()
        .resource_dir()
        .ok()
        .map(|dir| dir.join("agent").join("index.mjs"));

    let selected = if cfg!(debug_assertions) && dev_script.is_file() {
        Some(dev_script)
    } else if bundled.as_ref().is_some_and(|path| path.is_file()) {
        bundled
    } else if dev_script.is_file() {
        Some(dev_script)
    } else {
        None
    };

    if let Some(path) = selected {
        eprintln!("VivoFlow agent script: {}", path.display());
        // SAFETY: called once from Tauri setup, before the server spawns the agent process.
        unsafe { std::env::set_var("VIVOFLOW_AGENT_SCRIPT", path) };
    }
}

fn present_error(window: tauri::WebviewWindow, message: String) {
    let window_for_load = window.clone();
    let message_for_load = message.clone();
    window.listen("tauri://page-load", move |_| {
        inject_error(&window_for_load, &message_for_load);
    });
    inject_error(&window, &message);
    std::thread::spawn(move || {
        for _ in 0..40 {
            std::thread::sleep(Duration::from_millis(250));
            inject_error(&window, &message);
        }
    });
}

fn inject_error(window: &tauri::WebviewWindow, message: &str) {
    let html = format!(
        r#"<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>VivoFlow</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#101114;color:#f4f1ea;font-family:Segoe UI,sans-serif">
  <header data-tauri-drag-region style="position:fixed;top:0;left:0;right:0;height:40px;display:flex;align-items:center;padding-left:12px;background:#17181c;border-bottom:1px solid #2a2c31;user-select:none">
    <span data-tauri-drag-region style="flex:1">VivoFlow</span>
    <button type="button" data-vf-window="minimize" style="width:46px;height:40px;border:0;background:transparent;color:inherit">—</button>
    <button type="button" data-vf-window="toggle" style="width:46px;height:40px;border:0;background:transparent;color:inherit">□</button>
    <button type="button" data-vf-window="close" style="width:46px;height:40px;border:0;background:transparent;color:inherit">×</button>
  </header>
  <main style="max-width:36rem;padding:2rem">
    <p style="margin:0;letter-spacing:.14em;text-transform:uppercase;font-size:.75rem;opacity:.62">VivoFlow</p>
    <h1 style="margin:.6rem 0 0;font-size:1.6rem;font-weight:560">无法启动本地服务</h1>
    <p style="margin:.8rem 0 0;line-height:1.6">{escaped}</p>
  </main>
  <script>
    const invoke = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;
    const commands = {{ minimize: "plugin:window|minimize", toggle: "plugin:window|toggle_maximize", close: "plugin:window|close" }};
    document.querySelectorAll("[data-vf-window]").forEach((button) => {{
      button.addEventListener("click", () => {{
        const command = commands[button.getAttribute("data-vf-window")];
        if (invoke && command) invoke(command, {{ label: "main" }});
      }});
    }});
  </script>
</body>
</html>"#,
        escaped = escape_html(message)
    );
    let script = format!(
        "document.open();document.write({});document.close();",
        serde_json::to_string(&html).unwrap_or_else(|_| "\"\"".to_string())
    );
    let _ = window.eval(script);
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}
