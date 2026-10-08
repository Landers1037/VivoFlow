import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Fullscreen, Minus, Settings2, Square, X } from "lucide-react";
import { useAppearance } from "@/hooks/useAppearance";
import {
  closeDesktopWindow,
  desktopWindowFullscreen,
  desktopWindowMaximized,
  isDesktopShell,
  minimizeDesktopWindow,
  requestOpenSettings,
  setDesktopFullscreen,
  toggleDesktopMaximize,
  watchDesktopResize,
} from "@/lib/desktop";

export function DesktopTitleBar() {
  const { t } = useAppearance();
  const desktop = isDesktopShell();
  const [maximized, setMaximized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenIntent = useRef<boolean | null>(null);

  const applyFullscreen = useCallback(async (next: boolean) => {
    fullscreenIntent.current = next;
    setFullscreen(next);
    document.documentElement.dataset.fullscreen = next ? "true" : "false";
    try {
      await setDesktopFullscreen(next);
    } catch {
      if (fullscreenIntent.current !== next) return;
      fullscreenIntent.current = null;
      setFullscreen(!next);
      document.documentElement.dataset.fullscreen = !next ? "true" : "false";
      return;
    }
    if (fullscreenIntent.current === next) fullscreenIntent.current = null;
  }, []);

  useEffect(() => {
    if (!desktop) return;
    document.documentElement.dataset.desktop = "true";
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const syncChrome = () => {
      void desktopWindowMaximized()
        .then((value) => {
          if (cancelled) return;
          setMaximized(value);
          document.documentElement.dataset.maximized = value ? "true" : "false";
        })
        .catch(() => {});
      void desktopWindowFullscreen()
        .then((value) => {
          if (cancelled) return;
          if (fullscreenIntent.current != null && fullscreenIntent.current !== value) return;
          setFullscreen(value);
          document.documentElement.dataset.fullscreen = value ? "true" : "false";
        })
        .catch(() => {});
    };
    syncChrome();
    void watchDesktopResize(syncChrome)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      delete document.documentElement.dataset.desktop;
      delete document.documentElement.dataset.maximized;
      delete document.documentElement.dataset.fullscreen;
      unlisten?.();
    };
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || event.isComposing) return;
      const bare = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
      if (!bare) return;
      if (event.key === "F11") {
        event.preventDefault();
        void applyFullscreen(document.documentElement.dataset.fullscreen !== "true");
        return;
      }
      if (event.key === "Escape" && document.documentElement.dataset.fullscreen === "true") {
        event.preventDefault();
        void applyFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyFullscreen, desktop]);

  if (!desktop) return null;

  return (
    <header className="vf-desktop-caption" aria-hidden={fullscreen || undefined}>
      <div className="vf-desktop-caption-drag" data-tauri-drag-region>
        <span className="vf-desktop-caption-mark" data-tauri-drag-region aria-hidden="true" />
        <span data-tauri-drag-region>VivoFlow</span>
      </div>
      <div className="vf-desktop-caption-controls">
        <button type="button" aria-label={t("windowFullscreen")} onClick={() => void applyFullscreen(true)}>
          <Fullscreen />
        </button>
        <button type="button" className="is-settings" aria-label={t("settings")} onClick={requestOpenSettings}>
          <Settings2 />
        </button>
        <button type="button" aria-label={t("windowMinimize")} onClick={() => void minimizeDesktopWindow()}>
          <Minus />
        </button>
        <button
          type="button"
          aria-label={maximized ? t("windowRestore") : t("windowMaximize")}
          onClick={() => void toggleDesktopMaximize()}
        >
          {maximized ? <Copy /> : <Square />}
        </button>
        <button type="button" className="is-close" aria-label={t("windowClose")} onClick={() => void closeDesktopWindow()}>
          <X />
        </button>
      </div>
    </header>
  );
}
