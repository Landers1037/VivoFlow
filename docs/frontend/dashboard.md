# dashboard — 仪表盘

**文件：** [`web/src/components/Dashboard.tsx`](../../web/src/components/Dashboard.tsx)

## 布局

- 默认：**单列** 分节（CPU / 内存 / 显卡 / 磁盘 / 网络）
- `landscape:` / `lg:`：**双列** 紧凑网格，减少竖向滚动

无 `snapshot` 时显示骨架 `SkeletonLoader`。

## 各节内容

| 分区 | 展示 |
|------|------|
| CPU | Gauge 占用、KPI 频率/型号、Sparkline 趋势 |
| 内存 | Gauge、容量 KPI、型号/频率/温度明细行 |
| 显卡 | Gauge、显存 KPI、型号/温度/时钟明细 |
| 磁盘 | 最多 4 块：名称、型号、容量、读写 bps |
| 网络 | Area 下行合计趋势 + 网卡卡片（上下行） |

历史序列由 `history` 投影（如 `cpu.usage_percent`）；`null` 经 `format*` / `na` 显示为「不可用」。

主题传入 Amicro 图表：`resolvedTheme === "light" ? "light" : "dark"`。
