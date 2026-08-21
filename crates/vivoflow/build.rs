use std::fs;
use std::path::Path;

fn main() {
    let static_dir = Path::new("static");
    let index = static_dir.join("index.html");
    if !index.exists() {
        fs::create_dir_all(static_dir).expect("create static/");
        fs::write(
            &index,
            r#"<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>VivoFlow</title>
  </head>
  <body style="font-family:system-ui;padding:2rem">
    <h1>VivoFlow</h1>
    <p>Frontend not built. Run <code>scripts/build.ps1</code> (or build <code>web/</code> and sync into <code>static/</code>), then rebuild.</p>
    <p>API: <a href="/api/health">/api/health</a> · WS: <code>/ws</code></p>
  </body>
</html>
"#,
        )
        .expect("write placeholder index.html");
    }
    println!("cargo:rerun-if-changed=static");
}
