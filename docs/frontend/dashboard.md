# dashboard — 仪表盘

**文件：**

- [`web/src/components/Dashboard.tsx`](../../web/src/components/Dashboard.tsx)
- [`web/src/hooks/useDashboardOrder.ts`](../../web/src/hooks/useDashboardOrder.ts)

## 布局

- 默认：**单列** 分节（CPU / 内存 / 温度 / 显卡 / 磁盘 / 网络）
- `landscape:` / `lg:`：**双列** 紧凑网格，减少竖向滚动
- 分区内组件为 **双列网格**；半宽占 1 列，全宽 `col-span-2`
- **iOS 式固定高度**：`1x` = `--vf-widget-1x`（11.5rem），`2x` = `2 × 1x + gap`；半宽与全宽卡片同高或成倍，避免参差

| 高度 | 典型组件 |
|------|----------|
| 1x | Gauge、KPI、明细、Bullet、Sparkline 与 CPU 温度（半宽并排）、网卡列表 |
| 2x | Area 趋势、Scatter、Treemap、磁盘列表 |

无 `snapshot` 时显示骨架 `SkeletonLoader`。

## 移动端卡片分页

开启 `mobile_card_mode` 且设备为粗指针手机（视口短边 ≤ 640 CSS px）时，分区内按既有卡片排序分页。每页是 `2列 × 2行` 的 `2x` 高度容量：`1x` 卡占一行，`2x` 卡占两行，半宽卡可并排，全宽卡占两列；同一分区可拆成多页，不混合不同分区。右侧竖向分页条可点击跳转，内容区左右滑动切换页面。

分页模式下禁用长按拖拽；原有排序仍保存在 `vivoflow.dashboard.layout`，退出模式后恢复。自动轮播循环切页，手动切页后重置间隔，页面隐藏时暂停。

## 拖拽排序（嵌套）

库：`@dnd-kit`（外层分区 + 内层组件，各自独立 `DndContext`）。

| 目标 | 如何触发 | 视觉反馈 |
|------|----------|----------|
| 分区（功能模块） | **长按分区标题**（标题旁握把图标） | 无描边边框；标题握把高亮，分区略透明 |
| 组件（卡片） | **长按组件本体** | 无描边边框；右上角显示握把图标 |

- 长按约 **320ms**（`PointerSensor` delay + tolerance）
- 分区顺序与各分区内组件顺序一并持久化到 `localStorage` 键 `vivoflow.dashboard.layout`
- 兼容旧键 `vivoflow.dashboard.sectionOrder`（数组），首次读取时迁移
- 缺省 id 会按默认顺序补全

默认分区顺序：`cpu` → `memory` → `temp` → `gpu` → `disk` → `network`

默认组件 id：

| 分区 | 组件 |
|------|------|
| cpu | `gauge`, `kpi`, `load`, `spark`, `temp` |
| memory | `gauge`, `kpi`, `info` |
| temp | `cpuScatter`, `memScatter` |
| gpu | `gauge`, `kpi`, `info` |
| disk | `treemap`, `list` |
| network | `area`, `nics` |

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
