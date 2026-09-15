# VivoFlow

Windows 系统指标采集器 + 移动优先仪表盘。单进程：Rust 采集、内嵌前端、WebSocket JSON IPC。手机（如 iPhone XS）通过局域网浏览器访问。

## 功能

- **CPU**：核心数、型号、标称/运行频率、占用
- **内存**：容量、占用、型号、频率；温度在无法读取时为 `null`
- **显卡**：型号、显存、占用/温度/显存频率（NVIDIA NVML；否则可能为 `null`）
- **磁盘**：数量、型号、容量、读写 IO
- **网络**：网卡名称/型号、上下行速率
- **音频可视化**：WASAPI 输出捕获、四种 2D 频谱与四种 Three.js 3D 声场、输出设备与配色控制
- **像素插画**：浏览器 Canvas / Web Worker 本地生成像素插画，并支持原图轮播与高级参数
- **媒体存储**：统一管理相册、音乐和插画原图目录，查看分类占用并迁移路径
- **本地语音智能体**：可配置唤醒词，使用 Pi SDK + Ollama 对话，Whisper 中文识别，ChatTTS 语音回复，并提供时间、天气、网页搜索与网页读取工具

## 快速开始

### 开发

一键（推荐）：新窗口跑 Rust 后端，当前窗口跑 Vite 热更新。

```powershell
./scripts/dev.ps1
```

本机打开 `http://127.0.0.1:5173`。Vite 会以 HTTPS/WSS 代理到 `8787`；开发页面仍可在 localhost 安全上下文中使用麦克风。改前端会即时刷新，不必重新 `build.ps1`。

若 8787 已被生产进程占用，先关掉 `vivoflow.exe` 再跑开发脚本。

也可以手动开两个终端：

```bash
cargo run -p vivoflow
```

```bash
cd web
npm install
npm run dev
```

### 生产（单二进制）

```powershell
./scripts/build.ps1
.\target\release\vivoflow.exe
```

脚本会：构建 `web/` → 安装 `agent/` 的 Node 生产依赖 → 同步到 `crates/vivoflow/static`（该目录已 gitignore）→ `cargo build --release` → 将 Node bridge 复制到 `target/release/agent/`。

首次打开「设置 → 智能体」后，先点击“安装运行环境”，再点击“准备模型”。应用会在 `%LOCALAPPDATA%/VivoFlow/agent/` 管理 Python 虚拟环境、Whisper 模型、ChatTTS 缓存和运行时状态。Pi bridge 使用 Node.js 22.19+，ChatTTS 使用 Python 3.11、PyTorch 和 CUDA（自动模式会在 CUDA 不可用时回退 CPU）。联网开关默认关闭；开启后才允许搜索、天气和网页读取。

Whisper 下载固定到 whisper.cpp v1.8.7，并在启用前校验 SHA-256；中断下载会留下 `.part` 文件，下一次点击“准备模型”时继续下载。显式选择 CUDA 会下载对应的 cuBLAS 12.4 Windows x64 包。

首次启动会在配置目录的 `tls/` 下创建并持久化 VivoFlow 根 CA，再为 `localhost`、当前主机名和检测到的本机 IP 签发服务端证书。之后默认监听 `0.0.0.0:8787`，手机同 Wi‑Fi 访问：

```text
https://<电脑局域网IP>:8787
```

根证书路径会打印在启动日志中，默认是 `%LOCALAPPDATA%/VivoFlow/tls/vivoflow-root-ca.pem`，也可从 `https://<电脑局域网IP>:8787/api/tls/root-ca.pem` 下载。将该公开根证书安装并设为受信任后，Safari 才会把页面视为可信 HTTPS；根 CA 私钥不会通过接口提供。iPhone/iPad 还需在「设置 → 通用 → 关于本机 → 证书信任设置」中为该根证书开启完全信任。

根 CA 会跨启动复用，因此客户端只需安装一次；服务端证书每次启动重新签发，以包含当前局域网地址。若删除整个 `tls/` 目录，下一次启动会生成新的根 CA，所有客户端都需要重新安装。

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

HTTPS 调试：`GET /api/health`、`GET /api/snapshot`、`GET /api/config`、`GET /api/audio/devices`、`GET /api/tls/root-ca.pem`、`GET /api/illustrations`、`GET /api/storage`。智能体接口见 [`docs/backend/agent-runtime.md`](docs/backend/agent-runtime.md)，包含服务状态、运行环境安装、模型下载、会话流、识别和语音合成。

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

首版仅建议受信任的局域网使用，无认证。HTTPS 保护传输内容，但不会限制同一网络中的访问者。

## 许可证

Apache-2.0
