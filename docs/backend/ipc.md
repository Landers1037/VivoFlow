# ipc — WebSocket 处理

**文件：** [`crates/vivoflow/src/ipc.rs`](../../crates/vivoflow/src/ipc.rs)

完整报文约定见 [../ipc-protocol.md](../ipc-protocol.md)。

## 会话生命周期

`handle_socket(socket, hub)`：

1. 拆分收发两端。
2. `hub.subscribe()` 订阅广播。
3. 发送当前 `config` 与（若有）`latest` snapshot。
4. `tokio::select!` 并行处理：
   - 客户端文本 / Ping / Close
   - 广播 `RecvError::Lagged` 时跳过落后消息，保持实时性

## 文本命令

`handle_text` 解析 `ClientMessage { type, config? }`：

- `hello`：空操作成功
- `get_snapshot` / `get_config`：即时应答
- `set_config`：缺字段报错；否则 `sanitize` 后写回并应答 `config`
- 未知 `type` → `error`

发送失败（对端断开）会结束循环，自然清理会话。
