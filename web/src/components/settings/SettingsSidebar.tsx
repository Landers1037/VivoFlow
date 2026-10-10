import type { KeyboardEvent } from "react";
import { ChevronLeft } from "lucide-react";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import {
  SETTINGS_NAV,
  type SettingsNavPane,
} from "@/components/settings/settingsNav";
import type { AppConfig } from "@/types";

export function SettingsSidebar({
  pane,
  config,
  connected,
  onSelect,
  onBack,
}: {
  pane: SettingsNavPane;
  config: AppConfig;
  connected: boolean;
  onSelect: (pane: SettingsNavPane) => void;
  onBack: () => void;
}) {
  const { t } = useAppearance();

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(".settings-sidebar-item"),
    );
    const current = items.findIndex((item) => item === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const nextIndex =
      event.key === "ArrowDown"
        ? (current + 1) % items.length
        : event.key === "ArrowUp"
          ? (current - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : items.length - 1;
    const next = items[nextIndex];
    next?.focus();
    const nextPane = next?.dataset.pane;
    if (nextPane) onSelect(nextPane as SettingsNavPane);
  };

  return (
    <aside className="settings-sidebar">
      <div className="settings-sidebar-top">
        <button type="button" className="settings-sidebar-back" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          <span>{t("backHome")}</span>
        </button>
        <h1 className="settings-sidebar-title">{t("settings")}</h1>
      </div>
      <nav className="settings-sidebar-nav" aria-label={t("settings")} onKeyDown={onKeyDown}>
        {SETTINGS_NAV.map((group) => (
          <div key={group.id} className="settings-sidebar-group">
            {group.labelKey ? <h2>{t(group.labelKey)}</h2> : null}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pane === item.pane;
              const enabled = item.enabled?.(config) ?? false;
              return (
                <button
                  key={item.pane}
                  type="button"
                  data-pane={item.pane}
                  className={cn("settings-sidebar-item", active && "is-active")}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onSelect(item.pane)}
                >
                  <Icon strokeWidth={1.75} aria-hidden="true" />
                  <span>{t(item.labelKey)}</span>
                  {enabled ? <span className="settings-sidebar-dot" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="settings-sidebar-status">
        <span
          className={cn("settings-live-dot", connected ? "is-live" : "is-waiting")}
          aria-hidden="true"
        />
        <span>{connected ? t("connected") : t("connecting")}</span>
      </div>
    </aside>
  );
}
