# main — 进程入口

**文件：** [`crates/vivoflow/src/main.rs`](../../crates/vivoflow/src/main.rs)

## 职责

1. 初始化 `tracing`（`RUST_LOG` / 默认 `info`）。
2. 解析 `VIVOFLOW_ADDR`（默认 `0.0.0.0:8787`）。
3. 创建共享 `AppConfig`（`Arc<RwLock<_>>`）与 `MetricsHub`。
4. `hub.clone().spawn_collector()` 启动后台采集任务。
5. `server::serve(addr, hub)` 阻塞运行 HTTP/WS 服务。

## 模块声明

```text
collectors / config / hub / ipc / models / server
```

入口本身不含业务逻辑，只做组装与启动。
