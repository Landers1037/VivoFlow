# config — 采集配置

**文件：** [`crates/vivoflow/src/config.rs`](../../crates/vivoflow/src/config.rs)

## 结构

- `AppConfig`
  - `interval_ms`：采集与推送间隔（默认 `1000`）
  - `enabled: EnabledModules`：分模块开关
  - `history_points`：服务端保留的历史快照上限（默认 `60`）
  - `ui_style`：14 种界面风格（非法回退 `amicro`）
  - `accent` / `accent_custom`：主题色预设或 `#RRGGBB` 自定义色
  - `theme` / `language`
- `EnabledModules`：`cpu` / `memory` / `gpu` / `disk` / `network`（默认全开）

## 行为

- `Default` 提供开箱即用的默认值。
- `sanitize()` 在 `set_config` 时调用，限制间隔与历史长度，并校验风格 / 主题色 / 自定义 hex，防止极端配置拖垮系统。

配置由 `MetricsHub` 持有，采集循环与 IPC 读写同一把 `RwLock`。
