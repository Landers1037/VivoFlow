import { MonitorCog } from "lucide-react";
import { SettingsGroup, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";

export function SystemDashboardSettings() {
  const { config, synced, setSystemDashboardEnabled, t } = useAppearance();

  return (
    <div className="settings-system-dashboard">
      <SettingsGroup footer={t("systemDashboardHint")}>
        <SettingsSwitchRow
          id="system-dashboard-enabled"
          icon={MonitorCog}
          title={t("systemDashboardBoard")}
          subtitle={t("systemDashboardEnabledHint")}
          checked={config.system_dashboard_enabled}
          disabled={!synced}
          onCheckedChange={setSystemDashboardEnabled}
        />
      </SettingsGroup>
    </div>
  );
}
