import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { ClockStyle, Lang } from "@/types";

const WEEKDAYS_LCD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const DIAL_MARKS = [12, 3, 6, 9] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function useClockNow(showSeconds: boolean) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const ms = Date.now();
      const delay = showSeconds ? 1000 - (ms % 1000) : 60_000 - (ms % 60_000);
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, Math.max(40, delay + 8));
    };
    setNow(new Date());
    schedule();
    return () => window.clearTimeout(timer);
  }, [showSeconds]);

  return now;
}

function formatWeek(now: Date, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", { weekday: "short" }).format(now);
}

function formatDate(now: Date, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
  }).format(now);
}

function parts(now: Date) {
  return {
    h: pad2(now.getHours()),
    m: pad2(now.getMinutes()),
    s: pad2(now.getSeconds()),
    day: pad2(now.getDate()),
    month: pad2(now.getMonth() + 1),
    weekdayLcd: WEEKDAYS_LCD[now.getDay()] ?? "SUN",
  };
}

export function ClockPage() {
  const { config, lang } = useAppearance();
  const now = useClockNow(config.clock_show_seconds);
  const style = config.clock_style;
  const meta = { week: config.clock_show_week, date: config.clock_show_date, seconds: config.clock_show_seconds };

  return (
    <div className="clock-page" data-clock-style={style}>
      {style === "lines" ? <LinesFace now={now} lang={lang} {...meta} /> : null}
      {style === "dial" ? <DialFace now={now} lang={lang} {...meta} /> : null}
      {style === "pixel" ? <PixelFace now={now} lang={lang} {...meta} /> : null}
      {style === "flip" ? <FlipFace now={now} lang={lang} {...meta} /> : null}
      {style === "object" ? <ObjectFace now={now} {...meta} /> : null}
    </div>
  );
}

function MetaLine({
  now,
  lang,
  week,
  date,
  className,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  className?: string;
}) {
  if (!week && !date) return null;
  return (
    <p className={cn("clock-meta", className)}>
      {week ? <span>{formatWeek(now, lang)}</span> : null}
      {week && date ? <span className="clock-meta-gap" /> : null}
      {date ? <span>{formatDate(now, lang)}</span> : null}
    </p>
  );
}

function LinesFace({
  now,
  lang,
  week,
  date,
  seconds,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
}) {
  const { h, m, s } = parts(now);
  return (
    <div className="clock-lines">
      <MetaLine now={now} lang={lang} week={week} date={date} />
      <p className="clock-lines-time" aria-hidden="true">
        <span>{h}</span>
        <span>{m}</span>
        {seconds ? <span>{s}</span> : null}
      </p>
      <span className="sr-only">
        {h}:{m}
        {seconds ? `:${s}` : ""}
      </span>
    </div>
  );
}

function DialFace({
  now,
  lang,
  week,
  date,
  seconds,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
}) {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const secs = now.getSeconds();
  const hourDeg = hours * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + (seconds ? secs * 0.1 : 0);
  const secondDeg = secs * 6;

  return (
    <div className="clock-dial-wrap">
      {week ? <p className="clock-dial-week">{formatWeek(now, lang)}</p> : null}
      <div className="clock-dial" role="img" aria-label={`${pad2(now.getHours())}:${pad2(minutes)}${seconds ? `:${pad2(secs)}` : ""}`}>
        {Array.from({ length: 60 }, (_, index) => (
          <span
            key={index}
            className={cn("clock-dial-tick", index % 5 === 0 && "is-hour")}
            style={{ transform: `rotate(${index * 6}deg)` }}
          />
        ))}
        {DIAL_MARKS.map((mark) => (
          <span
            key={mark}
            className="clock-dial-num-slot"
            style={{ transform: `rotate(${(mark % 12) * 30}deg)` }}
          >
            <span
              className="clock-dial-num"
              style={{ transform: `translateX(-50%) rotate(${-((mark % 12) * 30)}deg)` }}
            >
              {mark}
            </span>
          </span>
        ))}
        {date ? <span className="clock-dial-window">{pad2(now.getDate())}</span> : null}
        <span className="clock-dial-hand is-hour" style={{ transform: `translateX(-50%) rotate(${hourDeg}deg)` }} />
        <span className="clock-dial-hand is-minute" style={{ transform: `translateX(-50%) rotate(${minuteDeg}deg)` }} />
        {seconds ? (
          <span className="clock-dial-hand is-second" style={{ transform: `translateX(-50%) rotate(${secondDeg}deg)` }} />
        ) : null}
        <span className="clock-dial-cap" />
      </div>
    </div>
  );
}

