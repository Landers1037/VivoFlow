import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  MonoAreaTrend,
  MonoGaugeArc,
  MonoKpiCard,
  MonoSparklineRow,
} from "@/components/amicro/mono-charts";
import { SkeletonLoader } from "@/components/amicro/loaders";
import type { Snapshot } from "@/types";
import {
  formatBps,
  formatBytes,
  formatMhz,
  formatPercent,
  formatTemp,
  na,
} from "@/lib/utils";

function seriesFrom(
  history: Snapshot[],
  pick: (s: Snapshot) => number | null | undefined,
): { v: number }[] {
  return history.map((s) => ({ v: pick(s) ?? 0 }));
}

function sparkFrom(
  history: Snapshot[],
  pick: (s: Snapshot) => number | null | undefined,
): { x: number; y: number }[] {
  return history.map((s, i) => ({ x: i, y: pick(s) ?? 0 }));
}

export function Dashboard({
  snapshot,
  history,
}: {
  snapshot: Snapshot | null;
  history: Snapshot[];
}) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";

  const cpuUsageSeries = useMemo(
    () => seriesFrom(history, (s) => s.cpu?.usage_percent),
    [history],
  );
  const memUsageSeries = useMemo(
    () => seriesFrom(history, (s) => s.memory?.usage_percent),
    [history],
  );
  const gpuUsageSeries = useMemo(
    () => seriesFrom(history, (s) => s.gpu?.[0]?.usage_percent ?? null),
    [history],
  );
  const netRxSeries = useMemo(
    () =>
      history.map((s, i) => ({
        t: i,
        v: (s.network ?? []).reduce((a, n) => a + n.rx_bps, 0) / 1024,
      })),
    [history],
  );

  if (!snapshot) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <SkeletonLoader />
      </div>
    );
  }

  const cpu = snapshot.cpu;
  const mem = snapshot.memory;
  const gpu = snapshot.gpu?.[0];
  const disks = snapshot.disks ?? [];
  const nets = snapshot.network ?? [];
  const memModel =
    mem?.modules
      ?.map((m) => m.part_number || m.manufacturer)
      .filter(Boolean)
      .join(" / ") || null;
  const memSpeed = mem?.modules?.find((m) => m.speed_mhz)?.speed_mhz ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 landscape:grid-cols-2 landscape:gap-3 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">CPU</h2>
        <div className="grid grid-cols-2 gap-3">
          <MonoGaugeArc
            label="占用"
            value={cpu?.usage_percent ?? 0}
            display={formatPercent(cpu?.usage_percent)}
            theme={theme}
          />
          <MonoKpiCard
            title="频率"
            value={formatMhz(cpu?.current_mhz ?? cpu?.base_mhz)}
            subtitle={`${na(cpu?.cores)} 核 · ${na(cpu?.model)}`}
            data={cpuUsageSeries}
            theme={theme}
          />
        </div>
        <MonoSparklineRow
          name="CPU 占用趋势"
          value={formatPercent(cpu?.usage_percent)}
          data={sparkFrom(history, (s) => s.cpu?.usage_percent)}
          theme={theme}
        />
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">内存</h2>
        <div className="grid grid-cols-2 gap-3">
          <MonoGaugeArc
            label="占用"
            value={mem?.usage_percent ?? 0}
            display={formatPercent(mem?.usage_percent)}
            theme={theme}
          />
          <MonoKpiCard
            title="容量"
            value={formatBytes(mem?.total_bytes)}
            subtitle={`已用 ${formatBytes(mem?.used_bytes)}`}
            data={memUsageSeries}
            theme={theme}
          />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-sm space-y-1.5">
          <Row k="型号" v={na(memModel)} />
          <Row k="频率" v={formatMhz(memSpeed)} />
          <Row k="温度" v={formatTemp(mem?.temperature_c)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">显卡</h2>
        <div className="grid grid-cols-2 gap-3">
          <MonoGaugeArc
            label="GPU 占用"
            value={gpu?.usage_percent ?? 0}
            display={formatPercent(gpu?.usage_percent)}
            theme={theme}
          />
          <MonoKpiCard
            title="显存"
            value={formatBytes(gpu?.vram_bytes)}
            subtitle={`已用 ${formatBytes(gpu?.vram_used_bytes)}`}
            data={gpuUsageSeries}
            theme={theme}
          />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-sm space-y-1.5">
          <Row k="型号" v={na(gpu?.name)} />
          <Row k="温度" v={formatTemp(gpu?.temperature_c)} />
          <Row k="显存频率" v={formatMhz(gpu?.memory_clock_mhz)} />
          <Row k="核心频率" v={formatMhz(gpu?.core_clock_mhz)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">
          磁盘 · {disks.length} 个
        </h2>
        <div className="space-y-2">
          {disks.length === 0 ? (
            <EmptyCard text="无磁盘数据" />
          ) : (
            disks.slice(0, 4).map((d) => (
              <div key={d.name} className="rounded-2xl border border-border bg-card p-3 text-sm">
                <p className="font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {na(d.model)} · {na(d.kind)} · {formatBytes(d.total_bytes)}
                </p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span>读 {formatBps(d.read_bps)}</span>
                  <span>写 {formatBps(d.write_bps)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3 landscape:col-span-2">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">网络</h2>
        <MonoAreaTrend title="下行合计 (KB/s)" data={netRxSeries} theme={theme} />
        <div className="grid grid-cols-1 gap-2 landscape:grid-cols-2">
          {nets.length === 0 ? (
            <EmptyCard text="无网卡数据" />
          ) : (
            nets.slice(0, 4).map((n) => (
              <div key={n.name} className="rounded-2xl border border-border bg-card p-3 text-sm">
                <p className="font-medium truncate">{n.name}</p>
                <p className="text-xs text-muted-foreground truncate">{na(n.model)}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span>↓ {formatBps(n.rx_bps)}</span>
                  <span>↑ {formatBps(n.tx_bps)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-right font-medium">{v}</span>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}
