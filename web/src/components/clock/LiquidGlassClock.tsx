import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { translate } from "@/i18n/messages";
import { formatClockDate, formatClockWeek, getClockParts } from "@/lib/clock";
import { getLiquidGlassClockFontStack } from "@/lib/clockFonts";
import type { ClockFont, ClockFontWeight, ClockGlassBackground, ClockTimezoneOffsetMinutes, Lang } from "@/types";
import { ClockBackgroundRenderer } from "./ClockBackgroundRenderer";
import { GlassGlyphRenderer } from "./glass/GlassGlyphRenderer";
import { GLYPH_SIZE } from "./glass/glyphField";

export interface LiquidGlassClockProps {
  now: Date;
  lang: Lang;
  week: boolean;
  date: boolean;
  seconds: boolean;
  timezoneOffsetMinutes: ClockTimezoneOffsetMinutes;
  font: ClockFont;
  fontWeight: ClockFontWeight;
  background: ClockGlassBackground;
}

const fontSpec = (font: ClockFont, fontWeight: ClockFontWeight) => `${fontWeight} ${GLYPH_SIZE}px ${getLiquidGlassClockFontStack(font)}`;

export function LiquidGlassClock(props: LiquidGlassClockProps) {
  const { now, lang, week, date, seconds, timezoneOffsetMinutes, font, fontWeight, background } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GlassGlyphRenderer | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  const stateRef = useRef(props);
  const [failed, setFailed] = useState(false);
  const reduced = Boolean(useReducedMotion());
  const reducedRef = useRef(reduced);
  const lastFrameRef = useRef(-Infinity);
  stateRef.current = props;
  reducedRef.current = reduced;

  const fail = useCallback(() => setFailed(true), []);
  const onBackgroundFrame = useCallback((source: HTMLCanvasElement) => {
    const renderer = rendererRef.current;
    if (!renderer || document.visibilityState === "hidden") return;
    const time = performance.now();
    const mobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 600;
    if (reducedRef.current && Number.isFinite(lastFrameRef.current)) return;
    if (time - lastFrameRef.current < 1000 / (mobile ? 30 : 60) - 1) return;
    try {
      // Upload before the upstream callback returns, never from a second RAF.
      renderer.uploadBackground(source);
      lastFrameRef.current = time;
      redrawRef.current?.();
    } catch (error) {
      console.error("Liquid glass background capture failed", error);
      setFailed(true);
    }
  }, []);

  useLayoutEffect(() => {
    const host = canvasRef.current;
    const layout = layoutRef.current;
    if (!host || !layout) return;
    // A fresh canvas lets StrictMode safely dispose/recreate the WebGL context.
    const canvas = document.createElement("canvas");
    canvas.className = "clock-liquid-glass-canvas";
    host.appendChild(canvas);
    let renderer: GlassGlyphRenderer;
    try {
      renderer = new GlassGlyphRenderer(canvas);
    } catch (error) {
      console.error("Liquid glass initialization failed", error);
      canvas.remove();
      setFailed(true);
      return;
    }
    setFailed(false);
    rendererRef.current = renderer;
    lastFrameRef.current = -Infinity;
    let baseColor: [number, number, number] = [7 / 255, 16 / 255, 23 / 255];
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = colorCanvas.height = 1;
    const colorContext = colorCanvas.getContext("2d", { willReadFrequently: true });
    const draw = () => {
      if (document.visibilityState === "hidden") return;
      const state = stateRef.current;
      const parts = getClockParts(state.now, state.timezoneOffsetMinutes);
      const metadata = [
        state.week ? formatClockWeek(state.now, state.lang, state.timezoneOffsetMinutes) : "",
        state.date ? formatClockDate(state.now, state.lang, state.timezoneOffsetMinutes) : "",
      ].filter(Boolean).join(" · ");
      renderer.setFont(fontSpec(state.font, state.fontWeight));
      const bounds = layout.getBoundingClientRect();
      const outer = canvas.getBoundingClientRect();
      const hasMeta = state.week || state.date;
      // Fit wide fonts in both orientations, reserving only visible rows.
      const mainSize = Math.max(24, Math.min(270, bounds.width * 0.34, bounds.height / (1.02 + (state.seconds ? 0.43 : 0) + (hasMeta ? 0.48 : 0))));
      const fitted = Math.min(mainSize, mainSize * bounds.width / renderer.measureText("00:00", mainSize));
      const secondSize = fitted * 0.28;
      const blockHeight = fitted * 0.8 + (state.seconds ? fitted * 0.4 : 0) + (hasMeta ? fitted * 0.4 : 0);
      const top = bounds.top - outer.top + (bounds.height - blockHeight) / 2;
      const baseline = top + fitted * 0.76;
      const centerX = bounds.left - outer.left + bounds.width / 2;
      renderer.begin(baseColor);
      renderer.drawText(`${parts.h}:${parts.m}`, fitted, centerX, baseline);
      if (state.seconds) renderer.drawText(parts.s, secondSize, centerX, baseline + fitted * 0.4);
      if (metadata) {
        const preferredMetadataSize = Math.max(16, Math.min(32, fitted * 0.16));
        const metadataSize = Math.min(
          preferredMetadataSize,
          preferredMetadataSize * bounds.width / renderer.measureText(metadata, preferredMetadataSize),
        );
        renderer.drawText(
          metadata,
          metadataSize,
          centerX,
          baseline + fitted * (state.seconds ? 0.7 : 0.36),
        );
      }
    };
    const redraw = () => {
      try { draw(); } catch (error) {
        console.error("Liquid glass composition failed", error);
        setFailed(true);
      }
    };
    redrawRef.current = redraw;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const mobile = window.matchMedia("(pointer: coarse)").matches || bounds.width <= 600;
      renderer.resize(Math.max(1, bounds.width), Math.max(1, bounds.height), Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
      redraw();
    };
    const readAppearance = () => {
      if (colorContext) {
        colorContext.fillStyle = "#071017";
        colorContext.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--vf-background-custom").trim() || "#071017";
        colorContext.fillRect(0, 0, 1, 1);
        const rgb = colorContext.getImageData(0, 0, 1, 1).data;
        baseColor = [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
      }
      redraw();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastFrameRef.current = -Infinity;
        redraw();
      }
    };
    const onLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    canvas.addEventListener("webglcontextlost", onLost);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(layout);
    const appearanceObserver = new MutationObserver(readAppearance);
    appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    readAppearance();
    return () => {
      rendererRef.current = null;
      redrawRef.current = null;
      observer.disconnect();
      appearanceObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
      canvas.remove();
    };
  }, [background]);

  useEffect(() => { redrawRef.current?.(); }, [now, seconds, date, week, timezoneOffsetMinutes, font, fontWeight, lang]);
  useEffect(() => { lastFrameRef.current = -Infinity; }, [reduced]);

  useEffect(() => {
    let current = true;
    const spec = fontSpec(font, fontWeight);
    void document.fonts.load(spec, "0123456789:周日月年SepSat").then(() => {
      if (!current) return;
      rendererRef.current?.setFont(spec, true);
      redrawRef.current?.();
    });
    return () => { current = false; };
  }, [font, fontWeight, background]);

  const parts = getClockParts(now, timezoneOffsetMinutes);
  const visibleTime = `${parts.h}:${parts.m}${seconds ? `:${parts.s}` : ""}`;
  const meta = [week ? formatClockWeek(now, lang, timezoneOffsetMinutes) : "", date ? formatClockDate(now, lang, timezoneOffsetMinutes) : ""].filter(Boolean).join(" · ");

  return (
    <div className="clock-liquid-glass" data-background={background} data-failed={failed ? "true" : "false"} role="img" aria-label={[visibleTime, meta].filter(Boolean).join(" ")}>
      <ClockBackgroundRenderer background={background} reduced={reduced} onFrame={onBackgroundFrame} onError={fail} />
      <div ref={canvasRef} aria-hidden="true" />
      <div ref={layoutRef} className="clock-liquid-glass-layout" aria-hidden="true" />
      <div className="clock-liquid-glass-fallback" aria-hidden="true">
        <span>{`${parts.h}:${parts.m}`}</span>
        {seconds ? <small>{parts.s}</small> : null}
        {meta ? <em>{meta}</em> : null}
        <p>{translate(lang, "clockGlassFallback")}</p>
      </div>
      <span className="sr-only">{visibleTime}{meta ? `, ${meta}` : ""}</span>
    </div>
  );
}
