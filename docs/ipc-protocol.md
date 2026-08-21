# JSON IPC 协议

主通道：`ws://<host>:8787/ws`（HTTPS 页面则用 `wss:`）。  
所有消息为 JSON 对象，必含字符串字段 `type`。

## 客户端 → 服务端

| type | 载荷 | 行为 |
|------|------|------|
| `hello` | 可选任意附加字段 | 握手，服务端无特殊响应 |
| `get_snapshot` | 无 | 立即回一条当前 `snapshot`（若已有） |
| `get_config` | 无 | 回 `config` |
| `set_config` | `config: AppConfig` | 校验并写入配置，回 `config` |

### AppConfig

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
  "history_points": 60
}
```

服务端 `sanitize`：

- `interval_ms` ∈ `[200, 60000]`
- `history_points` ∈ `[10, 300]`

## 服务端 → 客户端

| type | 说明 |
|------|------|
| `snapshot` | 完整指标快照（见下文字段） |
| `config` | `{ "type":"config", "config": AppConfig }` |
| `error` | `{ "type":"error", "message": "..." }` |

### 连接建立时

服务端主动发送：

1. 当前 `config`
2. 若存在，最新 `snapshot`

之后按采集周期通过 `broadcast` 推送新 `snapshot`。

### snapshot 主要字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `ts` | number | Unix 毫秒时间戳 |
| `cpu` | object \| 省略 | 模块关闭时不出现 |
| `memory` | object \| 省略 | 同上 |
| `gpu` | array \| 省略 | 同上 |
| `disks` | array \| 省略 | 同上 |
| `network` | array \| 省略 | 同上 |

可选数值字段在不可用时为 JSON `null`（例如 `temperature_c`、`usage_percent`、`memory_clock_mhz`）。

## HTTP 辅助接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | `{ "ok": true, "service": "vivoflow" }` |
| GET | `/api/snapshot` | 最新快照；尚无数据时 503 |
| GET | `/api/history` | `{ "type":"history", "items": [...] }` |
| GET | `/api/config` | 当前配置 |
| GET | `/*` | 内嵌前端静态资源（SPA fallback） |

环境变量 `VIVOFLOW_ADDR` 默认 `0.0.0.0:8787`。
