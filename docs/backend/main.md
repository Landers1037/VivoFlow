# main — 进程入口

**文件：** [`crates/vivoflow/src/main.rs`](../../crates/vivoflow/src/main.rs)

## 职责

1. 初始化 `tracing`（`RUST_LOG` / 默认 `info`）。
2. 解析 `VIVOFLOW_ADDR`（默认 `0.0.0.0:8787`）。
3. 创建共享 `AppConfig`（`Arc<RwLock<_>>`）与 `MetricsHub`。
4. `hub.clone().spawn_collector()` 启动后台采集任务。
5. 创建或加载持久化根 CA，并为当前主机名与本机 IP 签发服务端证书。
6. `server::serve(...)` 阻塞运行 HTTPS/WSS 服务。

## 模块声明

```text
collectors / config / hub / ipc / models / server / tls
```

入口本身不含业务逻辑，只做组装与启动。

## TLS 文件

TLS 文件默认位于 `%LOCALAPPDATA%/VivoFlow/tls/`；设置 `VIVOFLOW_CONFIG` 时，则位于该配置文件同级的 `tls/` 目录。

| 文件 | 用途 |
|------|------|
| `vivoflow-root-ca.pem` | 可安装到客户端的公开根证书 |
| `vivoflow-root-ca-key.pem` | 根 CA 私钥，只保存在服务端本机 |
| `vivoflow-server.pem` | 当前启动使用的服务端证书 |
| `vivoflow-server-key.pem` | 当前启动使用的服务端私钥 |

根 CA 首次启动生成并长期复用。叶子证书每次启动重新签发，SAN 包含 `localhost`、环回地址、当前主机名和检测到的本机接口地址。CA 文件只存在一半时启动会明确失败，避免静默替换已经分发给客户端的信任根。
