# config — 采集配置

**文件：** [`crates/vivoflow/src/config.rs`](../../crates/vivoflow/src/config.rs)

## 结构

- `AppConfig`
  - `interval_ms`：采集与推送间隔（默认 `1000`）
  - `enabled: EnabledModules`：分模块开关
  - `history_points`：服务端保留的历史快照上限（默认 `60`）
  - `ui_style`：14 种界面风格（非法回退 `amicro`）
  - `accent` / `accent_custom`：主题色预设或 `#RRGGBB` 自定义色
  - `background_color`：页面背景基色，默认 `#0b1a20`，按明暗主题混合显示
  - `theme` / `language`
  - `hide_title_bar`：隐藏仪表盘标题栏（默认 `false`）
  - `mobile_card_mode`：手机分页卡片模式（默认 `false`）
  - `mobile_auto_carousel`：移动卡片自动轮播（默认 `true`，仅移动模式生效）
  - `mobile_carousel_interval_s`：轮播间隔秒数（默认 `10`，限制 `5..=60`）
  - `music_album_enabled`：音乐专辑首页模块开关（默认 `false`）
  - `active_music_album_id`：当前启用的音乐专辑 ID，可在关闭模块时保留
- `EnabledModules`：`cpu` / `memory` / `gpu` / `disk` / `network`（默认全开）

## 行为

- `Default` 提供开箱即用的默认值。
- `sanitize()` 在 `set_config` 时调用，限制间隔、历史长度和轮播间隔，并校验风格 / 主题色 / 背景色 / 自定义 hex，防止极端配置拖垮系统。
- `music_album_enabled` 与 `photo_album_enabled`、`audio_visualizer_enabled` 互斥，最多启用一个首页媒体模块；开启音乐专辑会关闭另外两个模块。旧配置缺少音乐字段时使用默认值。

配置由 `MetricsHub` 持有，采集循环与 IPC 读写同一把 `RwLock`。
