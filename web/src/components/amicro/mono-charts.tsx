import { Area, AreaChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

const mono = (theme: Theme) =>
  theme === "dark"
    ? { stroke: "#e5e5e5", fill: "#a3a3a3", track: "#2a2a2a", text: "#f5f5f5", muted: "#a3a3a3" }
    : { stroke: "#171717", fill: "#525252", track: "#e5e5e5", text: "#171717", muted: "#737373" };

export function MonoKpiCard({
  title,
  value,
  subtitle,
  data,
  theme = "dark",
  className,
}: {
  title: string;
  value: string;
  subtitle?: string;
  data: { v: number }[];
  theme?: Theme;
  className?: string;
}) {
  const c = mono(theme);
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: c.text }}>
            {value}
          </p>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          KPI
        </span>
      </div>
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.length ? data : [{ v: 0 }]}>
            <defs>
              <linearGradient id={`kpi-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.fill} stopOpacity={0.45} />
                <stop offset="100%" stopColor={c.fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={c.stroke}
              strokeWidth={1.5}
              fill={`url(#kpi-${title})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MonoSparklineRow({
  name,
  value,
  data,
  theme = "dark",
}: {
  name: string;
  value: string;
  data: { x: number; y: number }[];
  theme?: Theme;
}) {
  const c = mono(theme);
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{name}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
      <div className="h-10 w-24 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.length ? data : [{ x: 0, y: 0 }]}>
            <Line
              type="monotone"
              dataKey="y"
              stroke={c.stroke}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MonoGaugeArc({
  label,
  value,
  display,
  theme = "dark",
  className,
}: {
  label: string;
  value: number;
  display: string;
  theme?: Theme;
  className?: string;
}) {
  const c = mono(theme);
  const clamped = Math.max(0, Math.min(100, value));
  const data = [
    { name: "Active", value: clamped },
    { name: "Rest", value: 100 - clamped },
  ];
  return (
    <div
      className={cn(
        "relative flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      <p className="mb-1 self-start text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="relative h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Soft Arc Caps — same approach as Amicro MonoRoundedGaugeArc */}
            <Pie
              data={data}
              dataKey="value"
              startAngle={210}
              endAngle={-30}
              innerRadius="68%"
              outerRadius="88%"
              cornerRadius={8}
              paddingAngle={4}
              strokeLinecap="round"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={c.stroke} />
              <Cell fill={c.track} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className="text-2xl font-semibold tracking-tight">{display}</span>
        </div>
      </div>
    </div>
  );
}

export function MonoAreaTrend({
  title,
  data,
  theme = "dark",
  className,
}: {
  title: string;
  data: { t: number; v: number }[];
  theme?: Theme;
  className?: string;
}) {
  const c = mono(theme);
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.length ? data : [{ t: 0, v: 0 }]}>
            <defs>
              <linearGradient id={`trend-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.fill} stopOpacity={0.4} />
                <stop offset="100%" stopColor={c.fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={c.stroke}
              strokeWidth={1.6}
              fill={`url(#trend-${title})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
