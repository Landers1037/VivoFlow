# ui / utils — 基础组件与格式化

## components/ui

路径：[`web/src/components/ui/`](../../web/src/components/ui/)

基于 Radix + CVA + Tailwind 的轻量 shadcn 风格封装：

| 组件 | 用途 |
|------|------|
| `button` | 主题按钮、图标按钮（触控高度 ≥ 44px） |
| `switch` | 设置开关 |
| `label` | 表单标签 |
| `dialog` | 设置面板容器（移动端底部抽屉感） |

## lib/utils.ts

路径：[`web/src/lib/utils.ts`](../../web/src/lib/utils.ts)

| 函数 | 作用 |
|------|------|
| `cn` | `clsx` + `tailwind-merge` |
| `formatBytes` / `formatBps` | 字节与速率 |
| `formatMhz` / `formatPercent` / `formatTemp` | 频率、百分比、温度 |
| `na` | 空值 →「不可用」 |

所有格式化对 `null`/`undefined` 友好，与后端 Optional 字段策略一致。
