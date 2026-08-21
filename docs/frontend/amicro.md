# amicro — 加载与图表

**目录：** [`web/src/components/amicro/`](../../web/src/components/amicro/)

视觉对齐 [Amicro Loaders](https://amicro.vercel.app/loaders) 与 [Mono Charts](https://amicro.vercel.app/mono-charts)。Mono Charts 官方 registry 尚未完备，故在项目内实现可传真实数据的精简版。

## loaders.tsx

| 组件 | 用途 |
|------|------|
| `IosSpinner` | 十二段旋转透明度动画（Motion） |
| `PulseDots` | 三点脉冲 |
| `SkeletonLoader` | 卡片骨架 |
| `FullPageLoader` | 首连 / 断线等待全页态 |

## mono-charts.tsx

| 组件 | 用途 |
|------|------|
| `MonoKpiCard` | 标题 + 大数字 + Area spark |
| `MonoSparklineRow` | 行级迷你折线 |
| `MonoGaugeArc` | 240° 弧形占比（Recharts Pie） |
| `MonoAreaTrend` | 区块趋势 Area |

统一 `theme: "dark" | "light"` 单色描边/填充，贴合仪表盘明暗模式。动画默认关闭（`isAnimationActive={false}`），降低移动端开销。