function PixelFace({
  now,
  lang,
  week,
  date,
  seconds,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
}) {
  const { h, m, s, day, month } = parts(now);
  return (
    <div className="clock-pixel">
      {week || date ? (
        <p className="clock-pixel-meta">
          {week ? formatWeek(now, lang) : null}
          {week && date ? "  " : null}
          {date ? `${month}.${day}` : null}
        </p>
      ) : null}
      <p className="clock-pixel-time">
        {h}:{m}
        {seconds ? `:${s}` : ""}
      </p>
    </div>
  );
}

function FlipFace({
  now,
  lang,
  week,
  date,
  seconds,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
}) {
  const { h, m, s } = parts(now);
  return (
    <div className="clock-flip">
      <MetaLine now={now} lang={lang} week={week} date={date} />
      <div className="clock-flip-row">
        <FlipUnit label="HOUR" value={h} />
        <FlipUnit label="MIN" value={m} />
        {seconds ? <FlipUnit label="SEC" value={s} /> : null}
      </div>
    </div>
  );
}

function FlipUnit({ label, value }: { label: string; value: string }) {
  return (
    <div className="clock-flip-unit">
      <div className="clock-flip-pair">
        <FlipDigit value={value[0] ?? "0"} />
        <FlipDigit value={value[1] ?? "0"} />
      </div>
      <span className="clock-flip-label">{label}</span>
    </div>
  );
}

function FlipDigit({ value }: { value: string }) {
  const reduce = useReducedMotion();
  const [current, setCurrent] = useState(value);
  const [incoming, setIncoming] = useState(value);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (value === current) return;
    if (reduce) {
      setCurrent(value);
      setIncoming(value);
      setFlipping(false);
      return;
    }
    setIncoming(value);
    setFlipping(true);
    const timer = window.setTimeout(() => {
      setCurrent(value);
      setFlipping(false);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [value, current, reduce]);

  return (
    <span className={cn("clock-flip-digit", flipping && "is-flipping")}>
      <span className="clock-flip-static is-top">{incoming}</span>
      <span className="clock-flip-static is-bottom">
        <span>{current}</span>
      </span>
      <span className="clock-flip-leaf is-upper">{current}</span>
      <span className="clock-flip-leaf is-lower">
        <span>{incoming}</span>
      </span>
    </span>
  );
}

function ObjectFace({
  now,
  week,
  date,
  seconds,
}: {
  now: Date;
  week: boolean;
  date: boolean;
  seconds: boolean;
}) {
  const { h, m, s, day, month, weekdayLcd } = parts(now);
  const time = seconds ? `${h}:${m}:${s}` : `${h}:${m}`;
  const ghost = seconds ? "88:88:88" : "88:88";

  return (
    <div className="clock-object">
      <div className="clock-object-bezel">
        {(week || date) ? (
          <div className="clock-object-aux">
            {week ? (
              <span className="clock-lcd clock-lcd-14">
                <span className="clock-lcd-ghost">~~~</span>
                <span>{weekdayLcd}</span>
              </span>
            ) : (
              <span />
            )}
            {date ? (
              <span className="clock-lcd clock-lcd-14">
                <span className="clock-lcd-ghost">88-88</span>
                <span>
                  {month}-{day}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="clock-lcd clock-lcd-7">
          <span className="clock-lcd-ghost">{ghost}</span>
          <span>{time}</span>
        </div>
        <div className="clock-object-legend">
          <span>HOUR</span>
          <span>MIN</span>
          {seconds ? <span>SEC</span> : null}
        </div>
      </div>
    </div>
  );
}

export const CLOCK_STYLE_OPTIONS: { id: ClockStyle; nameKey: "clockStyleLines" | "clockStyleDial" | "clockStylePixel" | "clockStyleFlip" | "clockStyleObject" }[] = [
  { id: "lines", nameKey: "clockStyleLines" },
  { id: "dial", nameKey: "clockStyleDial" },
  { id: "pixel", nameKey: "clockStylePixel" },
  { id: "flip", nameKey: "clockStyleFlip" },
  { id: "object", nameKey: "clockStyleObject" },
];
