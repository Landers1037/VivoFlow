import { useEffect, useState } from "react";
import { ExternalLink, HardDrive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";
import { storageApi } from "@/lib/storage";
import type { StorageStatus } from "@/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 0; i < units.length && value >= 1024; i += 1) {
    value /= 1024;
    unit = units[i + 1] ?? units[i];
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

export function StorageSettings() {
  const { t } = useAppearance();
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const next = await storageApi.status();
      setStatus(next);
      setPath(next.root_path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  useEffect(() => { void load(); }, []);

  const apply = async () => {
    if (!path.trim() || path.trim() === status?.root_path) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const next = await storageApi.setRoot(path);
      setStatus(next); setPath(next.root_path);
      setMessage(next.warnings?.length ? next.warnings.join(" ") : t("storageMigrated"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setBusy(false); }
  };

  const open = async () => {
    setBusy(true); setError("");
    try { await storageApi.open(); setMessage(t("storageHostOpened")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  return (
    <div className="settings-module">
      <SettingsGroup footer={t("storageHint")}>
        <label className="settings-row settings-row-stack">
          <span className="settings-row-title">{t("storageRoot")}</span>
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            disabled={busy}
            spellCheck={false}
            placeholder="例如 C:\\Users\\you\\Pictures\\VivoFlow"
            className="settings-field-input settings-field-input-wide"
          />
        </label>
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void load()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />{t("storageRefresh")}</Button>
          <Button size="sm" disabled={busy || !path.trim() || path.trim() === status?.root_path} onClick={() => void apply()}>{busy ? t("storageMigrating") : t("storageApply")}</Button>
          <Button variant="outline" size="sm" disabled={busy || !status} onClick={() => void open()}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />{t("storageOpen")}</Button>
        </div>
      </SettingsGroup>

      {status ? (
        <SettingsGroup label={t("storageUsage")}>
          <SettingsRow icon={HardDrive} title={t("storageTotal")} value={`${formatBytes(status.total_bytes)} · ${status.total_files} ${t("storageFiles")}`} />
          <SettingsRow title={t("storageAlbums")} value={`${formatBytes(status.categories.albums?.bytes ?? 0)} · ${status.categories.albums?.files ?? 0} ${t("storageFiles")}`} />
          <SettingsRow title={t("storageMusic")} value={`${formatBytes(status.categories.music_albums?.bytes ?? 0)} · ${status.categories.music_albums?.files ?? 0} ${t("storageFiles")}`} />
          <SettingsRow title={t("storageIllustrations")} value={`${formatBytes(status.categories.illustrations?.bytes ?? 0)} · ${status.categories.illustrations?.files ?? 0} ${t("storageFiles")}`} />
        </SettingsGroup>
      ) : null}
      <p className="settings-group-footer">{t("storageHostHint")}</p>
      {message ? <p className="settings-status-success">{message}</p> : null}
      {error ? <p className="settings-status-error">{error}</p> : null}
    </div>
  );
}
