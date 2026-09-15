# 本地语音智能体运行时

VivoFlow 的 LAN-facing 进程仍然是 Rust。启动时 Rust 会在本地发现并启动 `agent/index.mjs`，Node bridge 使用 Pi SDK 调用 Ollama，并按需启动 ChatTTS Python 服务和 `whisper-server.exe`。浏览器只访问 VivoFlow 的 HTTPS/WS 端口，Node、Whisper 和 ChatTTS 默认绑定 `127.0.0.1`。

## 配置

新配置字段通过 `/ws` 的 `set_config` 保存到 `%LOCALAPPDATA%/VivoFlow/config.json`：

- `agent_wake_word`：默认“小薇小薇”。
- `agent_internet_enabled`：统一控制搜索、天气和 `webfetch`。
- `agent_transcript_enabled`：开启实时字幕。
- `agent_default_city`：天气未指定城市时使用。
- `agent_ollama_url`、`agent_ollama_model`：本地或局域网 Ollama。
- `agent_whisper_model`：`base`、`small` 或 `medium`。
- `agent_voice_device`：`auto`、`cuda` 或 `cpu`。

Whisper 下载固定到 whisper.cpp `v1.8.7`：`cpu/auto` 使用 `whisper-bin-x64.zip`，显式选择 `cuda` 使用 `whisper-cublas-12.4.0-bin-x64.zip`。

## 服务接口

Rust 代理以下同源接口：`GET /api/agent/health`、`GET /api/agent/ollama/test`、`GET /api/agent/models`、`POST /api/agent/restart`、`POST /api/agent/install`、`GET /api/agent/install/status`、`POST /api/agent/chat`、`POST /api/agent/cancel`、`POST /api/agent/clear`、`POST /api/agent/transcribe`、`POST /api/agent/tts`、`POST /api/agent/download/{service}`、`GET /api/agent/download-status/{service}` 和 `POST /api/agent/download-cancel/{service}`。`health` 返回 `missing` 列表，包含服务或所选 Ollama 模型缺失项。聊天响应使用 NDJSON，事件包括 `delta`、`tool_start`、`tool_end`、`end` 和 `error`。安装和下载状态接口可轮询阶段、字节进度、完成或错误状态；断开请求会取消当前下载并保留 `.part` 以便下次续传。桥接异常退出时可调用 `restart` 重新启动 Node 服务。

首次使用可在设置中点击“安装运行环境”，再点击“准备模型”。运行时代码随应用打包，依赖、模型和缓存写入 `%LOCALAPPDATA%/VivoFlow/agent/`（可通过 `VIVOFLOW_AGENT_DATA` 覆盖）。安装优先使用托管 `uv` 创建 Python 3.11 虚拟环境；缺少 `uv` 时 Windows 先尝试 `py -3.11`，再回退到系统 Python 的 `venv`。Whisper 模型下载到该目录的 `whisper/models/`，ChatTTS 在首次准备或合成时从其模型仓库加载。下载和推理失败会保留已有模型并返回可读错误。

如果目标机已准备好托管 Python 环境，可设置 `VIVOFLOW_PYTHON` 指向 Python 解释器；否则 bridge 会优先寻找 `agent/.venv`，再回退到 PATH 中的 `python`。Node bridge 要求 Node.js 22.19 或更高版本。

## 许可证与运行要求

Pi bridge 需要 Node.js 22.19 或更高版本，使用 `@earendil-works/pi-coding-agent@0.85.1` 和 `opencc-js@1.4.2`。ChatTTS 需要 Python 3.11、PyTorch 和相应 CUDA 运行库；ChatTTS 代码为 AGPLv3+，模型为 CC BY-NC 4.0。Whisper.cpp 的发布包和模型遵循各自上游许可证，部署时应保留许可证文件。
