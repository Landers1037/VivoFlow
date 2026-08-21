# app — 应用入口与壳层

**文件：**

- [`web/src/main.tsx`](../../web/src/main.tsx)
- [`web/src/App.tsx`](../../web/src/App.tsx)
- [`web/src/index.css`](../../web/src/index.css)

## main.tsx

- `createRoot` 挂载 React
- `ThemeProvider`（`next-themes`，`attribute="class"`，支持 system）

## App.tsx

页面壳：

1. 调用 `useVivoflowWs` 获取连接态、快照、历史、配置、错误与 `setRemoteConfig`
2. 顶栏：品牌名、连接状态、采集间隔、主题切换、设置入口
3. 未连上且无快照时显示 `FullPageLoader`
4. 否则渲染 `Dashboard`
5. 错误条展示服务端 / 解析错误

## 布局与主题

- `safe-pad`：`env(safe-area-inset-*)`，适配刘海屏
- CSS 变量定义明/暗色板（`index.css` + Tailwind `@theme`）
- 背景使用轻微径向渐变，避免纯平底板

## 视口

[`web/index.html`](../../web/index.html) 设置 `viewport-fit=cover`、`apple-mobile-web-app-capable`，优先 iPhone 类设备。
