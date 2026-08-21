# hooks — WebSocket 客户端

**文件：** [`web/src/hooks/useVivoflowWs.ts`](../../web/src/hooks/useVivoflowWs.ts)

## 连接

- URL：当前页 `host` + `/ws`（`ws:` / `wss:` 随页面协议）
- 打开后发送 `hello`、`get_config`、`get_snapshot`
- 关闭后指数退避重连（上限约 8s）

## 状态

| 状态 | 含义 |
|------|------|
| `conn` | 连接机状态 |
| `snapshot` | 最新快照 |
| `history` | 客户端环形缓冲（长度跟 `config.history_points`） |
| `config` | 服务端配置回显 |
| `error` | 最近错误文案 |

## 写出

`setRemoteConfig(next)`：在 OPEN 时发送 `{ type: "set_config", config }`，以随后收到的 `config` 为准更新本地。

消息分发：`snapshot` → 更新快照与历史；`config` → 更新配置与历史上限；`error` → 展示错误。
