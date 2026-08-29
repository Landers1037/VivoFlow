import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useAppearance } from "@/hooks/useAppearance";
import { useClockNow } from "@/hooks/useClockNow";
import { cn } from "@/lib/utils";
import { formatClockDate, formatClockWeek, getClockParts } from "@/lib/clock";
import type { ClockDotShape, ClockStyle, ClockTimezoneOffsetMinutes, Lang } from "@/types";

const DIAL_MARKS = [12, 3, 6, 9] as const;

export function ClockPage() {
  const { config, lang } = useAppearance();
  const now = useClockNow(config.clock_show_seconds);
  const style = config.clock_style;
  const meta = {
    week: config.clock_show_week,
    date: config.clock_show_date,
    seconds: config.clock_show_seconds,
    timezoneOffsetMinutes: config.clock_timezone_offset_minutes,
  };

  return (
    <div className="clock-page" data-clock-style={style}>
      {style === "lines" ? <LinesFace now={now} lang={lang} {...meta} /> : null}
      {style === "dial" ? <DialFace now={now} lang={lang} {...meta} /> : null}
      {style === "pixel" ? <PixelFace now={now} lang={lang} {...meta} /> : null}
      {style === "flip" ? <FlipFace now={now} lang={lang} {...meta} /> : null}
      {style === "object" ? <ObjectFace now={now} {...meta} /> : null}
      {style === "dots" ? <DotsFace now={now} lang={lang} shape={config.clock_dot_shape} {...meta} /> : null}
    </div>
  );
}

function MetaLine({
  now,
  lang,
  week,
  date,
  timezoneOffsetMinutes,
  className,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  timezoneOffsetMinutes: ClockTimezoneOffsetMinutes;
  className?: string;
}) {
  if (!week && !date) return null;
  return (
    <p className={cn("clock-meta", className)}>
      {week ? <span>{formatClockWeek(now, lang, timezoneOffsetMinutes)}</span> : null}
      {week && date ? <span className="clock-meta-gap" /> : null}
      {date ? <span>{formatClockDate(now, lang, timezoneOffsetMinutes)}</span> : null}
    </p>
  );
}

function LinesFace({
  now,
  lang,
  week,
  date,
  seconds,
  timezoneOffsetMinutes,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
  timezoneOffsetMinutes: ClockTimezoneOffsetMinutes;
}) {
  const { h, m, s } = getClockParts(now, timezoneOffsetMinutes);
  return (
    <div className="clock-lines">
      <MetaLine now={now} lang={lang} week={week} date={date} timezoneOffsetMinutes={timezoneOffsetMinutes} />
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
  timezoneOffsetMinutes,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
  timezoneOffsetMinutes: ClockTimezoneOffsetMinutes;
}) {
  const { h, m, s, day } = getClockParts(now, timezoneOffsetMinutes);
  const hours = Number(h) % 12;
  const minutes = Number(m);
  const secs = Number(s);
  const hourDeg = hours * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + (seconds ? secs * 0.1 : 0);
  const secondDeg = secs * 6;

  return (
    <div className="clock-dial-wrap">
      {week ? <p className="clock-dial-week">{formatClockWeek(now, lang, timezoneOffsetMinutes)}</p> : null}
      <div className="clock-dial" role="img" aria-label={`${h}:${m}${seconds ? `:${s}` : ""}`}>
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
        {date ? <span className="clock-dial-window">{day}</span> : null}
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
  timezoneOffsetMinutes,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
  timezoneOffsetMinutes: ClockTimezoneOffsetMinutes;
}) {
  const { h, m, s, day, month } = getClockParts(now, timezoneOffsetMinutes);
  return (
    <div className="clock-pixel">
      {week || date ? (
        <p className="clock-pixel-meta">
          {week ? formatClockWeek(now, lang, timezoneOffsetMinutes) : null}
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
  timezoneOffsetMinutes,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
  timezoneOffsetMinutes: ClockTimezoneOffsetMinutes;
}) {
  const { h, m, s } = getClockParts(now, timezoneOffsetMinutes);
  return (
    <div className="clock-flip">
      <MetaLine now={now} lang={lang} week={week} date={date} timezoneOffsetMinutes={timezoneOffsetMinutes} />
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
  timezoneOffsetMinutes,
}: {
  now: Date;
  week: boolean;
  date: boolean;
  seconds: boolean;
  timezoneOffsetMinutes: ClockTimezoneOffsetMinutes;
}) {
  const { h, m, s, day, month, weekdayLcd } = getClockParts(now, timezoneOffsetMinutes);
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

function DotsFace({
  now,
  lang,
  week,
  date,
  seconds,
  shape,
  timezoneOffsetMinutes,
}: {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
  shape: ClockDotShape;
  timezoneOffsetMinutes: ClockTimezoneOffsetMinutes;
}) {
  const { t } = useAppearance();
  const { h, m, s } = getClockParts(now, timezoneOffsetMinutes);
  const hours = Number(h);
  const minutes = Number(m);
  const secs = Number(s);

  return (
    <div className="clock-dots" data-dot-shape={shape}>
      <MetaLine now={now} lang={lang} week={week} date={date} timezoneOffsetMinutes={timezoneOffsetMinutes} />
      <span className="sr-only">
        {h}:{m}
        {seconds ? `:${s}` : ""}
      </span>
      <div className="clock-dots-bands">
        <DotBand kind="hour" label={t("clockHour")} total={24} filled={hours + 1} />
        <DotBand kind="minute" label={t("clockMinute")} total={60} filled={minutes + 1} />
        {seconds ? <DotBand kind="second" label={t("clockSecond")} total={60} filled={secs + 1} /> : null}
      </div>
    </div>
  );
}

function DotBand({
  kind,
  label,
  total,
  filled,
}: {
  kind: "hour" | "minute" | "second";
  label: string;
  total: number;
  filled: number;
}) {
  const on = Math.min(filled, total);
  return (
    <div className={cn("clock-dots-band", `is-${kind}`)}>
      <p className="clock-dots-label">{label}</p>
      <div className="clock-dots-grid" role="img" aria-label={`${label} ${on} / ${total}`}>
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={cn("clock-dot", index < on && "is-on")} />
        ))}
      </div>
    </div>
  );
}

export const CLOCK_STYLE_OPTIONS: {
  id: ClockStyle;
  nameKey: "clockStyleLines" | "clockStyleDial" | "clockStylePixel" | "clockStyleFlip" | "clockStyleObject" | "clockStyleDots";
}[] = [
  { id: "lines", nameKey: "clockStyleLines" },
  { id: "dial", nameKey: "clockStyleDial" },
  { id: "pixel", nameKey: "clockStylePixel" },
  { id: "flip", nameKey: "clockStyleFlip" },
  { id: "object", nameKey: "clockStyleObject" },
  { id: "dots", nameKey: "clockStyleDots" },
];

export const CLOCK_DOT_SHAPE_OPTIONS: {
  id: ClockDotShape;
  nameKey: "clockDotCircle" | "clockDotSquare" | "clockDotRounded" | "clockDotStar";
}[] = [
  { id: "circle", nameKey: "clockDotCircle" },
  { id: "square", nameKey: "clockDotSquare" },
  { id: "rounded", nameKey: "clockDotRounded" },
  { id: "star", nameKey: "clockDotStar" },
];
