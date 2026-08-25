# viz — 加载与图表（多风格）

**目录：** [`web/src/components/viz/`](../../web/src/components/viz/)

共享图表与加载组件，视觉由根节点 `data-ui-style` + CSS token（[`index.css`](../../web/src/index.css)）驱动。Amicro 软卡片为默认；新拟态 / 极简线条 / 毛玻璃 / 终端仪表共用同一数据管道。

兼容 re-export：[`web/src/components/amicro/`](../../web/src/components/amicro/)（请改用 `@/components/viz`）。

## loaders.tsx

| 组件 | 用途 |
|------|------|
| `IosSpinner` | 十二段旋转透明度动画（Motion） |
| `PulseDots` | 三点脉冲 |
| `SkeletonLoader` | 卡片骨架 |
| `FullPageLoader` | 首连 / 断线等待全页态（外包 `.vf-surface`） |

## charts.tsx

| 组件 | 用途 |
|------|------|
| `KpiCard` | 标题 + 大数字 + Area spark |
| `SparklineRow` | 行级迷你折线 |
| `GaugeArc` | 240° 弧形占比（Recharts Pie） |
| `AreaTrend` | 区块趋势 Area |
| `RoundedBullet` | Amicro Performance Bullet：圆角弹道条 + 目标刻度（5s / 5m / 15m 负载） |
| `RoundedScatter` | Amicro Scatter Matrix：圆点散点（CPU / 内存温度随时间） |
| `RoundedTreemap` | Amicro Tile Treemap：圆角灰黑瓦片，占比越大越浅 |

按 `ui_style` 微调：曲线类型（monotone / linear / step）、描边色（主题色或 mono）、填充透明度、圆角。`theme: "dark" | "light"` 仍用于 mono 对比色。动画默认关闭（`isAnimationActive={false}`）。

高度：组件接受可选 `tile?: 1 | 2`，对应 CSS `.vf-widget-1x` / `.vf-widget-2x`（见 [`index.css`](../../web/src/index.css)）。图表区用 `.vf-widget-body` 弹性填满，避免内容撑破网格。

## 音频渲染器

[`web/src/components/audio/`](../../web/src/components/audio/) 的 `AudioRenderer` 统一接收 64 段频谱、RMS、峰值和节拍数据，并分派到 2D `AudioCanvas` 或延迟加载的 `ThreeAudioCanvas`。2D 提供粒子、方阵、极光与环形模式；Three.js 提供频谱都市、粒子星云、声波地形与晶体核心。

3D 首页使用 WebGLRenderer、OrbitControls 与 EffectComposer（ACES tone mapping、Bloom、OutputPass），DPR 上限为 1.5。设置页仅创建一个共享预览 WebGL 上下文，DPR 为 1、最高 24 FPS并关闭后处理。页面隐藏、离开视口或卸载时会暂停或释放渲染资源；WebGL 2 不可用及上下文丢失会回退到 2D 环形模式。

所有几何体、粒子与 Shader 均为程序化生成，不加载模型或贴图。`prefers-reduced-motion` 下停止自动运镜、持续旋转和粒子爆发，仅保留低幅度音频形变。
