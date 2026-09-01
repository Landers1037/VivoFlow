# 音频可视化采集

源码：[`crates/vivoflow/src/audio.rs`](../../crates/vivoflow/src/audio.rs)

## 职责

`audio.rs` 负责：

- 枚举 Windows 中处于活动状态的音频播放端点；
- 根据配置选择指定播放设备，设备不可用时回退到系统默认播放设备；
- 使用 Windows WASAPI 共享模式回环采集播放端点的系统混音；
- 将多声道样本混合为单声道，并生成 64 个频段、RMS、峰值和节拍信息；
- 通过广播通道向 WebSocket 客户端发布 `audio_frame` 和 `audio_status`。

采集在音频可视化开启时运行；图片粒子首页开启且 `particle_audio_reactive` 为真时也会运行。两个功能共享 `audio_device_id`、64 段频谱和 WebSocket 订阅协议。

非 Windows 平台不会启动回环采集，并返回 `audio loopback is only supported on Windows`。

## Windows 回环链路

```text
播放器 → Windows 音频引擎 → 播放端点（有线/HDMI/蓝牙 A2DP）
                              └→ WASAPI loopback → AudioHub → WebSocket
```

蓝牙传输使用的 SBC、AAC 等编码由 Windows 和设备驱动处理。VivoFlow 不直接解码蓝牙编码，而是读取播放端点由 `IAudioClient::GetMixFormat` 公布的 PCM 混音格式。

采集使用：

- `AUDCLNT_SHAREMODE_SHARED`；
- `AUDCLNT_STREAMFLAGS_LOOPBACK`；
- 端点的原生共享模式混音格式，不额外重采样。

## 支持的采样格式

格式识别同时支持传统 `WAVEFORMATEX` 和 `WAVEFORMATEXTENSIBLE`。扩展格式依据 `SubFormat` 区分整数 PCM 与 IEEE Float，并读取 `wValidBitsPerSample`。

| 编码 | 容器位深 | 有效位深 |
|------|----------|----------|
| IEEE Float | 32 位 | 32 位 |
| PCM Integer | 16 位 | 1–16 位 |
| PCM Integer | 24 位 | 1–24 位 |
| PCM Integer | 32 位 | 1–32 位 |

有效位深小于容器位深时，按照 `WAVEFORMATEXTENSIBLE` 的左对齐规则转换，例如蓝牙端点可能使用“32 位容器、24 位有效数据”。整数样本会进行符号扩展并归一化到 `[-1, 1]`；浮点样本会限制到该范围，NaN 和无穷值按静音处理。

多声道样本通常按声道平均降混为单声道。若平均信号能量不足最强单声道的 1%，则判定存在严重声道相消，自动改用能量最高的声道。该保护用于处理单声道蓝牙设备暴露双声道端点时可能出现的反相或特殊声道布局，同时保留普通立体声的平均降混行为。

未知子格式、异常位深、零声道、零采样率或无效块对齐会在打开采集流时返回错误。此时前端收到 `audio_status.state = "error"`，不会显示“正在监听”后持续发送伪静音数据。

## 设备状态

| 状态 | 含义 |
|------|------|
| `disabled` | 音频可视化未启用 |
| `capturing` | 正在采集所选设备或系统默认设备 |
| `fallback` | 指定设备不可用，正在采集系统默认设备 |
| `error` | 设备激活、格式解析或 WASAPI 初始化失败 |

成功启动时日志包含实际设备名称、设备 ID、采样率、声道数、编码、容器位深、有效位深和是否发生回退。失败日志与状态原因包含失败阶段及已知格式字段，便于排查驱动差异。

采集运行期间每 5 秒输出一条 `audio loopback capture diagnostics` 聚合日志：

| 字段 | 含义 |
|------|------|
| `polls` | 后端查询采集客户端的次数 |
| `packets` | WASAPI 返回的数据包数量 |
| `silent_packets` | 带 `AUDCLNT_BUFFERFLAGS_SILENT` 标记的数据包数量 |
| `non_silent_packets` | 未带静音标记的数据包数量 |
| `frames` | 收到的音频帧总数 |
| `raw_peak` | 降混前所有声道的最大绝对采样值 |
| `downmix_peak` | 降混后单声道的最大绝对采样值 |
| `cancellation_protections` | 触发声道相消保护的数据包数量 |

`packets = 0` 表示端点没有返回缓冲区；`silent_packets > 0` 且 `non_silent_packets = 0` 表示 Windows 将数据明确标记为静音；`raw_peak > 0` 但普通平均后接近零时，相消保护会触发并使 `cancellation_protections > 0`。

## 蓝牙设备注意事项

- 先在 Windows 中连接蓝牙音箱或耳机，并确保音乐实际输出到该设备，再在 VivoFlow 中选择对应播放端点。
- 设备连接状态或默认输出发生变化后，可重新选择设备或关闭再开启音频可视化以立即重建回环流。
- 播放器应使用 Windows 共享模式。WASAPI Exclusive、ASIO 或其他绕过共享音频引擎的输出通常不能由共享模式回环采集。
- 蓝牙免提通话模式和 A2DP 音乐模式可能暴露不同端点；音频可视化应选择音乐实际使用的播放端点。
