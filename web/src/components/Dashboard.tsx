import {
  Fragment,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTheme } from "next-themes";
import {
  AreaTrend,
  GaugeArc,
  KpiCard,
  RoundedBullet,
  RoundedScatter,
  RoundedTreemap,
  SkeletonLoader,
  SparklineRow,
} from "@/components/viz";
import { useAppearance } from "@/hooks/useAppearance";
import {
  type DashboardSectionId,
  useDashboardOrder,
} from "@/hooks/useDashboardOrder";
import type { Snapshot } from "@/types";
import {
  cn,
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

function tempScatter(
  points: Snapshot["temp_history"],
  pick: (p: NonNullable<Snapshot["temp_history"]>[number]) => number | null | undefined,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of points ?? []) {
    const y = pick(p);
    if (y != null && Number.isFinite(y)) {
      out.push({ x: out.length, y });
    }
  }
  return out;
}

const LONG_PRESS_MS = 320;
const LONG_PRESS_TOLERANCE_PX = 8;

function useLongPressSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: LONG_PRESS_MS,
        tolerance: LONG_PRESS_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}

function DragGlyph({
  active,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <GripVertical
      aria-hidden
      className={cn(
        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity",
        active ? "opacity-90" : "opacity-40",
        className,
      )}
    />
  );
}

function SortableSection({
  id,
  title,
  className,
  children,
}: {
  id: DashboardSectionId;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "vf-grid flex flex-col",
        isDragging && "opacity-90",
        className,
      )}
    >
      <div
        className="flex cursor-grab touch-manipulation items-center gap-1.5 px-1 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DragGlyph active={isDragging} />
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function SortableWidget({
  id,
  span = 1,
  children,
}: {
  id: string;
  span?: 1 | 2;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 15 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative touch-manipulation",
        span === 2 && "col-span-2",
        isDragging && "opacity-90",
      )}
      {...attributes}
      {...listeners}
    >
      {isDragging ? (
        <DragGlyph
          active
          className="pointer-events-none absolute right-1.5 top-1.5 z-10"
        />
      ) : null}
      {children}
    </div>
  );
}

