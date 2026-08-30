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
  - `illustration_enabled`：像素插画首页模块开关（默认 `false`）
  - `active_music_album_id`：当前启用的音乐专辑 ID，可在关闭模块时保留
  - `clock_enabled`：全屏时钟看板开关（默认 `false`）
  - `clock_style`：`lines` / `dial` / `pixel` / `flip` / `object` / `dots`（默认 `lines`）
  - `clock_timezone_offset_minutes`：时钟使用的固定 UTC 偏移分钟数（默认 `480`，即东八区；仅接受内置的全球常用偏移）
  - `clock_show_week` / `clock_show_date` / `clock_show_seconds`：钟面信息开关（默认 `true`）
  - `clock_dot_shape`：点阵点形状 `circle` / `square` / `rounded` / `star`（默认 `circle`，仅点阵钟面使用）
  - `blackhole_enabled`：全屏黑洞看板开关（默认 `false`）
  - `blackhole_color`：吸积盘 `#RRGGBB`（默认 `#e8c09a`）
  - `blackhole_interactive`：拖拽/缩放手势（默认 `false`）
  - `blackhole_spin_speed`：旋转倍率 `0..=3`（默认 `1`）
  - `model3d_enabled`：全屏 3D 模型看板开关（默认 `false`）
  - `model3d_id`：场景 id，`solar_system` / `tree` / `town` / `flower`（非法回退太阳系）
  - `model3d_orbit_style`：`solid` / `dashed` / `hidden`（默认 `solid`）
  - `model3d_textures_enabled`：是否使用太阳系贴图（默认 `true`）
  - `model3d_tree_canopy_shape`：`round` / `cone` / `layered`（默认 `layered`）
  - `model3d_tree_canopy_color`：树冠 `#RRGGBB`（默认 `#e07a28`）
  - `model3d_tree_base_shape`：`square` / `circle` / `heart`（默认 `square`）
  - `model3d_tree_base_color`：底座 `#RRGGBB`（默认 `#8f98a3`）
  - `model3d_tree_trunk_color`：树干 `#RRGGBB`（默认 `#4a301c`）
  - `model3d_flower_type`：花型，`rose` / `tulip` / `sunflower` / `daisy` / `lily` / `orchid` / `carnation` / `peony` / `lavender` / `hydrangea`（默认 `rose`）
  - `model3d_flower_petal_color`：花瓣 `#RRGGBB`（默认 `#d94a64`）
  - `model3d_flower_foliage_color`：叶茎 `#RRGGBB`（默认 `#3f7d4a`）
  - `model3d_flower_pot_shape`：花盆形状，`round` / `square` / `pedestal`（默认 `round`）
  - `model3d_flower_pot_color`：花盆 `#RRGGBB`（默认 `#b86f47`）
  - `model3d_flower_seed`：8 位十六进制布局种子（默认 `7c4a2f91`）
  - `model3d_flower_generator_version`：花簇生成器版本（默认 `1`）
- `EnabledModules`：`cpu` / `memory` / `gpu` / `disk` / `network`（默认全开）

## 行为

- `Default` 提供开箱即用的默认值。
- `sanitize()` 在 `set_config` 时调用，限制间隔、历史长度和轮播间隔，并校验风格 / 主题色 / 背景色 / 自定义 hex，防止极端配置拖垮系统。
- `clock_enabled`、`music_album_enabled`、`photo_album_enabled`、`illustration_enabled`、`audio_visualizer_enabled`、`blackhole_enabled`、`model3d_enabled` 互斥，最多启用一个首页全屏模块。同时开启时优先保留时钟，其次音乐、音频、相册、插画、黑洞、3D 模型。旧配置缺少字段时使用默认值。
- 媒体根路径不属于 `AppConfig`，单独保存在配置目录的 `storage.json`，通过 `/api/storage` 迁移和更新，避免普通 `set_config` 绕过文件迁移。

配置由 `MetricsHub` 持有，采集循环与 IPC 读写同一把 `RwLock`。
