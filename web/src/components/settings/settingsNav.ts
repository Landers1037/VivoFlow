import type { LucideIcon } from "lucide-react";
import {
  Atom,
  AudioLines,
  Bot,
  Clock,
  Frame,
  Globe,
  HardDrive,
  Images,
  Info,
  MonitorCog,
  Music2,
  Orbit,
  Palette,
  Radio,
  Sparkles,
} from "lucide-react";
import { UI_STYLE_OPTIONS, type TFunction } from "@/hooks/useAppearance";
import type { MessageKey } from "@/i18n/messages";
import { APP_VERSION } from "@/lib/version";
import type { AppConfig } from "@/types";

export type SettingsPane =
  | "index"
  | "appearance"
  | "agent"
  | "clock"
  | "blackhole"
  | "models3d"
  | "models2d"
  | "system"
  | "collection"
  | "storage"
  | "albums"
  | "music"
  | "illustration"
  | "particles"
  | "audio"
  | "about";

export type SettingsNavPane = Exclude<SettingsPane, "index">;

export type SettingsNavItem = {
  pane: SettingsNavPane;
  icon: LucideIcon;
  labelKey: MessageKey;
  enabled?: (config: AppConfig) => boolean;
  value?: (config: AppConfig, t: TFunction) => string;
};

export type SettingsNavGroup = {
  id: string;
  labelKey: MessageKey | null;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    id: "display",
    labelKey: "settingsGroupDisplay",
    items: [
      { pane: "agent", icon: Bot, labelKey: "agent", enabled: (config) => config.agent_enabled },
      {
        pane: "appearance",
        icon: Palette,
        labelKey: "appearance",
        value: (config, t) =>
          t(UI_STYLE_OPTIONS.find((option) => option.id === config.ui_style)?.nameKey ?? "styleAmicro"),
      },
      { pane: "clock", icon: Clock, labelKey: "clock", enabled: (config) => config.clock_enabled },
      { pane: "blackhole", icon: Orbit, labelKey: "blackhole", enabled: (config) => config.blackhole_enabled },
      { pane: "models3d", icon: Globe, labelKey: "models3d", enabled: (config) => config.model3d_enabled },
      { pane: "models2d", icon: Frame, labelKey: "models2d", enabled: (config) => config.model2d_enabled },
    ],
  },
  {
    id: "data",
    labelKey: "settingsGroupData",
    items: [
      {
        pane: "system",
        icon: MonitorCog,
        labelKey: "systemDashboard",
        enabled: (config) => config.system_dashboard_enabled,
      },
      { pane: "collection", icon: Radio, labelKey: "collection" },
      { pane: "storage", icon: HardDrive, labelKey: "storage" },
    ],
  },
  {
    id: "media",
    labelKey: "settingsGroupMedia",
    items: [
      { pane: "albums", icon: Images, labelKey: "albums", enabled: (config) => config.photo_album_enabled },
      { pane: "music", icon: Music2, labelKey: "musicAlbums", enabled: (config) => config.music_album_enabled },
      {
        pane: "illustration",
        icon: Sparkles,
        labelKey: "illustration",
        enabled: (config) => config.illustration_enabled,
      },
      { pane: "particles", icon: Atom, labelKey: "particle", enabled: (config) => config.particle_enabled },
      {
        pane: "audio",
        icon: AudioLines,
        labelKey: "audioVisualizer",
        enabled: (config) => config.audio_visualizer_enabled,
      },
    ],
  },
  {
    id: "other",
    labelKey: null,
    items: [{ pane: "about", icon: Info, labelKey: "about", value: () => APP_VERSION }],
  },
];

export const SETTINGS_NAV_ITEMS = SETTINGS_NAV.flatMap((group) => group.items);

export const SETTINGS_DEFAULT_PANE: SettingsNavPane = SETTINGS_NAV_ITEMS[0]?.pane ?? "agent";

export function settingsNavValue(
  item: SettingsNavItem,
  config: AppConfig,
  t: TFunction,
): string | undefined {
  if (item.value) return item.value(config, t);
  if (item.enabled) return item.enabled(config) ? t("settingsOn") : t("settingsOff");
  return undefined;
}

export function settingsPaneLabel(pane: SettingsPane, t: TFunction): string {
  const item = SETTINGS_NAV_ITEMS.find((entry) => entry.pane === pane);
  return t(item?.labelKey ?? "settings");
}
