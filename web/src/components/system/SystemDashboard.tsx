import {
  Children,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  MonitorCog,
  MonitorUp,
  Network,
  Server,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";
import { useAppearance, type TFunction } from "@/hooks/useAppearance";
import type {
  ConnState,
  DiskMetrics,
  GpuMetrics,
  MemoryMetrics,
  NetworkMetrics,
  Snapshot,
} from "@/types";
import {
  cn,
  formatBps,
  formatBytes,
  formatMhz,
  formatPercent,
  formatTemp,
  na,
} from "@/lib/utils";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const FIT_EPSILON = 0.002;

export function SystemDashboard({
  snapshot,
  history,
  conn,
  error,
}: {
  snapshot: Snapshot | null;
  history: Snapshot[];
  conn: ConnState;
  error?: string;
}) {
  const { resolvedTheme } = useTheme();
  const { t } = useAppearance();
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const unavailable = t("unavailable");

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const styles = getComputedStyle(viewport);
        const availableWidth = viewport.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
        const availableHeight = viewport.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
        const naturalWidth = content.scrollWidth;
        const naturalHeight = content.scrollHeight;
        if (availableWidth <= 0 || availableHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return;
        const next = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
        setNaturalHeight((current) => (current === null || Math.abs(current - naturalHeight) > 0.5 ? naturalHeight : current));
        setScale((current) => (Math.abs(current - next) > FIT_EPSILON ? next : current));
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [Boolean(snapshot), history.length, t]);

  const content = snapshot ? (
    <SystemDashboardContent
      snapshot={snapshot}
      history={history}
      conn={conn}
      error={error}
      unavailable={unavailable}
      t={t}
      theme={theme}
    />
  ) : (
    <SystemDashboardEmpty conn={conn} error={error} t={t} />
  );

  return (
    <div ref={viewportRef} className="vf-system-dashboard" data-scale={scale < 0.99 ? "fit" : "native"}>
      <div
        className="vf-system-dashboard-scaler"
        style={naturalHeight ? { height: `${Math.floor(naturalHeight * scale)}px` } : undefined}
      >
        <div
          ref={contentRef}
          className="vf-system-dashboard-content"
          style={{ transform: `scale(${scale})` }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

function SystemDashboardContent({
  snapshot,
  history,
  conn,
  error,
  unavailable,
  t,
  theme,
}: {
  snapshot: Snapshot;
  history: Snapshot[];
  conn: ConnState;
  error?: string;
  unavailable: string;
  t: TFunction;
  theme: "light" | "dark";
}) {
  const cpu = snapshot.cpu;
  const memory = snapshot.memory;
  const gpus = snapshot.gpu ?? [];
  const disks = snapshot.disks ?? [];
  const networks = snapshot.network ?? [];
  const system = snapshot.system;
  const gpuUsageValues = gpus
    .map((gpu) => gpu.usage_percent)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const gpuUsage = gpuUsageValues.length ? Math.max(...gpuUsageValues) : null;
  const networkRateValues = networks.flatMap((network) => [network.rx_bps, network.tx_bps])
    .filter((value): value is number => value != null && Number.isFinite(value));
  const networkRate = networkRateValues.length
    ? networkRateValues.reduce((total, value) => total + value, 0)
    : null;
  const statusLabel = conn === "connected" ? t("connected") : conn === "connecting" ? t("connecting") : t("disconnected");
  const cpuMemoryTrend = history.map((item, index) => ({
    x: index,
    cpu: item.cpu?.usage_percent ?? 0,
    memory: item.memory?.usage_percent ?? 0,
  }));
  const networkTrend = history.map((item, index) => ({
    x: index,
    rx: (item.network ?? []).reduce((total, network) => total + (network.rx_bps ?? 0), 0) / 1024,
    tx: (item.network ?? []).reduce((total, network) => total + (network.tx_bps ?? 0), 0) / 1024,
  }));
  const temperatureTrend = (snapshot.temp_history ?? []).map((item, index) => ({
    x: index,
    cpu: item.cpu_c ?? 0,
    memory: item.mem_c ?? 0,
  }));

  return (
    <main className="vf-system-board" data-theme={theme}>
      <header className="vf-system-board-header">
        <div className="vf-system-board-brand">
          <span className="vf-system-board-mark" aria-hidden="true">
            <MonitorCog />
          </span>
          <div className="min-w-0">
            <p className="vf-system-board-kicker">{t("systemDashboard")}</p>
            <h1>{na(system?.os_name, unavailable)}</h1>
            <p className="vf-system-board-host">{t("hostName")} · {na(system?.host_name, unavailable)}</p>
          </div>
        </div>
        <div className="vf-system-board-status">
          <span className={cn("vf-system-board-status-dot", conn === "connected" && "is-live")} />
          <span>{statusLabel}</span>
          <span className="vf-system-board-divider" aria-hidden="true" />
          <span className="vf-system-board-uptime">
            {t("uptime")} {formatUptime(system?.uptime_seconds, unavailable)}
          </span>
          <span className="vf-system-board-divider" aria-hidden="true" />
          <span className="vf-system-board-updated">
            {t("lastUpdate")} {formatDateTime(snapshot.ts)}
          </span>
        </div>
      </header>

      {error ? <div className="vf-system-board-error">{error}</div> : null}

      <section className="vf-system-board-summary" aria-label={t("overview")}>
        <SummaryMetric icon={Cpu} label={t("cpu")} value={formatPercent(cpu?.usage_percent, unavailable)} detail={cpu ? `${cpu.cores} ${t("coresShort")}` : unavailable} />
        <SummaryMetric icon={MemoryStick} label={t("memory")} value={formatPercent(memory?.usage_percent, unavailable)} detail={memory ? `${formatBytes(memory.used_bytes, unavailable)} / ${formatBytes(memory.total_bytes, unavailable)}` : unavailable} />
        <SummaryMetric icon={MonitorUp} label={t("gpu")} value={formatPercent(gpuUsage, unavailable)} detail={`${gpus.length} ${t("devicesShort")}`} />
        <SummaryMetric icon={Network} label={t("networkTotal")} value={formatBps(networkRate, unavailable)} detail={`${networks.length} ${t("devicesShort")}`} />
      </section>

      <section className="vf-system-board-grid">
        <InfoPanel icon={Server} title={t("systemInfo")} className="vf-system-panel-system">
          <InfoRow label={t("osName")} value={na(system?.os_name, unavailable)} />
          <InfoRow label={t("osVersion")} value={na(system?.os_version, unavailable)} />
          <InfoRow label={t("kernelVersion")} value={na(system?.kernel_version, unavailable)} />
          <InfoRow label={t("hostName")} value={na(system?.host_name, unavailable)} />
          <InfoRow label={t("uptime")} value={formatUptime(system?.uptime_seconds, unavailable)} />
          <InfoRow label={t("cpuTemp")} value={formatTemp(cpu?.temperature_c, unavailable)} />
          <InfoRow label={t("memTemp")} value={formatTemp(memory?.temperature_c, unavailable)} />
        </InfoPanel>

        <InfoPanel icon={Cpu} title={t("cpu")} className="vf-system-panel-cpu">
          <InfoRow label={t("model")} value={na(cpu?.model, unavailable)} />
          <InfoRow label={t("coresShort")} value={cpu ? String(cpu.cores) : unavailable} />
          <InfoRow label={t("baseFrequency")} value={formatMhz(cpu?.base_mhz, unavailable)} />
          <InfoRow label={t("currentFrequency")} value={formatMhz(cpu?.current_mhz, unavailable)} />
          <InfoRow label={t("cpuLoad")} value={`${formatPercent(cpu?.load_5s, unavailable)} / ${formatPercent(cpu?.load_5m, unavailable)} / ${formatPercent(cpu?.load_15m, unavailable)}`} />
          <InfoRow label={t("temperature")} value={formatTemp(cpu?.temperature_c, unavailable)} />
        </InfoPanel>

        <InfoPanel icon={MemoryStick} title={t("memory")} className="vf-system-panel-memory">
          <InfoRow label={t("capacity")} value={formatBytes(memory?.total_bytes, unavailable)} />
          <InfoRow label={t("used", { value: formatBytes(memory?.used_bytes, unavailable) })} value={formatPercent(memory?.usage_percent, unavailable)} />
          <InfoRow label={t("temperature")} value={formatTemp(memory?.temperature_c, unavailable)} />
          <div className="vf-system-subsection-label">{t("memoryModules")} · {memory?.modules?.length ?? 0}</div>
          <div className="vf-system-device-list">
            {(memory?.modules ?? []).map((module, index) => (
              <div key={`${module.part_number ?? "module"}-${index}`} className="vf-system-device-row">
                <span className="vf-system-device-name">{formatModuleName(module.manufacturer, module.part_number, unavailable)}</span>
                <span>{formatBytes(module.capacity_bytes, unavailable)}</span>
                <span>{formatMhz(module.speed_mhz, unavailable)}</span>
              </div>
            ))}
          </div>
        </InfoPanel>

        <DevicePanel icon={MonitorUp} title={`${t("gpu")} · ${gpus.length}`} emptyLabel={unavailable} className="vf-system-panel-gpus">
          {gpus.map((gpu, index) => <GpuRow key={`${gpu.name ?? "gpu"}-${index}`} gpu={gpu} unavailable={unavailable} t={t} />)}
        </DevicePanel>

        <DevicePanel icon={HardDrive} title={`${t("disk")} · ${disks.length}`} emptyLabel={t("noDiskData")} className="vf-system-panel-disks">
          {disks.map((disk, index) => <DiskRow key={`${disk.name}-${disk.model ?? ""}-${index}`} disk={disk} unavailable={unavailable} t={t} />)}
        </DevicePanel>

        <DevicePanel icon={Network} title={`${t("network")} · ${networks.length}`} emptyLabel={t("noNetworkData")} className="vf-system-panel-networks">
          {networks.map((network, index) => <NetworkRow key={`${network.name}-${index}`} network={network} unavailable={unavailable} t={t} />)}
        </DevicePanel>
      </section>

      <section className="vf-system-board-history" aria-label={t("historyTrend")}>
        <div className="vf-system-history-title"><Activity aria-hidden="true" /><span>{t("historyTrend")}</span></div>
        <TrendLine label={t("cpuMemoryTrend")} data={cpuMemoryTrend} dataKey="cpu" secondDataKey="memory" color="var(--system-cpu)" secondColor="var(--system-memory)" />
        <TrendLine label={t("network")} data={networkTrend} dataKey="rx" secondDataKey="tx" color="var(--system-network)" secondColor="var(--system-network-secondary)" />
        <TrendLine label={t("temperature")} data={temperatureTrend} dataKey="cpu" secondDataKey="memory" color="var(--system-temp)" secondColor="var(--system-temp-secondary)" />
      </section>
    </main>
  );
}

function SystemDashboardEmpty({ conn, error, t }: { conn: ConnState; error?: string; t: TFunction }) {
  return (
    <main className="vf-system-board vf-system-board-empty">
      <div className="vf-system-board-empty-mark"><MonitorCog aria-hidden="true" /></div>
      <h1>{t("systemDashboard")}</h1>
      <p>{error ?? (conn === "connected" ? t("noSystemData") : t("connectingService"))}</p>
    </main>
  );
}

function SummaryMetric({ icon: Icon, label, value, detail }: { icon: Icon; label: string; value: string; detail: string }) {
  return (
    <div className="vf-system-summary-metric">
      <Icon aria-hidden="true" />
      <div className="min-w-0">
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function InfoPanel({ icon: Icon, title, children, className }: { icon: Icon; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("vf-system-panel", className)}>
      <div className="vf-system-panel-heading"><Icon aria-hidden="true" /><h2>{title}</h2></div>
      <div className="vf-system-panel-body">{children}</div>
    </section>
  );
}

function DevicePanel({ icon: Icon, title, children, emptyLabel, className }: { icon: Icon; title: string; children: ReactNode; emptyLabel: string; className?: string }) {
  const hasChildren = Children.count(children) > 0;
  return (
    <InfoPanel icon={Icon} title={title} className={className}>
      {hasChildren ? children : <div className="vf-system-empty-row">{emptyLabel}</div>}
    </InfoPanel>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="vf-system-info-row"><span>{label}</span><strong title={value}>{value}</strong></div>;
}

function GpuRow({ gpu, unavailable, t }: { gpu: GpuMetrics; unavailable: string; t: TFunction }) {
  return (
    <div className="vf-system-device-block">
      <div className="vf-system-device-heading"><strong title={na(gpu.name, unavailable)}>{na(gpu.name, unavailable)}</strong><span>{formatPercent(gpu.usage_percent, unavailable)}</span></div>
      <div className="vf-system-device-grid">
        <span>{t("vram")} {formatBytes(gpu.vram_used_bytes, unavailable)} / {formatBytes(gpu.vram_bytes, unavailable)}</span>
        <span>{t("temperature")} {formatTemp(gpu.temperature_c, unavailable)}</span>
        <span>{t("memClock")} {formatMhz(gpu.memory_clock_mhz, unavailable)}</span>
        <span>{t("coreClock")} {formatMhz(gpu.core_clock_mhz, unavailable)}</span>
      </div>
    </div>
  );
}

function DiskRow({ disk, unavailable, t }: { disk: DiskMetrics; unavailable: string; t: TFunction }) {
  return (
    <div className="vf-system-device-block">
      <div className="vf-system-device-heading"><strong title={disk.name}>{disk.name}</strong><span>{formatBytes(disk.used_bytes, unavailable)} / {formatBytes(disk.total_bytes, unavailable)}</span></div>
      <div className="vf-system-device-grid">
        <span title={na(disk.model, unavailable)}>{na(disk.model, unavailable)}</span>
        <span>{na(disk.kind, unavailable)}</span>
        <span>{t("read", { value: formatBps(disk.read_bps, unavailable) })}</span>
        <span>{t("write", { value: formatBps(disk.write_bps, unavailable) })}</span>
      </div>
    </div>
  );
}

function NetworkRow({ network, unavailable, t }: { network: NetworkMetrics; unavailable: string; t: TFunction }) {
  return (
    <div className="vf-system-device-block">
      <div className="vf-system-device-heading"><strong title={network.name}>{network.name}</strong><span>{formatBps((network.rx_bps ?? 0) + (network.tx_bps ?? 0), unavailable)}</span></div>
      <div className="vf-system-device-grid">
        <span title={na(network.model, unavailable)}>{na(network.model, unavailable)}</span>
        <span title={na(network.mac, unavailable)}>{na(network.mac, unavailable)}</span>
        <span>{t("rx")} {formatBps(network.rx_bps, unavailable)}</span>
        <span>{t("tx")} {formatBps(network.tx_bps, unavailable)}</span>
      </div>
    </div>
  );
}

function formatModuleName(manufacturer: string | null | undefined, partNumber: string | null | undefined, unavailable: string): string {
  const values = [manufacturer, partNumber].filter((value): value is string => Boolean(value));
  return values.length ? values.join(" · ") : unavailable;
}

function TrendLine({ label, data, dataKey, secondDataKey, color, secondColor }: { label: string; data: Array<Record<string, number>>; dataKey: string; secondDataKey?: string; color: string; secondColor?: string }) {
  return (
    <div className="vf-system-trend">
      <span>{label}</span>
      <div className="vf-system-trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.length ? data : [{ [dataKey]: 0 }]}>
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
            {secondDataKey ? <Line type="monotone" dataKey={secondDataKey} stroke={secondColor ?? color} strokeWidth={1.3} dot={false} isAnimationActive={false} /> : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatDateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(timestamp);
}

function formatUptime(seconds: number | undefined, unavailable: string): string {
  if (seconds == null || !Number.isFinite(seconds)) return unavailable;
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days) return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}
