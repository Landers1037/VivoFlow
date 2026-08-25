# VivoFlow 文档

本目录按模块总结前后端核心实现，便于快速定位代码与约定。

| 文档 | 说明 |
|------|------|
| [architecture.md](./architecture.md) | 总体架构与数据流 |
| [ipc-protocol.md](./ipc-protocol.md) | WebSocket / HTTP JSON 协议 |
| [backend/README.md](./backend/README.md) | 后端模块索引 |
| [frontend/README.md](./frontend/README.md) | 前端模块索引 |

## 仓库结构对照

```
VivoFlow/
  crates/vivoflow/     # Rust 后端（采集 + HTTP/WS + 内嵌静态资源）
  web/                 # Vite + React 前端源码
  scripts/             # 开发（Vite + cargo run）与生产构建
  docs/                # 本目录
```
