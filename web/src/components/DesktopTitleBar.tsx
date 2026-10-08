import { useEffect, useState } from "react";
import { Copy, Minus, Settings2, Square, X } from "lucide-react";
import { useAppearance } from "@/hooks/useAppearance";
import {
  closeDesktopWindow,
  desktopWindowMaximized,
  isDesktopShell,
  minimizeDesktopWindow,
  requestOpenSettings,
  toggleDesktopMaximize,
  watchDesktopResize,
} from "@/lib/desktop";

export function DesktopTitleBar() {
  const { t } = useAppearance();
  const desktop = isDesktopShell();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    document.documentElement.dataset.desktop = "true";
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const sync = (value: boolean) => {
      if (cancelled) return;
      setMaximized(value);
      document.documentElement.dataset.maximized = value ? "true" : "false";
    };
    void desktopWindowMaximized().then(sync).catch(() => {});
    void watchDesktopResize(() => {
      void desktopWindowMaximized().then(sync).catch(() => {});
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      delete document.documentElement.dataset.desktop;
      delete document.documentElement.dataset.maximized;
      unlisten?.();
    };
  }, [desktop]);

  if (!desktop) return null;

  return (
    <header className="vf-desktop-caption">
      <div className="vf-desktop-caption-drag" data-tauri-drag-region>
        <span className="vf-desktop-caption-mark" data-tauri-drag-region aria-hidden="true" />
        <span data-tauri-drag-region>VivoFlow</span>
      </div>
      <div className="vf-desktop-caption-controls">
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
