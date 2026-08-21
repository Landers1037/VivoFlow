# dashboard — 仪表盘

**文件：** [`web/src/components/Dashboard.tsx`](../../web/src/components/Dashboard.tsx)

## 布局

- 默认：**单列** 分节（CPU / 内存 / 显卡 / 磁盘 / 网络）
- `landscape:` / `lg:`：**双列** 紧凑网格，减少竖向滚动

无 `snapshot` 时显示骨架 `SkeletonLoader`。

## 各节内容

| 分区 | 展示 |
|------|------|
| CPU | Gauge 占用、KPI 频率/型号、Rounded Bullet 负载（5s/5m/15m）、Sparkline 趋势、CPU 温度 |
| 内存 | Gauge、容量 KPI、型号/频率/内存温度 |
| 温度 | 两个 Rounded Scatter：CPU / 内存温度（后端 `temp_history`，约 1 分钟一点） |
| 显卡 | Gauge、显存 KPI、型号/温度/时钟明细 |
| 磁盘 | Rounded Treemap 分区容量占比 + 最多 4 条读写明细 |
| 网络 | Area 下行合计趋势 + 网卡卡片（上下行） |

历史序列由 `history` 投影（如 `cpu.usage_percent`）；`null` 经 `format*` / `na` 显示为「不可用」。

主题传入图表：`resolvedTheme === "light" ? "light" : "dark"`。表面与图表气质跟随 `ui_style`（见 [viz.md](./viz.md)）。
