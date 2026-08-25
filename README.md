# VivoFlow

Windows 系统指标采集器 + 移动优先仪表盘。单进程：Rust 采集、内嵌前端、WebSocket JSON IPC。手机（如 iPhone XS）通过局域网浏览器访问。

## 功能

- **CPU**：核心数、型号、标称/运行频率、占用
- **内存**：容量、占用、型号、频率；温度在无法读取时为 `null`
- **显卡**：型号、显存、占用/温度/显存频率（NVIDIA NVML；否则可能为 `null`）
- **磁盘**：数量、型号、容量、读写 IO
- **网络**：网卡名称/型号、上下行速率
- **音频可视化**：WASAPI 输出捕获、四种实时频谱、输出设备与配色控制

## 快速开始

### 开发

终端 1 — 后端：

```bash
cargo run -p vivoflow
```

终端 2 — 前端（代理 `/ws` 与 `/api` 到 `8787`）：

```bash
cd web
npm install
npm run dev
```

本机打开 `http://127.0.0.1:5173`。

### 生产（单二进制）

```powershell
./scripts/build.ps1
.\target\release\vivoflow.exe
```

脚本会：构建 `web/` → 同步到 `crates/vivoflow/static`（该目录已 gitignore）→ `cargo build --release`。

默认监听 `0.0.0.0:8787`。手机同 Wi‑Fi 访问：

```text
http://<电脑局域网IP>:8787
```

环境变量：

| 变量 | 说明 | 默认 |
|------|------|------|
| `VIVOFLOW_ADDR` | 监听地址 | `0.0.0.0:8787` |
| `VIVOFLOW_CONFIG` | 配置文件路径 | `%LOCALAPPDATA%/VivoFlow/config.json` |
| `RUST_LOG` | 日志级别 | `info` |

### 防火墙

首次需允许入站 TCP `8787`（专用网络），否则手机无法连接。

## JSON IPC（WebSocket）

路径：`/ws`。消息均为 JSON，含 `type` 字段。

| 方向 | type | 说明 |
|------|------|------|
| C→S | `hello` | 可选握手 |
| C→S | `get_snapshot` | 立即拉取快照 |
| C→S | `get_config` / `set_config` | 读写采集参数 |
| C→S | `set_audio_subscription` | 订阅或取消实时频谱 |
| S→C | `snapshot` | 指标推送 |
| S→C | `config` | 配置回传 |
| S→C | `error` | 错误信息 |
| S→C | `audio_frame` / `audio_status` | 64 段频谱与捕获状态 |

HTTP 调试：`GET /api/health`、`GET /api/snapshot`、`GET /api/config`、`GET /api/audio/devices`。

### 配置示例

```json
{
  "type": "set_config",
  "config": {
    "interval_ms": 1000,
    "enabled": {
      "cpu": true,
      "memory": true,
      "gpu": true,
      "disk": true,
      "network": true
    },
    "history_points": 60
  }
}
```

## UI

- Vite + React + Tailwind CSS + shadcn 风格组件
- 明亮/暗黑主题
- 竖屏单列 / 横屏双列（iPhone XS 优先）
- 加载动画与 mono 图表风格对齐 [Amicro Loaders](https://amicro.vercel.app/loaders) / [Mono Charts](https://amicro.vercel.app/mono-charts)

## 指标可用性说明

以下字段在硬件/驱动不暴露时返回 JSON `null`，UI 显示「不可用」：

- 内存温度
- 非 NVIDIA 显卡的占用、温度、显存频率
- 部分机器的内存 SPD（型号/频率）
- 部分 CPU 当前运行频率

首版仅建议局域网使用，无认证。

## 许可证

Apache-2.0
