# JSON IPC 协议

主通道：`ws://<host>:8787/ws`（HTTPS 页面则用 `wss:`）。  
所有消息为 JSON 对象，必含字符串字段 `type`。

## 客户端 → 服务端

| type | 载荷 | 行为 |
|------|------|------|
| `hello` | 可选任意附加字段 | 握手，服务端无特殊响应 |
| `get_snapshot` | 无 | 立即回一条当前 `snapshot`（若已有） |
| `get_config` | 无 | 回 `config` |
| `set_config` | `config: AppConfig` | 校验、持久化、广播，并回 `config` |
| `set_audio_subscription` | `enabled: boolean` | 为当前连接订阅或取消高频音频帧 |

### AppConfig

采集 + 外观均由服务端保存（默认 `%LOCALAPPDATA%/VivoFlow/config.json`，可用 `VIVOFLOW_CONFIG` 覆盖）：

```json
{
  "interval_ms": 1000,
  "enabled": {
    "cpu": true,
    "memory": true,
    "gpu": true,
    "disk": true,
    "network": true
  },
  "history_points": 60,
  "ui_style": "amicro",
  "accent": "teal",
  "accent_custom": "#0d9488",
  "theme": "system",
  "language": "zh",
  "hide_title_bar": false,
  "mobile_card_mode": false,
  "mobile_auto_carousel": true,
  "mobile_carousel_interval_s": 10,
  "audio_visualizer_enabled": false,
  "audio_device_id": null,
  "audio_visualizer_mode": "particles",
  "audio_color_mode": "gradient",
  "audio_color_primary": "#22d3ee",
  "audio_color_secondary": "#a855f7",
  "audio_amplitude": 1.0,
  "audio_smoothing": 0.65
}
```

| 字段 | 合法值 |
|------|--------|
| `interval_ms` | `[200, 60000]` |
| `history_points` | `[10, 300]` |
| `ui_style` | `amicro` / `neumorph` / `line` / `glass` / `console` / `paper` / `instrument` / `dense` / `clay` / `metal` / `ink` / `swiss` / `hud` / `editorial` |
| `accent` | `teal` / `zinc` / `blue` / `violet` / `amber` / `custom` |
| `accent_custom` | `#RRGGBB`（`accent` 为 `custom` 时使用；非法则回退 `#0d9488`） |
| `theme` | `light` / `dark` / `system` |
| `language` | `zh` / `en` |
| `hide_title_bar` | `true` / `false`；仅隐藏仪表盘标题栏 |
| `mobile_card_mode` | `true` / `false`；手机启用 2x 分页卡片 |
| `mobile_auto_carousel` | `true` / `false`；仅移动卡片模式生效 |
| `mobile_carousel_interval_s` | `[5, 60]`，默认 `10` |
| `audio_visualizer_mode` | `particles` / `grid` / `aurora` / `radial` |
| `audio_color_mode` | `single` / `gradient` |
| `audio_amplitude` | `[0.5, 2.0]` |
| `audio_smoothing` | `[0, 0.9]` |

配置变更会广播给所有已连接的 WebSocket 客户端，前端以服务端回传为准同步 UI。

## 服务端 → 客户端

| type | 说明 |
|------|------|
| `snapshot` | 完整指标快照 |
| `config` | `{ "type":"config", "config": AppConfig }` |
| `error` | `{ "type":"error", "message": "..." }` |
| `audio_frame` | 64 个归一化频段及 `rms`、`peak`、`beat`；仅向已订阅连接推送 |
| `audio_status` | 捕获状态、所选与实际设备 ID、回退或错误原因 |

### 连接建立时

1. 当前 `config`
2. 若存在，最新 `snapshot`

## HTTP 辅助接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/snapshot` | 最新快照 |
| GET | `/api/history` | 历史快照 |
| GET | `/api/config` | 当前完整配置 |
| GET | `/api/audio/devices` | Windows 输出设备列表 |
| GET | `/*` | 内嵌前端 |

环境变量：`VIVOFLOW_ADDR`（默认 `0.0.0.0:8787`）、`VIVOFLOW_CONFIG`（配置文件路径）。
