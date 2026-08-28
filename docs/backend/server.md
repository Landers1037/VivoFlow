# server — HTTP 与静态资源

**文件：** [`crates/vivoflow/src/server.rs`](../../crates/vivoflow/src/server.rs)

## 路由

| 路径 | 处理 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/snapshot` | 最新快照 |
| `GET /api/history` | Hub 历史数组 |
| `GET /api/config` | 当前配置 |
| `GET /api/audio/devices` | 活动输出设备、稳定 ID 与默认设备标记 |
| `GET/POST /api/albums` | 列出或创建相册 |
| `PATCH/DELETE /api/albums/{id}` | 更新或删除相册及其图片 |
| `PUT /api/albums/order` | 保存完整相册顺序 |
| `POST /api/albums/{id}/images` | multipart 批量上传图片 |
| `POST /api/albums/{id}/images/from-path` | 扫描本机目录并加载图片（不复制原文件） |
| `PUT /api/albums/{id}/images/order` | 保存完整图片顺序 |
| `DELETE /api/albums/{id}/images/{image_id}` | 删除单张图片 |
| `GET /api/albums/{id}/images/{image_id}/content` | 返回图片内容 |
| `GET/POST /api/music-albums` | 列出或创建音乐专辑 |
| `PATCH/DELETE /api/music-albums/{id}` | 更新或删除音乐专辑 |
| `POST /api/music-albums/{id}/enable` | 启用指定专辑并关闭其它首页媒体模块 |
| `PUT /api/music-albums/order` | 保存专辑顺序 |
| `POST /api/music-albums/{id}/cover` | 上传专辑封面 |
| `POST /api/music-albums/{id}/tracks` | multipart 批量上传音频 |
| `PATCH/DELETE /api/music-albums/{id}/tracks/{track_id}` | 更新歌词/标题或删除曲目 |
| `PUT /api/music-albums/{id}/tracks/order` | 保存曲目顺序 |
| `GET /api/music-albums/{id}/cover/content` | 返回封面内容 |
| `GET /api/music-albums/{id}/tracks/{track_id}/content` | 返回音频内容 |
| `GET /api/illustrations` | 读取像素插画列表与全局设置 |
| `PUT /api/illustrations/settings` | 保存像素插画全局设置 |
| `POST /api/illustrations/images` | 上传插画原图（仅保存原图，像素处理在浏览器完成） |
| `PUT /api/illustrations/images/order` | 保存插画顺序 |
| `DELETE /api/illustrations/images/{id}` | 删除插画原图 |
| `GET /api/illustrations/images/{id}/content` | 返回插画原图内容 |
| `GET/PUT /api/storage` | 读取存储占用或迁移托管媒体根路径 |
| `POST /api/storage/open` | 在运行 VivoFlow 的主机上打开媒体根路径 |
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
- 相册元数据保存在配置目录的 `albums.json`，上传的媒体文件位于共享媒体根路径的 `albums/{album_id}/`。
- 音乐专辑元数据保存在配置目录的 `music_albums.json`，封面和音频位于共享媒体根路径的 `music_albums/{album_id}/`。
- 插画元数据保存在配置目录的 `illustrations.json`，原图位于共享媒体根路径的 `illustrations/`；生成的像素图不落盘。
- 共享媒体根路径默认是配置目录，可在设置中迁移；托管媒体按 `albums/`、`music_albums/`、`illustrations/` 分类统计。
- 也可为相册配置本机目录：`POST /api/albums/{id}/images/from-path` 会扫描该目录下的图片并按原路径引用，删除相册或图片时不会删除原文件。
- 音频捕获仅在 Windows 可用；指定设备失效时保留配置并临时回退到系统默认设备。
- 上传与本地扫描均按文件签名接受 JPEG、PNG、WebP、GIF、AVIF；单图最大 25 MB。上传单批最多 50 张，目录扫描每次最多加载 500 张新图。
