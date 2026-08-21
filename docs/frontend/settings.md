# settings — 设置页

**文件：** [`web/src/components/SettingsPage.tsx`](../../web/src/components/SettingsPage.tsx)

点击仪表盘设置按钮进入**全页设置**，左上角返回。

## 数据源

所有可配置项（外观 + 采集）均存储在 **Rust 后端**，经 WebSocket `config` / `set_config` 同步。前端不把外观偏好写入 `localStorage`。

- 连接后收到 `config` → 应用主题色、明暗、语言、采集参数
- 外观项变更立即 `set_config` 整份配置
- 采集项在「应用到后端」时 `set_config`（合并当前外观字段）

持久化路径见 [ipc-protocol.md](../ipc-protocol.md)。

## 布局

左侧垂直 Tab：`外观` / `采集` / `关于`。

## 关于

项目简介、技术栈、版本号（`APP_VERSION`）、Apache-2.0（只读，不入配置文件）。
