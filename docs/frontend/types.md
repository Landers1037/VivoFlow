# types — 类型定义

**文件：** [`web/src/types.ts`](../../web/src/types.ts)

与后端 `models` / `config` 一一对应，供 hook 与组件共用：

- `AppConfig` / `EnabledModules`
- `Snapshot` 及 `CpuMetrics`、`MemoryMetrics`、`GpuMetrics`、`DiskMetrics`、`NetworkMetrics`
- `ConnState`：`"connecting" | "connected" | "disconnected"`

字段可空性与 JSON `null` 对齐，避免 UI 对缺失硬件字段崩溃。
