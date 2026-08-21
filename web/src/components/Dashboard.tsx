import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  MonoAreaTrend,
  MonoGaugeArc,
  MonoKpiCard,
  MonoSparklineRow,
} from "@/components/amicro/mono-charts";
import { SkeletonLoader } from "@/components/amicro/loaders";
import { useAppearance } from "@/hooks/useAppearance";
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
  const { t } = useAppearance();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const naLabel = t("unavailable");

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
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">
          {t("cpu")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <MonoGaugeArc
            label={t("usage")}
            value={cpu?.usage_percent ?? 0}
            display={formatPercent(cpu?.usage_percent, naLabel)}
            theme={theme}
          />
          <MonoKpiCard
            title={t("frequency")}
            value={formatMhz(cpu?.current_mhz ?? cpu?.base_mhz, naLabel)}
            subtitle={t("coresModel", {
              cores: na(cpu?.cores, naLabel),
              model: na(cpu?.model, naLabel),
            })}
            data={cpuUsageSeries}
            theme={theme}
          />
        </div>
        <MonoSparklineRow
          name={t("cpuUsageTrend")}
          value={formatPercent(cpu?.usage_percent, naLabel)}
          data={sparkFrom(history, (s) => s.cpu?.usage_percent)}
          theme={theme}
        />
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">
          {t("memory")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <MonoGaugeArc
            label={t("usage")}
            value={mem?.usage_percent ?? 0}
            display={formatPercent(mem?.usage_percent, naLabel)}
            theme={theme}
          />
          <MonoKpiCard
            title={t("capacity")}
            value={formatBytes(mem?.total_bytes, naLabel)}
            subtitle={t("used", { value: formatBytes(mem?.used_bytes, naLabel) })}
            data={memUsageSeries}
            theme={theme}
          />
        </div>
        <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4 text-sm">
          <Row k={t("model")} v={na(memModel, naLabel)} />
          <Row k={t("frequency")} v={formatMhz(memSpeed, naLabel)} />
          <Row k={t("temperature")} v={formatTemp(mem?.temperature_c, naLabel)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">
          {t("gpu")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <MonoGaugeArc
            label={t("gpuUsage")}
            value={gpu?.usage_percent ?? 0}
            display={formatPercent(gpu?.usage_percent, naLabel)}
            theme={theme}
          />
          <MonoKpiCard
            title={t("vram")}
            value={formatBytes(gpu?.vram_bytes, naLabel)}
            subtitle={t("used", { value: formatBytes(gpu?.vram_used_bytes, naLabel) })}
            data={gpuUsageSeries}
            theme={theme}
          />
        </div>
        <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4 text-sm">
          <Row k={t("model")} v={na(gpu?.name, naLabel)} />
          <Row k={t("temperature")} v={formatTemp(gpu?.temperature_c, naLabel)} />
          <Row k={t("memClock")} v={formatMhz(gpu?.memory_clock_mhz, naLabel)} />
          <Row k={t("coreClock")} v={formatMhz(gpu?.core_clock_mhz, naLabel)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">
          {t("diskCount", { count: disks.length })}
        </h2>
        <div className="space-y-2">
          {disks.length === 0 ? (
            <EmptyCard text={t("noDiskData")} />
          ) : (
            disks.slice(0, 4).map((d) => (
              <div key={d.name} className="rounded-2xl border border-border bg-card p-3 text-sm">
                <p className="truncate font-medium">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {na(d.model, naLabel)} · {na(d.kind, naLabel)} ·{" "}
                  {formatBytes(d.total_bytes, naLabel)}
                </p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span>{t("read", { value: formatBps(d.read_bps, naLabel) })}</span>
                  <span>{t("write", { value: formatBps(d.write_bps, naLabel) })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3 landscape:col-span-2">
        <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground">
          {t("network")}
        </h2>
        <MonoAreaTrend title={t("netDownTotal")} data={netRxSeries} theme={theme} />
        <div className="grid grid-cols-1 gap-2 landscape:grid-cols-2">
          {nets.length === 0 ? (
            <EmptyCard text={t("noNetworkData")} />
          ) : (
            nets.slice(0, 4).map((n) => (
              <div key={n.name} className="rounded-2xl border border-border bg-card p-3 text-sm">
                <p className="truncate font-medium">{n.name}</p>
                <p className="truncate text-xs text-muted-foreground">{na(n.model, naLabel)}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span>↓ {formatBps(n.rx_bps, naLabel)}</span>
                  <span>↑ {formatBps(n.tx_bps, naLabel)}</span>
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
