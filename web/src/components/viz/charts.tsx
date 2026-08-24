import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useAppearance } from "@/hooks/useAppearance";
import { useHandheldViewport } from "@/hooks/useMobileViewport";
import type { UiStyle } from "@/types";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

const mono = (theme: Theme) =>
  theme === "dark"
    ? { stroke: "#e5e5e5", fill: "#a3a3a3", track: "#2a2a2a", text: "#f5f5f5", muted: "#a3a3a3" }
    : { stroke: "#171717", fill: "#525252", track: "#e5e5e5", text: "#171717", muted: "#737373" };

function useUiStyle(): UiStyle {
  return useAppearance().config.ui_style;
}

function curveType(style: UiStyle): "monotone" | "linear" | "stepAfter" {
  if (style === "console" || style === "hud" || style === "dense") return "stepAfter";
  if (style === "line" || style === "ink" || style === "swiss") return "linear";
  return "monotone";
}

function strokeWidth(style: UiStyle): number {
  if (style === "neumorph" || style === "clay" || style === "ink") return 2;
  if (style === "instrument") return 1.8;
  if (style === "line" || style === "swiss" || style === "dense") return 1.2;
  if (style === "console" || style === "hud") return 1.35;
  return 1.5;
}

function fillOpacity(style: UiStyle, theme: Theme): number {
  if (style === "line" || style === "ink") return theme === "dark" ? 0.08 : 0.05;
  if (style === "swiss") return 0.12;
  if (style === "console" || style === "hud" || style === "instrument") return 0.18;
  if (style === "neumorph" || style === "clay") return 0.28;
  if (style === "glass") return 0.35;
  if (style === "dense" || style === "editorial" || style === "paper" || style === "metal") {
    return 0.22;
  }
  return 0.45;
}

function cornerRadius(style: UiStyle): number {
  if (style === "line" || style === "ink" || style === "swiss" || style === "hud") return 0;
  if (style === "console" || style === "dense") return 2;
  if (style === "instrument") return 12;
  return 8;
}

function usesPrimaryStroke(style: UiStyle): boolean {
  return (
    style === "console" ||
    style === "glass" ||
    style === "hud" ||
    style === "instrument" ||
    style === "clay" ||
    style === "metal"
  );
}

function chartStroke(style: UiStyle, c: ReturnType<typeof mono>): string {
  if (usesPrimaryStroke(style)) return "var(--primary)";
  return c.stroke;
}

function chartFill(style: UiStyle, c: ReturnType<typeof mono>): string {
  if (usesPrimaryStroke(style)) return "var(--primary)";
  return c.fill;
}

function tileClass(tile: 1 | 2 = 1, className?: string) {
  return cn(tile === 2 ? "vf-widget-2x" : "vf-widget-1x", className);
}

