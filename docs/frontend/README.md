# 前端模块

源码根目录：[`web/src/`](../web/src/)

| 模块文档 | 源码 | 职责 |
|----------|------|------|
| [app.md](./app.md) | `main.tsx`, `App.tsx` | 入口、主题、顶栏与页面组装 |
| [types.md](./types.md) | `types.ts` | 与后端对齐的 TypeScript 类型 |
| [hooks.md](./hooks.md) | `hooks/useVivoflowWs.ts` | WebSocket 连接、重连、状态 |
| [dashboard.md](./dashboard.md) | `components/Dashboard.tsx` | 指标分区展示 |
| [settings.md](./settings.md) | `components/SettingsPanel.tsx` | 采集参数 UI |
| [amicro.md](./amicro.md) | `components/amicro/*` | 加载动画与 mono 图表 |
| [ui-utils.md](./ui-utils.md) | `components/ui/*`, `lib/utils.ts` | shadcn 风格组件与格式化 |

开发服务器见 [`web/vite.config.ts`](../web/vite.config.ts)：`/ws`、`/api` 代理到 `127.0.0.1:8787`。
