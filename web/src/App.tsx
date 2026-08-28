import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutDashboard, Settings2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { TitleBarOverlay } from "@/components/TitleBarOverlay";
import { Dashboard } from "@/components/Dashboard";
import { PhotoAlbumPage } from "@/components/albums/PhotoAlbumPage";
import { AudioVisualizerPage } from "@/components/audio/AudioVisualizerPage";
import { SettingsPage } from "@/components/SettingsPage";
import { ClockPage } from "@/components/clock/ClockPage";
import { BlackholePage } from "@/components/blackhole/BlackholePage";
import { Models3dPage } from "@/components/models3d/Models3dPage";
import { MusicAlbumPage } from "@/components/music/MusicAlbumPage";
import { IllustrationPage } from "@/components/illustration/IllustrationPage";
import { musicApi } from "@/lib/music";
import { FullPageLoader } from "@/components/viz";
import { AppearanceProvider, useAppearance } from "@/hooks/useAppearance";
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
  const [settingsReset, setSettingsReset] = useState(0);
  const openSettings = () => {
    if (page === "settings") setSettingsReset((nonce) => nonce + 1);
    else setPage("settings");
  };
  const [headerRevealed, setHeaderRevealed] = useState(false);
  const headerTimer = useRef<number | null>(null);
  const hideTitleBar = appearanceConfig.hide_title_bar && page === "dashboard";
  const mobileCardModeActive = appearanceConfig.mobile_card_mode;
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

  const titleBar = (inFlow = false) => (
    <TitleBarOverlay
      hidden={hideTitleBar}
      revealed={headerRevealed}
      conn={conn}
      config={config}
      t={t}
      onReveal={revealHeader}
      onOpenSettings={openSettings}
      inFlow={inFlow}
    />
  );

  if (page === "dashboard" && appearanceConfig.clock_enabled) {
    return (
      <div className="vf-shell overflow-hidden">
        <ClockPage />
        {titleBar()}
      </div>
    );
  }

  if (page === "dashboard" && appearanceConfig.music_album_enabled && musicAlbum) {
    return (
      <div className="vf-shell overflow-hidden">
        <MusicAlbumPage album={musicAlbum} onOpenSettings={openSettings} />
        {titleBar()}
      </div>
    );
  }

  if (page === "dashboard" && appearanceConfig.audio_visualizer_enabled) {
    return (
      <div className="vf-shell overflow-hidden">
        <AudioVisualizerPage frame={audioFrame} status={audioStatus} onSubscribe={setAudioSubscription} onOpenSettings={openSettings} />
        {titleBar()}
      </div>
    );
  }

  if (page === "dashboard" && appearanceConfig.photo_album_enabled) {
    return (
      <div className="vf-shell overflow-hidden">
        <PhotoAlbumPage onOpenSettings={openSettings} />
        {titleBar()}
      </div>
    );
  }

  if (page === "dashboard" && appearanceConfig.illustration_enabled) {
    return (
      <div className="vf-shell overflow-hidden">
        <IllustrationPage onOpenSettings={openSettings} />
        {titleBar()}
      </div>
    );
  }

  if (page === "dashboard" && appearanceConfig.blackhole_enabled) {
    return (
      <div className="vf-shell overflow-hidden">
        <BlackholePage />
        {titleBar()}
      </div>
    );
  }

  if (page === "dashboard" && appearanceConfig.model3d_enabled) {
    return (
      <div className="vf-shell overflow-hidden">
        <Models3dPage />
        {titleBar()}
      </div>
    );
  }

  return (
    <div className={cn("vf-shell", mobileCardModeActive && "overflow-hidden")}>
      <div className={cn("safe-pad mx-auto", page === "settings" ? "settings-shell" : "max-w-5xl")}>
        {page === "settings" ? (
          <SettingsPage
            config={config}
            onSave={setRemoteConfig}
            onBack={() => setPage("dashboard")}
            audioFrame={audioFrame}
            audioStatus={audioStatus}
            onAudioSubscribe={setAudioSubscription}
            resetNonce={settingsReset}
          />
        ) : (
          <>
            {titleBar(true)}

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
          onClick={openSettings}
        >
          <Settings2 className="h-[18px] w-[18px]" />
          <span>{t("settings")}</span>
        </button>
      </nav>
    </div>
  );
}