function WidgetGrid({
  sectionId,
  order,
  onReorder,
  items,
}: {
  sectionId: DashboardSectionId;
  order: string[];
  onReorder: (next: string[]) => void;
  items: Record<string, { span?: 1 | 2; node: ReactNode }>;
}) {
  const sensors = useLongPressSensors();

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <DndContext
      id={`dashboard-widgets-${sectionId}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="vf-grid grid grid-cols-2">
          {order.map((wid) => {
            const item = items[wid];
            if (!item) return null;
            return (
              <SortableWidget key={wid} id={wid} span={item.span ?? 1}>
                {item.node}
              </SortableWidget>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
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
  const { sections, widgets, setSections, setWidgets } = useDashboardOrder();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const naLabel = t("unavailable");
  const sectionSensors = useLongPressSensors();

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
  const cpuTempScatter = useMemo(
    () => tempScatter(snapshot?.temp_history, (p) => p.cpu_c),
    [snapshot?.temp_history],
  );
  const memTempScatter = useMemo(
    () => tempScatter(snapshot?.temp_history, (p) => p.mem_c),
    [snapshot?.temp_history],
  );

  const onSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIndex = prev.indexOf(active.id as DashboardSectionId);
      const newIndex = prev.indexOf(over.id as DashboardSectionId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  if (!snapshot) {
    return (
      <div className="vf-surface">
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

  const load5s = cpu?.load_5s ?? cpu?.usage_percent ?? 0;
  const load5m = cpu?.load_5m ?? cpu?.usage_percent ?? 0;
  const load15m = cpu?.load_15m ?? cpu?.usage_percent ?? 0;

  const sectionNodes: Record<DashboardSectionId, ReactNode> = {
    cpu: (
      <SortableSection id="cpu" title={t("cpu")}>
        <WidgetGrid
          sectionId="cpu"
          order={widgets.cpu}
          onReorder={(next) => setWidgets("cpu", next)}
          items={{
            gauge: {
              node: (
                <GaugeArc
                  label={t("usage")}
                  value={cpu?.usage_percent ?? 0}
                  display={formatPercent(cpu?.usage_percent, naLabel)}
                  theme={theme}
                />
              ),
            },
            kpi: {
              node: (
                <KpiCard
                  title={t("frequency")}
                  value={formatMhz(cpu?.current_mhz ?? cpu?.base_mhz, naLabel)}
                  subtitle={t("coresModel", {
                    cores: na(cpu?.cores, naLabel),
                    model: na(cpu?.model, naLabel),
                  })}
                  data={cpuUsageSeries}
                  theme={theme}
                />
              ),
            },
            load: {
              span: 2,
              node: (
                <RoundedBullet
                  title={t("cpuLoad")}
                  theme={theme}
                  domainMax={100}
                  items={[
                    { label: t("load5s"), value: load5s, target: 70 },
                    { label: t("load5m"), value: load5m, target: 70 },
                    { label: t("load15m"), value: load15m, target: 70 },
                  ]}
                />
              ),
            },
            spark: {
              span: 2,
              node: (
                <SparklineRow
                  name={t("cpuUsageTrend")}
                  value={formatPercent(cpu?.usage_percent, naLabel)}
                  data={sparkFrom(history, (s) => s.cpu?.usage_percent)}
                  theme={theme}
                />
              ),
            },
            temp: {
              span: 2,
              node: (
                <div className="vf-surface space-y-1.5 text-sm">
                  <Row k={t("cpuTemp")} v={formatTemp(cpu?.temperature_c, naLabel)} />
                </div>
              ),
            },
          }}
        />
      </SortableSection>
    ),
    memory: (
      <SortableSection id="memory" title={t("memory")}>
        <WidgetGrid
          sectionId="memory"
          order={widgets.memory}
          onReorder={(next) => setWidgets("memory", next)}
          items={{
            gauge: {
              node: (
                <GaugeArc
                  label={t("usage")}
                  value={mem?.usage_percent ?? 0}
                  display={formatPercent(mem?.usage_percent, naLabel)}
                  theme={theme}
                />
              ),
            },
            kpi: {
              node: (
                <KpiCard
                  title={t("capacity")}
                  value={formatBytes(mem?.total_bytes, naLabel)}
                  subtitle={t("used", {
                    value: formatBytes(mem?.used_bytes, naLabel),
                  })}
                  data={memUsageSeries}
                  theme={theme}
                />
              ),
            },
            info: {
              span: 2,
              node: (
                <div className="vf-surface space-y-1.5 text-sm">
                  <Row k={t("model")} v={na(memModel, naLabel)} />
                  <Row k={t("frequency")} v={formatMhz(memSpeed, naLabel)} />
                  <Row k={t("memTemp")} v={formatTemp(mem?.temperature_c, naLabel)} />
                </div>
              ),
            },
          }}
        />
      </SortableSection>
    ),
    temp: (
      <SortableSection
        id="temp"
        title={t("temperature")}
        className="landscape:col-span-2"
      >
        <WidgetGrid
          sectionId="temp"
          order={widgets.temp}
          onReorder={(next) => setWidgets("temp", next)}
          items={{
            cpuScatter: {
              node: (
                <RoundedScatter
                  title={t("cpuTempTrend")}
                  theme={theme}
                  emptyLabel={t("noTempData")}
                  series={[{ name: t("cpuTemp"), data: cpuTempScatter }]}
                />
              ),
            },
            memScatter: {
              node: (
                <RoundedScatter
                  title={t("memTempTrend")}
                  theme={theme}
                  emptyLabel={t("noTempData")}
                  series={[{ name: t("memTemp"), data: memTempScatter }]}
                />
              ),
            },
          }}
        />
      </SortableSection>
    ),
    gpu: (
      <SortableSection id="gpu" title={t("gpu")}>
        <WidgetGrid
          sectionId="gpu"
          order={widgets.gpu}
          onReorder={(next) => setWidgets("gpu", next)}
          items={{
            gauge: {
              node: (
                <GaugeArc
                  label={t("gpuUsage")}
                  value={gpu?.usage_percent ?? 0}
                  display={formatPercent(gpu?.usage_percent, naLabel)}
                  theme={theme}
                />
              ),
            },
            kpi: {
              node: (
                <KpiCard
                  title={t("vram")}
                  value={formatBytes(gpu?.vram_bytes, naLabel)}
                  subtitle={t("used", {
                    value: formatBytes(gpu?.vram_used_bytes, naLabel),
                  })}
                  data={gpuUsageSeries}
                  theme={theme}
                />
              ),
            },
            info: {
              span: 2,
              node: (
                <div className="vf-surface space-y-1.5 text-sm">
                  <Row k={t("model")} v={na(gpu?.name, naLabel)} />
                  <Row
                    k={t("temperature")}
                    v={formatTemp(gpu?.temperature_c, naLabel)}
                  />
                  <Row
                    k={t("memClock")}
                    v={formatMhz(gpu?.memory_clock_mhz, naLabel)}
                  />
                  <Row
                    k={t("coreClock")}
                    v={formatMhz(gpu?.core_clock_mhz, naLabel)}
                  />
                </div>
              ),
            },
          }}
        />
      </SortableSection>
    ),
    disk: (
      <SortableSection
        id="disk"
        title={t("diskCount", { count: disks.length })}
      >
        <WidgetGrid
          sectionId="disk"
          order={widgets.disk}
          onReorder={(next) => setWidgets("disk", next)}
          items={{
            treemap: {
              span: 2,
              node:
                disks.length === 0 ? (
                  <EmptyCard text={t("noDiskData")} />
                ) : (
                  <RoundedTreemap
                    title={t("diskShare")}
                    theme={theme}
                    emptyLabel={t("noDiskData")}
                    data={disks.map((d) => ({
                      name: d.name,
                      size: Math.max(d.total_bytes, 1),
                      label: formatBytes(d.total_bytes, naLabel),
                    }))}
                  />
                ),
            },
            list: {
              span: 2,
              node:
                disks.length === 0 ? null : (
                  <div className="vf-grid flex flex-col">
                    {disks.slice(0, 4).map((d) => (
                      <div
                        key={d.name}
                        className="vf-surface text-sm"
                        style={{ padding: "0.75rem" }}
                      >
                        <p className="truncate font-medium">{d.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {na(d.model, naLabel)} · {na(d.kind, naLabel)} ·{" "}
                          {formatBytes(d.total_bytes, naLabel)}
                        </p>
                        <div className="mt-2 flex gap-3 text-xs">
                          <span className="vf-data">
                            {t("read", { value: formatBps(d.read_bps, naLabel) })}
                          </span>
                          <span className="vf-data">
                            {t("write", {
                              value: formatBps(d.write_bps, naLabel),
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
            },
          }}
        />
      </SortableSection>
    ),
    network: (
      <SortableSection
        id="network"
        title={t("network")}
        className="landscape:col-span-2"
      >
        <WidgetGrid
          sectionId="network"
          order={widgets.network}
          onReorder={(next) => setWidgets("network", next)}
          items={{
            area: {
              span: 2,
              node: (
                <AreaTrend
                  title={t("netDownTotal")}
                  data={netRxSeries}
                  theme={theme}
                />
              ),
            },
            nics: {
              span: 2,
              node: (
                <div className="vf-grid grid grid-cols-1 landscape:grid-cols-2">
                  {nets.length === 0 ? (
                    <EmptyCard text={t("noNetworkData")} />
                  ) : (
                    nets.slice(0, 4).map((n) => (
                      <div
                        key={n.name}
                        className="vf-surface text-sm"
                        style={{ padding: "0.75rem" }}
                      >
                        <p className="truncate font-medium">{n.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {na(n.model, naLabel)}
                        </p>
                        <div className="mt-2 flex gap-3 text-xs">
                          <span className="vf-data">
                            ↓ {formatBps(n.rx_bps, naLabel)}
                          </span>
                          <span className="vf-data">
                            ↑ {formatBps(n.tx_bps, naLabel)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ),
            },
          }}
        />
      </SortableSection>
    ),
  };

  return (
    <DndContext
      id="dashboard-sections"
      sensors={sectionSensors}
      collisionDetection={closestCenter}
      onDragEnd={onSectionDragEnd}
    >
      <SortableContext items={sections} strategy={rectSortingStrategy}>
        <div className="vf-grid grid grid-cols-1 landscape:grid-cols-2 lg:grid-cols-2">
          {sections.map((id) => (
            <Fragment key={id}>{sectionNodes[id]}</Fragment>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="vf-data truncate text-right font-medium">{v}</span>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div
      className="vf-surface text-sm text-muted-foreground"
      style={{ borderStyle: "dashed", opacity: 0.85 }}
    >
      {text}
    </div>
  );
}