export function KpiCard({
  title,
  value,
  subtitle,
  data,
  theme = "dark",
  tile = 1,
  className,
}: {
  title: string;
  value: string;
  subtitle?: string;
  data: { v: number }[];
  theme?: Theme;
  tile?: 1 | 2;
  className?: string;
}) {
  const style = useUiStyle();
  const c = mono(theme);
  const stroke = chartStroke(style, c);
  const fill = chartFill(style, c);
  const opacity = fillOpacity(style, theme);
  const gid = `kpi-${title.replace(/\s+/g, "-")}`;

  return (
    <div className={cn("vf-kpi overflow-hidden", tileClass(tile, className))}>
      <div className="mb-1.5 flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p
            className="vf-data mt-0.5 text-2xl font-semibold tracking-tight"
            style={{ color: usesPrimaryStroke(style) ? undefined : c.text }}
          >
            {value}
          </p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <span
          className="shrink-0 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          style={{ borderRadius: "var(--kpi-badge-radius)" }}
        >
          KPI
        </span>
      </div>
      <div className="vf-widget-body">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.length ? data : [{ v: 0 }]}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} stopOpacity={opacity} />
                <stop offset="100%" stopColor={fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type={curveType(style)}
              dataKey="v"
              stroke={stroke}
              strokeWidth={strokeWidth(style)}
              fill={
                style === "line" || style === "ink" ? "transparent" : `url(#${gid})`
              }
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SparklineRow({
  name,
  value,
  data,
  theme = "dark",
  tile = 1,
  className,
}: {
  name: string;
  value: string;
  data: { x: number; y: number }[];
  theme?: Theme;
  tile?: 1 | 2;
  className?: string;
}) {
  const style = useUiStyle();
  const c = mono(theme);
  const stroke = chartStroke(style, c);

  return (
    <div className={cn("vf-surface overflow-hidden", tileClass(tile, className))}>
      <div className="mb-1 shrink-0">
        <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
          {name}
        </p>
        <p className="vf-data mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
      </div>
      <div className="vf-widget-body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.length ? data : [{ x: 0, y: 0 }]}>
            <Line
              type={curveType(style)}
              dataKey="y"
              stroke={stroke}
              strokeWidth={strokeWidth(style)}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GaugeArc({
  label,
  value,
  display,
  theme = "dark",
  tile = 1,
  className,
}: {
  label: string;
  value: number;
  display: string;
  theme?: Theme;
  tile?: 1 | 2;
  className?: string;
}) {
  const style = useUiStyle();
  const handheldViewport = useHandheldViewport();
  const c = mono(theme);
  const active = chartStroke(style, c);
  const clamped = Math.max(0, Math.min(100, value));
  const data = [
    { name: "Active", value: clamped },
    { name: "Rest", value: 100 - clamped },
  ];
  return (
    <div
      className={cn(
        "vf-gauge vf-kpi relative items-center overflow-visible",
        tileClass(tile, className),
      )}
    >
      <p className="mb-1 w-full shrink-0 self-start text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="vf-widget-body relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={210}
              endAngle={-30}
              innerRadius={handheldViewport ? "90%" : "84%"}
              outerRadius={handheldViewport ? "150%" : "88%"}
              cornerRadius={cornerRadius(style)}
              paddingAngle={style === "line" ? 2 : 4}
              strokeLinecap="round"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={active} />
              <Cell fill={c.track} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-3">
          <span className="vf-data text-xl font-semibold tracking-tight">{display}</span>
        </div>
      </div>
    </div>
  );
}

export function AreaTrend({
  title,
  data,
  theme = "dark",
  tile = 2,
  className,
}: {
  title: string;
  data: { t: number; v: number }[];
  theme?: Theme;
  tile?: 1 | 2;
  className?: string;
}) {
  const style = useUiStyle();
  const c = mono(theme);
  const stroke = chartStroke(style, c);
  const fill = chartFill(style, c);
  const opacity = fillOpacity(style, theme);
  const gid = `trend-${title.replace(/\s+/g, "-")}`;

  return (
    <div className={cn("vf-surface overflow-hidden", tileClass(tile, className))}>
      <p className="mb-1.5 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="vf-widget-body">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.length ? data : [{ t: 0, v: 0 }]}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} stopOpacity={opacity} />
                <stop offset="100%" stopColor={fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type={curveType(style)}
              dataKey="v"
              stroke={stroke}
              strokeWidth={strokeWidth(style)}
              fill={
                style === "line" || style === "ink" ? "transparent" : `url(#${gid})`
              }
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** @deprecated Prefer named exports from `@/components/viz` */
export const MonoKpiCard = KpiCard;
export const MonoSparklineRow = SparklineRow;
export const MonoGaugeArc = GaugeArc;
export const MonoAreaTrend = AreaTrend;

/** Amicro Mono Performance Bullet Target — rounded pill tracks with target tick */
export function RoundedBullet({
  title,
  items,
  domainMax = 100,
  theme = "dark",
  tile = 1,
  className,
}: {
  title: string;
  items: { label: string; value: number; target?: number }[];
  domainMax?: number;
  theme?: Theme;
  tile?: 1 | 2;
  className?: string;
}) {
  const style = useUiStyle();
  const c = mono(theme);
  const stroke = chartStroke(style, c);
  const track = c.track;
  const max = Math.max(domainMax, ...items.map((i) => Math.max(i.value, i.target ?? 0)), 1);

  return (
    <div className={cn("vf-surface overflow-hidden", tileClass(tile, className))}>
      <p className="mb-1 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="vf-widget-body flex flex-col justify-evenly gap-1.5">
        {items.map((item) => {
          const pct = Math.max(0, Math.min(100, (item.value / max) * 100));
          const targetPct =
            item.target != null ? Math.max(0, Math.min(100, (item.target / max) * 100)) : null;
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="vf-data font-medium tabular-nums">
                  {item.value.toFixed(1)}
                  {item.target != null ? (
                    <span className="text-muted-foreground"> / {item.target.toFixed(0)}</span>
                  ) : null}
                </span>
              </div>
              <div
                className="relative h-2.5 w-full overflow-hidden"
                style={{
                  background: track,
                  borderRadius: style === "line" || style === "swiss" || style === "hud" ? 0 : 999,
                }}
              >
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${pct}%`,
                    background: stroke,
                    borderRadius:
                      style === "line" || style === "swiss" || style === "hud" ? 0 : 999,
                  }}
                />
                {targetPct != null ? (
                  <span
                    className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full"
                    style={{
                      left: `calc(${targetPct}% - 1px)`,
                      background: c.text,
                      opacity: 0.85,
                    }}
                    aria-hidden
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Amicro Mono Scatter Matrix — rounded nodes for temperature over time */
export function RoundedScatter({
  title,
  series,
  theme = "dark",
  tile = 2,
  className,
  emptyLabel,
}: {
  title: string;
  series: { name: string; color?: string; data: { x: number; y: number }[] }[];
  theme?: Theme;
  tile?: 1 | 2;
  className?: string;
  emptyLabel?: string;
}) {
  const style = useUiStyle();
  const c = mono(theme);
  const primary = chartStroke(style, c);
  const secondary = theme === "dark" ? "#a3a3a3" : "#525252";
  const hasPoints = series.some((s) => s.data.length > 0);

  return (
    <div className={cn("vf-surface overflow-hidden", tileClass(tile, className))}>
      <div className="mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          {series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: s.color ?? (i === 0 ? primary : secondary) }}
              />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      {!hasPoints ? (
        <p className="vf-widget-body flex items-center justify-center text-center text-sm text-muted-foreground">
          {emptyLabel ?? "—"}
        </p>
      ) : (
        <div className="vf-widget-body">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              {style === "hud" || style === "console" || style === "dense" ? (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={c.track}
                  vertical={false}
                />
              ) : null}
              <XAxis
                type="number"
                dataKey="x"
                name="min"
                unit="m"
                tickLine={false}
                axisLine={false}
                tick={{ fill: c.muted, fontSize: 10 }}
                tickFormatter={(v) => String(v)}
                allowDecimals={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="°C"
                unit="°"
                width={36}
                tickLine={false}
                axisLine={false}
                tick={{ fill: c.muted, fontSize: 10 }}
                domain={["auto", "auto"]}
              />
              <ZAxis range={[64, 64]} />
              {series.map((s, i) => (
                <Scatter
                  key={s.name}
                  name={s.name}
                  data={s.data}
                  fill={s.color ?? (i === 0 ? primary : secondary)}
                  fillOpacity={0.85}
                  isAnimationActive={false}
                  shape="circle"
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export const MonoRoundedBullet = RoundedBullet;
export const MonoRoundedScatter = RoundedScatter;

type TreemapNode = {
  name: string;
  size: number;
  label?: string;
};

type TreemapContentProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  label?: string;
  value?: number;
  index?: number;
  depth?: number;
  root?: { children?: { value?: number }[] };
  radius: number;
  theme: Theme;
};

/** Bigger share → lighter gray (Amicro mono tile). Text flips for contrast. */
function grayTileColors(share: number, theme: Theme) {
  const t = Math.max(0, Math.min(1, share));
  // dark: 0.24 → 0.94 ; light: 0.38 → 0.78 (stay readable on white card)
  const L = theme === "dark" ? 0.24 + t * 0.7 : 0.38 + t * 0.4;
  const fill = `oklch(${L.toFixed(3)} 0 0)`;
  const onLight = L >= 0.55;
  return {
    fill,
    text: onLight ? "#171717" : "#f5f5f5",
    muted: onLight ? "#404040" : "#d4d4d4",
  };
}

function TreemapTile(props: TreemapContentProps) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    name = "",
    label,
    value = 0,
    depth = 0,
    root,
    radius,
    theme,
  } = props;

  if (depth !== 1 || width <= 1 || height <= 1) return null;

  const children = root?.children ?? [];
  const total = children.reduce((sum, ch) => sum + (Number(ch.value) || 0), 0);
  const share = children.length <= 1 || total <= 0 ? 1 : value / total;
  const { fill, text, muted } = grayTileColors(share, theme);

  const showText = width > 48 && height > 28;
  const showSub = width > 72 && height > 42;
  const gap = 2;

  return (
    <g>
      <rect
        x={x + gap}
        y={y + gap}
        width={Math.max(0, width - gap * 2)}
        height={Math.max(0, height - gap * 2)}
        rx={radius}
        ry={radius}
        fill={fill}
      />
      {showText ? (
        <text
          x={x + 10}
          y={y + 18}
          fill={text}
          fontSize={11}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {name.length > 14 ? `${name.slice(0, 12)}…` : name}
        </text>
      ) : null}
      {showSub && label ? (
        <text
          x={x + 10}
          y={y + 34}
          fill={muted}
          fontSize={10}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Amicro Mono Tile Treemap — rounded gray tiles; depth by capacity share */
export function RoundedTreemap({
  title,
  data,
  theme = "dark",
  tile = 2,
  className,
  emptyLabel,
}: {
  title: string;
  data: TreemapNode[];
  theme?: Theme;
  tile?: 1 | 2;
  className?: string;
  emptyLabel?: string;
}) {
  const style = useUiStyle();
  const radius =
    style === "line" || style === "swiss" || style === "hud"
      ? 0
      : style === "console" || style === "dense"
        ? 4
        : 12;

  const nodes = data.filter((d) => d.size > 0);

  return (
    <div className={cn("vf-surface overflow-hidden", tileClass(tile, className))}>
      <p className="mb-1.5 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {nodes.length === 0 ? (
        <p className="vf-widget-body flex items-center justify-center text-center text-sm text-muted-foreground">
          {emptyLabel ?? "—"}
        </p>
      ) : (
        <div className="vf-widget-body">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={nodes}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="transparent"
              isAnimationActive={false}
              content={
                (<TreemapTile radius={radius} theme={theme} />) as never
              }
            />
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export const MonoRoundedTreemap = RoundedTreemap;
