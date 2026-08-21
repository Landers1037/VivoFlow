# app — 应用入口与壳层

**文件：**

- [`web/src/main.tsx`](../../web/src/main.tsx)
- [`web/src/App.tsx`](../../web/src/App.tsx)
- [`web/src/index.css`](../../web/src/index.css)

## main.tsx

- `createRoot` 挂载 React

## App.tsx

页面壳：

1. `ThemeProvider` + `AppearanceProvider`（配置来自 WS）
2. 调用 `useVivoflowWs` 获取连接态、快照、历史、配置、错误与 `setRemoteConfig`
3. 顶栏：品牌名、连接状态、采集间隔、设置入口
4. 未连上且无快照时显示 `FullPageLoader`
5. 否则渲染 `Dashboard`
6. 错误条展示服务端 / 解析错误

## 布局与主题

- `safe-pad`：`env(safe-area-inset-*)`，适配刘海屏
- CSS 变量定义明/暗色板（`index.css` + Tailwind `@theme`）
- 本地字体：[`web/src/fonts/`](../../web/src/fonts/) — `Outfit`（拉丁字母/数字，`unicode-range`）+ `Noto Sans SC`（中文）
- `html[data-ui-style]` 驱动界面风格 token（`.vf-shell` / `.vf-surface` / `.vf-panel`）
- `AppearanceProvider` 同步 `accent` / `accent_custom`、`theme`、`ui_style`、`language`
- 壳层背景由 `--shell-bg` 决定（随风格变化）

## 视口

[`web/index.html`](../../web/index.html) 设置 `viewport-fit=cover`、`apple-mobile-web-app-capable`，优先 iPhone 类设备。
