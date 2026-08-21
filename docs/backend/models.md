# models — 数据模型

**文件：** [`crates/vivoflow/src/models.rs`](../../crates/vivoflow/src/models.rs)

统一 `serde` 序列化为前端可消费的 JSON。`Snapshot.msg_type` 固定为 `"snapshot"`。

## Snapshot

| 字段 | 说明 |
|------|------|
| `ts` | 毫秒时间戳 |
| `cpu` / `memory` / `gpu` / `disks` / `network` | `Option`；模块关闭时 `skip_serializing` |

## 分项指标

| 类型 | 关键字段 |
|------|----------|
| `CpuMetrics` | `cores`, `model`, `base_mhz`, `current_mhz`, `usage_percent` |
| `MemoryMetrics` | `total_bytes`, `used_bytes`, `usage_percent`, `modules[]`, `temperature_c` |
| `MemoryModule` | `part_number`, `manufacturer`, `speed_mhz`, `capacity_bytes` |
| `GpuMetrics` | `name`, `vram_*`, `usage_percent`, `temperature_c`, `*_clock_mhz` |
| `DiskMetrics` | `name`, `model`, `kind`, `total_bytes`, `used_bytes`, `read_bps`, `write_bps` |
| `NetworkMetrics` | `name`, `model`, `mac`, `rx_bps`, `tx_bps` |

约定：硬件拿不到的标量用 `Option` → JSON `null`；字符串清洗掉 WMI 的 `"NULL"` 等伪值。
