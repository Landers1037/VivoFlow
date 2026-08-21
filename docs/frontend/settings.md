# settings — 采集设置面板

**文件：** [`web/src/components/SettingsPanel.tsx`](../../web/src/components/SettingsPanel.tsx)

## UI

- 触发：顶栏齿轮按钮（`Dialog` + 底部 Sheet 风格，横屏居中）
- 控件：
  - 采集间隔滑条 `200–5000` ms
  - 历史点数滑条 `10–180`
  - 五个模块 `Switch`
- 「应用到后端」调用父组件传入的 `onSave` → `setRemoteConfig`

打开对话框时用当前服务端 `config` 重置本地草稿，避免脏状态覆盖。
