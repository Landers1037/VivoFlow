# server — HTTP 与静态资源

**文件：** [`crates/vivoflow/src/server.rs`](../../crates/vivoflow/src/server.rs)

## 路由

| 路径 | 处理 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/snapshot` | 最新快照 |
| `GET /api/history` | Hub 历史数组 |
| `GET /api/config` | 当前配置 |
| `GET/POST /api/albums` | 列出或创建相册 |
| `PATCH/DELETE /api/albums/{id}` | 更新或删除相册及其图片 |
| `PUT /api/albums/order` | 保存完整相册顺序 |
| `POST /api/albums/{id}/images` | multipart 批量上传图片 |
| `PUT /api/albums/{id}/images/order` | 保存完整图片顺序 |
| `DELETE /api/albums/{id}/images/{image_id}` | 删除单张图片 |
| `GET /api/albums/{id}/images/{image_id}/content` | 返回图片内容 |
| `GET /ws` | 升级为 WebSocket → `ipc::handle_socket` |
| fallback `/*` | `rust-embed` 静态文件 |

## 静态资源

```rust
#[derive(Embed)]
#[folder = "static"]
struct Assets;
```

资源目录为 `crates/vivoflow/static/`（**不纳入 Git**），由构建脚本从 `web/dist` 同步。若目录缺失，`build.rs` 会写入占位 `index.html`，保证 `cargo build` 可通过。

- 命中文件：按扩展名设置 `Content-Type` 返回
- 未命中：回退 `index.html`（SPA）
- 连 `index.html` 都没有：返回简单 HTML 提示先构建前端

## 其它

- `CorsLayer`：允许任意源，方便 Vite 开发代理联调。
- `AppState` 仅持有可克隆的 `MetricsHub`。
- 相册元数据保存在配置目录的 `albums.json`，媒体文件位于同目录的 `albums/{album_id}/`。
- 上传按文件签名接受 JPEG、PNG、WebP、GIF、AVIF；单图最大 25 MB，单批最多 50 张。
