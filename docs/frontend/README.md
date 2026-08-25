# 前端模块

源码根目录：[`web/src/`](../web/src/)

| 模块文档 | 源码 | 职责 |
|----------|------|------|
| [app.md](./app.md) | `main.tsx`, `App.tsx` | 入口、主题、顶栏与页面组装 |
| [types.md](./types.md) | `types.ts` | 与后端对齐的 TypeScript 类型 |
| [hooks.md](./hooks.md) | `hooks/useVivoflowWs.ts` | WebSocket 连接、重连、状态 |
| [dashboard.md](./dashboard.md) | `components/Dashboard.tsx`, `hooks/useDashboardOrder.ts` | 指标分区展示、长按拖拽排序与本地持久化 |
| [settings.md](./settings.md) | `components/SettingsPage.tsx` | 全页设置（外观 / 采集 / 相册 / 音频可视化 / 关于） |
| [i18n.md](./i18n.md) | `i18n/*`, `useAppearance` | 中英文文案与切换 |
| [viz.md](./viz.md) | `components/viz/*` | 多风格加载动画与图表 |
| [amicro.md](./amicro.md) | `components/amicro/*` | 兼容 re-export（请改用 viz） |
| [ui-utils.md](./ui-utils.md) | `components/ui/*`, `lib/utils.ts` | shadcn 风格组件与格式化 |

开发服务器见 [`web/vite.config.ts`](../web/vite.config.ts)：`/ws`、`/api` 代理到 `127.0.0.1:8787`。
