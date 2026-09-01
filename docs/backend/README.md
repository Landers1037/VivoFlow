# 后端模块

源码根目录：[`crates/vivoflow/src/`](../crates/vivoflow/src/)

| 模块文档 | 源码 | 职责 |
|----------|------|------|
| [main.md](./main.md) | `main.rs` | 入口、日志、监听地址、启动 Hub |
| [config.md](./config.md) | `config.rs` | 采集参数与校验 |
| [audio.md](./audio.md) | `audio.rs` | Windows WASAPI 回环、频谱与音频状态 |
| [particles.md](./particles.md) | `particle.rs` | 粒子原图库、当前图片与内容路由 |
| [models.md](./models.md) | `models.rs` | 快照与指标数据结构 |
| [hub.md](./hub.md) | `hub.rs` | 采集循环、缓存、广播 |
| [collectors.md](./collectors.md) | `collectors/*` | CPU/内存/GPU/磁盘/网络/系统信息采集 |
| [ipc.md](./ipc.md) | `ipc.rs` | WebSocket 消息处理 |
| [server.md](./server.md) | `server.rs` | HTTP 路由与静态资源 |

依赖要点见 crate 的 [`Cargo.toml`](../crates/vivoflow/Cargo.toml)。
