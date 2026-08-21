import type { Lang } from "@/i18n/types";

export type MessageKey = keyof typeof ZH;

const ZH = {
  settings: "设置",
  back: "返回",
  appearance: "外观",
  collection: "采集",
  about: "关于",
  uiStyle: "界面风格",
  uiStyleHint: "当前为 Amicro 风格组件与图表",
  accent: "主题色",
  themeMode: "明亮 / 暗黑",
  themeLight: "明亮",
  themeDark: "暗黑",
  themeSystem: "跟随系统",
  language: "语言",
  langZh: "中文",
  langEn: "English",
  interval: "采集间隔（ms）",
  history: "历史点数",
  modules: "采集模块",
  apply: "应用到后端",
  applied: "已发送到后端",
  cpu: "CPU",
  memory: "内存",
  gpu: "显卡",
  disk: "磁盘",
  network: "网络",
  aboutTitle: "关于 VivoFlow",
  aboutDesc:
    "Windows 系统指标采集器与移动优先仪表盘。单进程 Rust 后端采集数据，经 WebSocket JSON IPC 推送，并内嵌 React 前端。",
  version: "版本",
  techStack: "技术栈",
  license: "许可证",
  connected: "已连接",
  connecting: "连接中…",
  disconnected: "已断开，重连中…",
  footer: "JSON IPC · WebSocket · 移动优先仪表盘",
  unavailable: "不可用",
  usage: "占用",
  frequency: "频率",
  capacity: "容量",
  model: "型号",
  temperature: "温度",
  vram: "显存",
  gpuUsage: "GPU 占用",
  memClock: "显存频率",
  coreClock: "核心频率",
  cpuUsageTrend: "CPU 占用趋势",
  coresModel: "{cores} 核 · {model}",
  used: "已用 {value}",
  diskCount: "磁盘 · {count} 个",
  noDiskData: "无磁盘数据",
  noNetworkData: "无网卡数据",
  read: "读 {value}",
  write: "写 {value}",
  netDownTotal: "下行合计 (KB/s)",
  connectingService: "连接采集服务…",
  unknownError: "未知错误",
  parseError: "无法解析服务器消息",
  wsFailed: "WebSocket 连接失败",
  loading: "加载中",
} as const;

const EN: Record<MessageKey, string> = {
  settings: "Settings",
  back: "Back",
  appearance: "Appearance",
  collection: "Collection",
  about: "About",
  uiStyle: "UI style",
  uiStyleHint: "Currently using Amicro-style components and charts",
  accent: "Accent color",
  themeMode: "Light / Dark",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  language: "Language",
  langZh: "中文",
  langEn: "English",
  interval: "Interval (ms)",
  history: "History points",
  modules: "Modules",
  apply: "Apply to backend",
  applied: "Sent to backend",
  cpu: "CPU",
  memory: "Memory",
  gpu: "GPU",
  disk: "Disk",
  network: "Network",
  aboutTitle: "About VivoFlow",
  aboutDesc:
    "Windows metrics collector with a mobile-first dashboard. A single Rust process gathers data, pushes it over WebSocket JSON IPC, and serves an embedded React UI.",
  version: "Version",
  techStack: "Tech stack",
  license: "License",
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Disconnected, reconnecting…",
  footer: "JSON IPC · WebSocket · Mobile-first dashboard",
  unavailable: "N/A",
  usage: "Usage",
  frequency: "Frequency",
  capacity: "Capacity",
  model: "Model",
  temperature: "Temperature",
  vram: "VRAM",
  gpuUsage: "GPU usage",
  memClock: "Memory clock",
  coreClock: "Core clock",
  cpuUsageTrend: "CPU usage trend",
  coresModel: "{cores} cores · {model}",
  used: "Used {value}",
  diskCount: "Disks · {count}",
  noDiskData: "No disk data",
  noNetworkData: "No network adapters",
  read: "R {value}",
  write: "W {value}",
  netDownTotal: "Total download (KB/s)",
  connectingService: "Connecting to collector…",
  unknownError: "Unknown error",
  parseError: "Failed to parse server message",
  wsFailed: "WebSocket connection failed",
  loading: "Loading",
};

const TABLES: Record<Lang, Record<MessageKey, string>> = {
  zh: ZH,
  en: EN,
};

export type TranslateVars = Record<string, string | number>;

export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: TranslateVars,
): string {
  let text = TABLES[lang][key] ?? TABLES.zh[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function messagesFor(lang: Lang) {
  return TABLES[lang];
}
