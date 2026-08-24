import { useCallback, useEffect, useRef, useState } from "react";
import { Settings2, Wifi, WifiOff } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/Dashboard";
import { PhotoAlbumPage } from "@/components/albums/PhotoAlbumPage";
import { SettingsPage } from "@/components/SettingsPage";
import { FullPageLoader } from "@/components/viz";
import { AppearanceProvider, useAppearance } from "@/hooks/useAppearance";
import { useHandheldViewport } from "@/hooks/useMobileViewport";
import { useVivoflowWs } from "@/hooks/useVivoflowWs";
import { cn } from "@/lib/utils";

export default function App() {
  const ws = useVivoflowWs();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppearanceProvider config={ws.config} onPersist={ws.setRemoteConfig}>
        <AppShell {...ws} />
      </AppearanceProvider>
    </ThemeProvider>
  );
}

function AppShell({
  conn,
  snapshot,
  history,
  config,
  error,
  setRemoteConfig,
}: ReturnType<typeof useVivoflowWs>) {
  const { t, config: appearanceConfig } = useAppearance();
  const [page, setPage] = useState<"dashboard" | "settings">("dashboard");
  const [headerRevealed, setHeaderRevealed] = useState(false);
  const headerTimer = useRef<number | null>(null);
  const edgeStartX = useRef<number | null>(null);
  const handheldViewport = useHandheldViewport();
  const hideTitleBar = appearanceConfig.hide_title_bar && page === "dashboard";
  const mobileCardModeActive = appearanceConfig.mobile_card_mode && handheldViewport;

  const revealHeader = useCallback(() => {
    setHeaderRevealed(true);
    if (headerTimer.current != null) window.clearTimeout(headerTimer.current);
    headerTimer.current = window.setTimeout(() => {
      setHeaderRevealed(false);
      headerTimer.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    if (!hideTitleBar) {
      setHeaderRevealed(false);
      if (headerTimer.current != null) {
        window.clearTimeout(headerTimer.current);
        headerTimer.current = null;
      }
    }
  }, [hideTitleBar]);

  useEffect(
    () => () => {
      if (headerTimer.current != null) window.clearTimeout(headerTimer.current);
    },
    [],
  );

  if (page === "dashboard" && appearanceConfig.photo_album_enabled) {
    return (
      <div className="vf-shell overflow-hidden">
        <PhotoAlbumPage onOpenSettings={() => setPage("settings")} />
      </div>
    );
  }

  return (
    <div className={cn("vf-shell", mobileCardModeActive && "overflow-hidden")}>
      <div className="safe-pad mx-auto max-w-5xl">
        {page === "settings" ? (
          <SettingsPage
            config={config}
            onSave={setRemoteConfig}
            onBack={() => setPage("dashboard")}
          />
        ) : (
          <>
            {!hideTitleBar || headerRevealed ? (
              <div
                className={cn(
                  "mb-4",
                  hideTitleBar && "vf-titlebar-reveal",
                  hideTitleBar &&
                    "safe-pad fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/90 shadow-sm backdrop-blur-md",
                )}
                onPointerDown={hideTitleBar ? revealHeader : undefined}
                onFocusCapture={hideTitleBar ? revealHeader : undefined}
              >
                <header className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
                      VivoFlow
                    </h1>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {conn === "connected" ? (
                        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span>
                        {conn === "connected"
                          ? t("connected")
                          : conn === "connecting"
                            ? t("connecting")
                            : t("disconnected")}
                      </span>
                      {config ? <span>· {config.interval_ms}ms</span> : null}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("settings")}
                    onClick={() => setPage("settings")}
                  >
                    <Settings2 className="h-5 w-5" />
                  </Button>
                </header>
              </div>
            ) : null}

            {hideTitleBar && !headerRevealed ? (
              <button
                type="button"
                aria-label={t("showHeader")}
                className="fixed inset-y-0 right-0 z-50 w-6 cursor-ew-resize bg-transparent outline-none focus-visible:bg-primary/10"
                onPointerDown={(event) => {
                  edgeStartX.current = event.clientX;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                }}
                onPointerUp={(event) => {
                  const start = edgeStartX.current;
                  edgeStartX.current = null;
                  if (start != null && start - event.clientX > 16) revealHeader();
                }}
                onPointerCancel={() => {
                  edgeStartX.current = null;
                }}
                onClick={revealHeader}
                onFocus={revealHeader}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") revealHeader();
                }}
              />
            ) : null}

            {error ? (
              <div
                className={cn(
                  "mb-3 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
                )}
                style={{ borderRadius: "var(--radius)" }}
              >
                {error.kind === "key" ? t(error.key) : error.message}
              </div>
            ) : null}

            {!snapshot && conn !== "connected" ? (
              <FullPageLoader label={t("connectingService")} />
            ) : (
              <Dashboard snapshot={snapshot} history={history} />
            )}

            {!mobileCardModeActive ? (
              <footer className="mt-6 pb-2 text-center text-[11px] text-muted-foreground">
                {t("footer")}
              </footer>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
