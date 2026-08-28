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
  - `clock_enabled`：全屏时钟看板开关（默认 `false`）
  - `clock_style`：`lines` / `dial` / `pixel` / `flip` / `object` / `dots`（默认 `lines`）
  - `clock_show_week` / `clock_show_date` / `clock_show_seconds`：钟面信息开关（默认 `true`）
  - `clock_dot_shape`：点阵点形状 `circle` / `square` / `rounded` / `star`（默认 `circle`，仅点阵钟面使用）
  - `blackhole_enabled`：全屏黑洞看板开关（默认 `false`）
  - `blackhole_color`：吸积盘 `#RRGGBB`（默认 `#e8c09a`）
  - `blackhole_interactive`：拖拽/缩放手势（默认 `false`）
  - `blackhole_spin_speed`：旋转倍率 `0..=3`（默认 `1`）
  - `model3d_enabled`：全屏 3D 模型看板开关（默认 `false`）
  - `model3d_id`：场景 id，`solar_system` / `tree`（非法回退太阳系）
  - `model3d_orbit_style`：`solid` / `dashed` / `hidden`（默认 `solid`）
  - `model3d_textures_enabled`：是否使用太阳系贴图（默认 `true`）
  - `model3d_tree_canopy_shape`：`round` / `cone` / `layered`（默认 `layered`）
  - `model3d_tree_canopy_color`：树冠 `#RRGGBB`（默认 `#e07a28`）
  - `model3d_tree_base_shape`：`square` / `circle` / `heart`（默认 `square`）
  - `model3d_tree_base_color`：底座 `#RRGGBB`（默认 `#8f98a3`）
  - `model3d_tree_trunk_color`：树干 `#RRGGBB`（默认 `#4a301c`）
- `EnabledModules`：`cpu` / `memory` / `gpu` / `disk` / `network`（默认全开）

## 行为

- `Default` 提供开箱即用的默认值。
- `sanitize()` 在 `set_config` 时调用，限制间隔、历史长度和轮播间隔，并校验风格 / 主题色 / 背景色 / 自定义 hex，防止极端配置拖垮系统。
- `clock_enabled`、`music_album_enabled`、`photo_album_enabled`、`audio_visualizer_enabled`、`blackhole_enabled`、`model3d_enabled` 互斥，最多启用一个首页全屏模块。同时开启时优先保留时钟，其次音乐，再次音频，再次相册，再次黑洞，最后 3D 模型。旧配置缺少字段时使用默认值。

配置由 `MetricsHub` 持有，采集循环与 IPC 读写同一把 `RwLock`。
