import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Fullscreen, Minus, Settings2, Square, X } from "lucide-react";
import { useAppearance } from "@/hooks/useAppearance";
import {
  closeDesktopWindow,
  desktopWindowFullscreen,
  desktopWindowMaximized,
  isDesktopShell,
  minimizeDesktopWindow,
  onDesktopPage,
  requestOpenSettings,
  setDesktopFullscreen,
  toggleDesktopMaximize,
  watchDesktopFocus,
  watchDesktopResize,
  type DesktopPage,
} from "@/lib/desktop";
import { cn } from "@/lib/utils";

export function DesktopTitleBar() {
  const { t } = useAppearance();
  const desktop = isDesktopShell();
  const [maximized, setMaximized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [page, setPage] = useState<DesktopPage>(
    () => (document.documentElement.dataset.page === "settings" ? "settings" : "dashboard"),
  );
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

  useEffect(() => onDesktopPage(setPage), []);

  useEffect(() => {
    if (!desktop) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    document.documentElement.dataset.windowFocus = "true";
    void watchDesktopFocus((focused) => {
      document.documentElement.dataset.windowFocus = focused ? "true" : "false";
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      delete document.documentElement.dataset.windowFocus;
      unlisten?.();
    };
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
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
        {page === "settings" ? (
          <>
            <span className="vf-desktop-caption-sep" data-tauri-drag-region aria-hidden="true">
              ·
            </span>
            <span data-tauri-drag-region>{t("settings")}</span>
          </>
        ) : null}
      </div>
      <div className="vf-desktop-caption-controls">
        <div className="vf-desktop-caption-app">
          <button
            type="button"
            title={`${t("windowFullscreen")} (F11)`}
            aria-label={t("windowFullscreen")}
            onClick={() => void applyFullscreen(true)}
          >
            <Fullscreen />
          </button>
          <button
            type="button"
            className={cn("is-settings", page === "settings" && "is-current")}
            title={t("settings")}
            aria-label={t("settings")}
            aria-pressed={page === "settings"}
            onClick={requestOpenSettings}
          >
            <Settings2 />
          </button>
        </div>
        <div className="vf-desktop-caption-window">
          <button type="button" title={t("windowMinimize")} aria-label={t("windowMinimize")} onClick={() => void minimizeDesktopWindow()}>
            <Minus />
          </button>
          <button
            type="button"
            title={maximized ? t("windowRestore") : t("windowMaximize")}
            aria-label={maximized ? t("windowRestore") : t("windowMaximize")}
            onClick={() => void toggleDesktopMaximize()}
          >
            {maximized ? <Copy /> : <Square />}
          </button>
          <button type="button" className="is-close" title={t("windowClose")} aria-label={t("windowClose")} onClick={() => void closeDesktopWindow()}>
            <X />
          </button>
        </div>
      </div>
    </header>
  );
}
