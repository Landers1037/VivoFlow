# hub — MetricsHub

**文件：** [`crates/vivoflow/src/hub.rs`](../../crates/vivoflow/src/hub.rs)

## 职责

中枢组件，连接「采集」与「对外推送」：

| 成员 | 作用 |
|------|------|
| `config` | 共享配置 |
| `latest` | 最新一份 `Snapshot` |
| `history` | `VecDeque`，长度受 `history_points` 限制 |
| `tx` | `broadcast::Sender<Snapshot>`，容量 64 |

## 公开 API

- `subscribe()`：WS 会话订阅推送
- `latest()` / `history()`：HTTP 与连接瞬间补发
- `spawn_collector(self)`：Tokio 任务循环

## 采集循环伪流程

```text
loop:
  读 config → interval_ms / history_points / enabled
  Collector.collect(enabled)
  写 latest；history 入队并裁剪
  broadcast.send(snapshot)
  sleep(interval_ms)
```

采集失败只打 `warn` 日志，不中断循环。
