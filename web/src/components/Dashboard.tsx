import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { useAppearance, type TFunction } from "@/hooks/useAppearance";
import { useHandheldViewport } from "@/hooks/useMobileViewport";
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

type DashboardWidget = {
  span?: 1 | 2;
  height?: 1 | 2;
  node: ReactNode;
};

type DashboardSectionModel = {
  id: DashboardSectionId;
  title: string;
  className?: string;
  items: Record<string, DashboardWidget>;
};

type MobilePlacement = {
  id: string;
  row: number;
  col: number;
  rowSpan: 1 | 2;
  colSpan: 1 | 2;
  node: ReactNode;
};

type MobilePage = {
  key: string;
  sectionId: DashboardSectionId;
  title: string;
  placements: MobilePlacement[];
};

function findMobilePlacement(
  occupied: boolean[][],
  colSpan: 1 | 2,
  rowSpan: 1 | 2,
) {
  for (let row = 0; row <= 2 - rowSpan; row += 1) {
    for (let col = 0; col <= 2 - colSpan; col += 1) {
      let available = true;
      for (let y = row; y < row + rowSpan; y += 1) {
        for (let x = col; x < col + colSpan; x += 1) {
          if (occupied[y][x]) available = false;
        }
      }
      if (available) return { row, col };
    }
  }
  return null;
}

function occupyMobileCells(
  occupied: boolean[][],
  row: number,
  col: number,
  colSpan: 1 | 2,
  rowSpan: 1 | 2,
) {
  for (let y = row; y < row + rowSpan; y += 1) {
    for (let x = col; x < col + colSpan; x += 1) {
      occupied[y][x] = true;
    }
  }
}

function packMobilePages(
  sections: DashboardSectionId[],
  widgets: Record<DashboardSectionId, string[]>,
  models: Record<DashboardSectionId, DashboardSectionModel>,
): MobilePage[] {
  const pages: MobilePage[] = [];

  for (const sectionId of sections) {
    const model = models[sectionId];
    let occupied = Array.from({ length: 2 }, () => [false, false]);
    let placements: MobilePlacement[] = [];
    let pageNumber = 0;

    const flush = () => {
      if (!placements.length) return;
      pages.push({
        key: `${sectionId}-${pageNumber}`,
        sectionId,
        title: model.title,
        placements,
      });
      pageNumber += 1;
      occupied = Array.from({ length: 2 }, () => [false, false]);
      placements = [];
    };

    for (const id of widgets[sectionId]) {
      const item = model.items[id];
      if (!item || item.node == null) continue;
      const colSpan = item.span ?? 1;
      const rowSpan = item.height ?? 1;
      let position = findMobilePlacement(occupied, colSpan, rowSpan);
      if (!position) {
        flush();
        position = findMobilePlacement(occupied, colSpan, rowSpan);
      }
      if (!position) continue;
      occupyMobileCells(occupied, position.row, position.col, colSpan, rowSpan);
      placements.push({
        id,
        row: position.row,
        col: position.col,
        rowSpan,
        colSpan,
        node: item.node,
      });
    }
    flush();
  }

  return pages;
}

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
        "relative min-h-0 touch-manipulation",
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
  items: Record<string, DashboardWidget>;
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

