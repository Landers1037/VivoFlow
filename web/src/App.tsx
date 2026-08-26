import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, LayoutDashboard, Settings2, Wifi, WifiOff } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/Dashboard";
import { PhotoAlbumPage } from "@/components/albums/PhotoAlbumPage";
import { AudioVisualizerPage } from "@/components/audio/AudioVisualizerPage";
import { SettingsPage } from "@/components/SettingsPage";
import { MusicAlbumPage } from "@/components/music/MusicAlbumPage";
import { musicApi } from "@/lib/music";
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
  audioFrame,
  audioStatus,
  setAudioSubscription,
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
  const [musicAlbum, setMusicAlbum] = useState<import("@/types").MusicAlbum | null>(null);
  useEffect(() => { if (appearanceConfig.music_album_enabled && appearanceConfig.active_music_album_id) musicApi.list().then(xs => setMusicAlbum(xs.find(x => x.id === appearanceConfig.active_music_album_id) ?? null)).catch(() => setMusicAlbum(null)); }, [appearanceConfig.music_album_enabled, appearanceConfig.active_music_album_id]);

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

  if (page === "dashboard" && appearanceConfig.music_album_enabled && musicAlbum) {
    return <div className="vf-shell overflow-hidden"><MusicAlbumPage album={musicAlbum} onOpenSettings={() => setPage("settings")} /></div>;
  }

  if (page === "dashboard" && appearanceConfig.audio_visualizer_enabled) {
    return <div className="vf-shell overflow-hidden"><AudioVisualizerPage frame={audioFrame} status={audioStatus} onSubscribe={setAudioSubscription} onOpenSettings={() => setPage("settings")} /></div>;
  }

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
            audioFrame={audioFrame}
            audioStatus={audioStatus}
            onAudioSubscribe={setAudioSubscription}
          />
        ) : (
          <>
            {!hideTitleBar || headerRevealed ? (
              <div
                className={cn(
                  "vf-header-wrap mb-4",
                  hideTitleBar && "vf-titlebar-reveal",
                  hideTitleBar &&
                    "safe-pad fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/90 shadow-sm backdrop-blur-md",
                )}
                onPointerDown={hideTitleBar ? revealHeader : undefined}
                onFocusCapture={hideTitleBar ? revealHeader : undefined}
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
                    onClick={() => setPage("settings")}
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
              <footer className="vf-footer mt-6 pb-2 text-center text-[11px] text-muted-foreground">
                {t("footer")}
              </footer>
            ) : null}
          </>
        )}
      </div>
      <nav className="vf-mobile-nav" aria-label={t("dashboardPages")}>
        <button
          type="button"
          className={cn("vf-mobile-nav-item", page === "dashboard" && "vf-mobile-nav-item-active")}
          aria-current={page === "dashboard" ? "page" : undefined}
          onClick={() => setPage("dashboard")}
        >
          <LayoutDashboard className="h-[18px] w-[18px]" />
          <span>{t("overview")}</span>
        </button>
        <button
          type="button"
          className={cn("vf-mobile-nav-item", page === "settings" && "vf-mobile-nav-item-active")}
          aria-current={page === "settings" ? "page" : undefined}
          onClick={() => setPage("settings")}
        >
          <Settings2 className="h-[18px] w-[18px]" />
          <span>{t("settings")}</span>
        </button>
      </nav>
    </div>
  );
}
