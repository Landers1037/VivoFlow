# types — 类型定义

**文件：** [`web/src/types.ts`](../../web/src/types.ts)

与后端 `models` / `config` 一一对应，供 hook 与组件共用：

- `AppConfig` / `EnabledModules`
- `UiStyle`：14 种（`UI_STYLES`）— 含 amicro / neumorph / line / glass / console 与 paper / instrument / dense / clay / metal / ink / swiss / hud / editorial
- `AccentId`：`teal` | `zinc` | `blue` | `violet` | `amber` | `custom`
- `accent_custom`：`#RRGGBB`（自定义主题色）
- `background_color`：页面背景基色
- `glass_gradient_start` / `glass_gradient_end`：毛玻璃背景渐变两端色（`#RRGGBB`）
- `ThemeMode` / `Lang`
- `hide_title_bar`、`system_dashboard_enabled`、`mobile_card_mode`、`mobile_auto_carousel`、`mobile_carousel_interval_s`
- `clock_enabled`、`clock_style`（`lines` / `dial` / `pixel` / `flip` / `object` / `dots`）、`clock_timezone_offset_minutes`（固定 UTC 偏移分钟数，默认 `480`，即东八区）、`clock_show_week` / `clock_show_date` / `clock_show_seconds`、`clock_dot_shape`（`circle` / `square` / `rounded` / `star`）
- `illustration_enabled`：全屏像素插画轮播开关；`IllustrationImage`（含用于缓存失效的 `version`）、`PixelArtSettings`、`IllustrationsResponse` 和 `StorageStatus` 描述插画与存储 API 数据。
- `blackhole_enabled`：全屏黑洞看板
- `blackhole_color` / `blackhole_interactive` / `blackhole_spin_speed`
- `model3d_enabled`：全屏 3D 模型看板
- `model3d_id`：`solar_system` / `tree` / `town` / `flower`
- 花场景配置：`model3d_flower_type`、`model3d_flower_petal_color`、`model3d_flower_foliage_color`、`model3d_flower_pot_shape`、`model3d_flower_pot_color`、`model3d_flower_seed`、`model3d_flower_generator_version`；花型共 10 种，布局由 8 位种子确定。
- `model3d_orbit_style`：`solid` / `dashed` / `hidden`
- `model3d_textures_enabled`：是否加载太阳系贴图
- `model3d_tree_canopy_shape`：`round` / `cone` / `layered`
- `model3d_tree_canopy_color` / `model3d_tree_base_color` / `model3d_tree_trunk_color`
- `model3d_tree_base_shape`：`square` / `circle` / `heart`
- `Snapshot` 及 `SystemMetrics`、`CpuMetrics`、`MemoryMetrics`、`GpuMetrics`、`DiskMetrics`、`NetworkMetrics`
- `ConnState`：`"connecting" | "connected" | "disconnected"`

字段可空性与 JSON `null` 对齐，避免 UI 对缺失硬件字段崩溃。