function MobileDashboard({
  pages,
  autoCarousel,
  intervalSeconds,
  t,
}: {
  pages: MobilePage[];
  autoCarousel: boolean;
  intervalSeconds: number;
  t: TFunction;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const timer = useRef<number | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const scheduleTimer = useCallback(() => {
    clearTimer();
    if (!autoCarousel || pages.length <= 1 || document.visibilityState === "hidden") return;
    timer.current = window.setTimeout(() => {
      setPageIndex((current) => (current + 1) % pages.length);
    }, intervalSeconds * 1000);
  }, [autoCarousel, clearTimer, intervalSeconds, pages.length]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(0, pages.length - 1)));
  }, [pages.length]);

  useEffect(() => {
    scheduleTimer();
    return clearTimer;
  }, [clearTimer, pageIndex, scheduleTimer]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearTimer();
      else scheduleTimer();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [clearTimer, scheduleTimer]);

  const goToPage = useCallback(
    (next: number) => {
      if (!pages.length) return;
      clearTimer();
      setPageIndex((next + pages.length) % pages.length);
      scheduleTimer();
    },
    [clearTimer, pages.length, scheduleTimer],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    if (event.clientX >= window.innerWidth - 24) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy)) return;
    goToPage(pageIndex + (dx < 0 ? 1 : -1));
  };

  if (!pages.length) return null;
  const page = pages[pageIndex] ?? pages[0];

  return (
    <div
      className="vf-mobile-dashboard"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
    >
      <div key={page.key} className="vf-mobile-page" aria-live="polite">
        <div className="vf-mobile-page-heading">
          <h2 className="truncate text-sm font-semibold tracking-wide text-muted-foreground">
            {page.title}
          </h2>
          <span className="vf-data text-[11px] text-muted-foreground">
            {pageIndex + 1}/{pages.length}
          </span>
        </div>
        <div className="vf-mobile-grid grid grid-cols-2">
          {page.placements.map((placement) => (
            <div
              key={placement.id}
              className="relative min-h-0"
              style={{
                gridColumn: `${placement.col + 1} / span ${placement.colSpan}`,
                gridRow: `${placement.row + 1} / span ${placement.rowSpan}`,
              }}
            >
              {placement.node}
            </div>
          ))}
        </div>
      </div>
      {pages.length > 1 ? (
        <nav className="vf-mobile-pager" aria-label={t("dashboardPages")}>
          {pages.map((item, index) => (
            <button
              key={item.key}
              type="button"
              aria-label={`${item.title} ${index + 1}/${pages.length}`}
              aria-current={index === pageIndex ? "page" : undefined}
              className={cn(
                "vf-mobile-pager-dot",
                index === pageIndex && "vf-mobile-pager-dot-active",
              )}
              onClick={() => goToPage(index)}
            />
          ))}
        </nav>
      ) : null}
    </div>
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
  const { t, config: appearanceConfig } = useAppearance();
  const { sections, widgets, setSections, setWidgets } = useDashboardOrder();
  const handheldViewport = useHandheldViewport();
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

  const sectionModels: Record<DashboardSectionId, DashboardSectionModel> = {
    cpu: {
      id: "cpu",
      title: t("cpu"),
      items: {
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
              className="vf-mobile-load-card"
              items={[
                { label: t("load5s"), value: load5s, target: 70 },
                { label: t("load5m"), value: load5m, target: 70 },
                { label: t("load15m"), value: load15m, target: 70 },
              ]}
            />
          ),
        },
        spark: {
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
          node: (
            <div className="vf-surface vf-widget-1x justify-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("cpuTemp")}
              </p>
              <p className="vf-data mt-1 text-2xl font-semibold tracking-tight">
                {formatTemp(cpu?.temperature_c, naLabel)}
              </p>
            </div>
          ),
        },
      },
    },
    memory: {
      id: "memory",
      title: t("memory"),
      items: {
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
            <div className="vf-surface vf-widget-1x justify-center space-y-1.5 text-sm">
              <Row k={t("model")} v={na(memModel, naLabel)} />
              <Row k={t("frequency")} v={formatMhz(memSpeed, naLabel)} />
              <Row k={t("memTemp")} v={formatTemp(mem?.temperature_c, naLabel)} />
            </div>
          ),
        },
      },
    },
    temp: {
      id: "temp",
      title: t("temperature"),
      className: "landscape:col-span-2",
      items: {
        cpuScatter: {
          height: 2,
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
          height: 2,
          node: (
            <RoundedScatter
              title={t("memTempTrend")}
              theme={theme}
              emptyLabel={t("noTempData")}
              series={[{ name: t("memTemp"), data: memTempScatter }]}
            />
          ),
        },
      },
    },
    gpu: {
      id: "gpu",
      title: t("gpu"),
      items: {
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
            <div className="vf-surface vf-widget-1x justify-center space-y-1.5 text-sm">
              <Row k={t("model")} v={na(gpu?.name, naLabel)} />
              <Row k={t("temperature")} v={formatTemp(gpu?.temperature_c, naLabel)} />
              <Row k={t("memClock")} v={formatMhz(gpu?.memory_clock_mhz, naLabel)} />
              <Row k={t("coreClock")} v={formatMhz(gpu?.core_clock_mhz, naLabel)} />
            </div>
          ),
        },
      },
    },
    disk: {
      id: "disk",
      title: t("diskCount", { count: disks.length }),
      items: {
        treemap: {
          span: 2,
          height: 2,
          node:
            disks.length === 0 ? (
              <div
                className="vf-surface vf-widget-2x items-center justify-center text-sm text-muted-foreground"
                style={{ borderStyle: "dashed", opacity: 0.85 }}
              >
                {t("noDiskData")}
              </div>
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
          height: 2,
          node:
            disks.length === 0 ? null : (
              <div className="vf-surface vf-widget-2x gap-2 overflow-y-auto">
                {disks.slice(0, 4).map((d) => (
                  <div key={d.name} className="vf-row shrink-0 px-3 py-2 text-sm">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {na(d.model, naLabel)} · {na(d.kind, naLabel)} · {formatBytes(d.total_bytes, naLabel)}
                    </p>
                    <div className="mt-1.5 flex gap-3 text-xs">
                      <span className="vf-data">{t("read", { value: formatBps(d.read_bps, naLabel) })}</span>
                      <span className="vf-data">{t("write", { value: formatBps(d.write_bps, naLabel) })}</span>
                    </div>
                  </div>
                ))}
              </div>
            ),
        },
      },
    },
    network: {
      id: "network",
      title: t("network"),
      className: "landscape:col-span-2",
      items: {
        area: {
          span: 2,
          height: 2,
          node: <AreaTrend title={t("netDownTotal")} data={netRxSeries} theme={theme} />,
        },
        nics: {
          span: 2,
          node: (
            <div className="vf-surface vf-widget-1x gap-1.5 overflow-y-auto">
              {nets.length === 0 ? (
                <p className="m-auto text-sm text-muted-foreground">{t("noNetworkData")}</p>
              ) : (
                <div className="grid h-full min-h-0 grid-cols-2 gap-1.5">
                  {nets.slice(0, 4).map((n) => (
                    <div
                      key={n.name}
                      className="vf-row flex min-h-0 flex-col justify-center px-2.5 py-1.5"
                    >
                      <p className="truncate text-xs font-medium">{n.name}</p>
                      <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground">
                        <span className="vf-data truncate">↓ {formatBps(n.rx_bps, naLabel)}</span>
                        <span className="vf-data truncate">↑ {formatBps(n.tx_bps, naLabel)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        },
      },
    },
  };

  const mobilePages = packMobilePages(sections, widgets, sectionModels);
  const isMobileCardMode = handheldViewport && appearanceConfig.mobile_card_mode;

  if (isMobileCardMode) {
    return (
      <MobileDashboard
        pages={mobilePages}
        autoCarousel={appearanceConfig.mobile_auto_carousel}
        intervalSeconds={appearanceConfig.mobile_carousel_interval_s}
        t={t}
      />
    );
  }

  const sectionNodes: Record<DashboardSectionId, ReactNode> = Object.fromEntries(
    (Object.keys(sectionModels) as DashboardSectionId[]).map((id) => {
      const model = sectionModels[id];
      return [
        id,
        <SortableSection key={id} id={id} title={model.title} className={model.className}>
          <WidgetGrid
            sectionId={id}
            order={widgets[id]}
            onReorder={(next) => setWidgets(id, next)}
            items={model.items}
          />
        </SortableSection>,
      ];
    }),
  ) as Record<DashboardSectionId, ReactNode>;

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
