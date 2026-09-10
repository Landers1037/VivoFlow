# agent voice — 声音活动接口

WebSocket：`/ws/agent-voice`。连接状态按客户端隔离，音频只在内存中即时计算，不落盘也不广播。

客户端先发送：

```json
{"type":"start","sample_rate":16000,"channels":1,"format":"pcm_s16le","frame_ms":40}
```

服务端返回 `{"type":"ready"}` 后，客户端发送每帧 640 个采样、1280 字节的 little-endian PCM16 二进制消息。服务端响应：

```json
{"type":"voice_state","listening":true,"level":0.42}
```

连续 3 帧 RMS ≥ 0.02 时进入聆听；连续 20 帧 RMS ≤ 0.012 时退出。2 秒没有收到音频会清除状态。每秒超过 40 帧、错误帧长、缺少握手和不支持的格式会返回带稳定 `code` 的 `error` 消息。

基础版本只检测声音活动，环境噪声也可能触发；它不识别语音内容。
