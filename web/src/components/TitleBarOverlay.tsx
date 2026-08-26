import { useRef } from "react";
import { Activity, Settings2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppConfig, ConnState } from "@/types";
import type { TFunction } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";

export function TitleBarOverlay({
  hidden,
  revealed,
  conn,
  config,
  t,
  onReveal,
  onOpenSettings,
  inFlow = false,
}: {
  hidden: boolean;
  revealed: boolean;
  conn: ConnState;
  config: AppConfig | null;
  t: TFunction;
  onReveal: () => void;
  onOpenSettings: () => void;
  inFlow?: boolean;
}) {
  const edgeStartX = useRef<number | null>(null);
  const visible = !hidden || revealed;

  return (
    <>
      {visible ? (
        <div
          className={cn(
            "vf-header-wrap",
            inFlow && "mb-4",
            hidden && "vf-titlebar-reveal",
            !inFlow &&
              "safe-pad fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/90 shadow-sm backdrop-blur-md",
            hidden && inFlow &&
              "safe-pad fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/90 shadow-sm backdrop-blur-md",
          )}
          onPointerDown={hidden ? onReveal : undefined}
          onFocusCapture={hidden ? onReveal : undefined}
        >
          <header className="vf-app-header mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="vf-brand-lockup min-w-0">
              <div className="vf-brand-mark" aria-hidden="true">
                <Activity className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <p className="vf-brand-eyebrow">LOCAL TELEMETRY</p>
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
                  VivoFlow
                </h1>
              </div>
            </div>
            <div className="vf-header-tools">
              <div
                className={cn(
                  "vf-connection-pill",
                  conn === "connected" ? "vf-connection-live" : "vf-connection-waiting",
                )}
              >
                {conn === "connected" ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                <span>
                  {conn === "connected"
                    ? t("connected")
                    : conn === "connecting"
                      ? t("connecting")
                      : t("disconnected")}
                </span>
                {config ? <span className="vf-interval-chip">{config.interval_ms}ms</span> : null}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="vf-header-action"
                aria-label={t("settings")}
                onClick={onOpenSettings}
              >
                <Settings2 className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <div className="vf-header-rule" aria-hidden="true">
            <span />
            <span className="vf-header-rule-label">01 / LIVE FEED</span>
          </div>
        </div>
      ) : null}

      {hidden && !revealed ? (
        <button
          type="button"
          aria-label={t("showHeader")}
          className="fixed inset-y-0 right-0 z-50 w-6 touch-none cursor-ew-resize bg-transparent outline-none focus-visible:bg-primary/10"
          onPointerDown={(event) => {
            edgeStartX.current = event.clientX;
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = edgeStartX.current;
            edgeStartX.current = null;
            if (start != null && start - event.clientX > 16) onReveal();
          }}
          onPointerCancel={() => {
            edgeStartX.current = null;
          }}
          onClick={onReveal}
          onFocus={onReveal}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onReveal();
          }}
        />
      ) : null}
    </>
  );
}
