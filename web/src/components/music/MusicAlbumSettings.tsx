import { useEffect, useMemo, useState } from "react";
import { Music2, Plus, Trash2, Upload } from "lucide-react";
import { musicApi, musicCoverUrl } from "@/lib/music";
import { cn } from "@/lib/utils";
import type { MusicAlbum, MusicAlbumEffect, MusicTrack } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsGroup, SettingsSheetBar, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";

const MAX_COVER_BYTES = 25 * 1024 * 1024;
const SUPPORTED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const RECORD_EFFECTS: { id: MusicAlbumEffect; key: "musicRecordEffectOff" | "musicRecordEffectRipple" | "musicRecordEffectBars" | "musicRecordEffectParticles" | "musicRecordEffectTurntable" }[] = [
  { id: "off", key: "musicRecordEffectOff" },
  { id: "ripple", key: "musicRecordEffectRipple" },
  { id: "bars", key: "musicRecordEffectBars" },
  { id: "particles", key: "musicRecordEffectParticles" },
  { id: "turntable", key: "musicRecordEffectTurntable" },
];

type TrackDraft = { title: string; lyrics: string };

function draftsFromAlbum(album: MusicAlbum): Record<string, TrackDraft> {
  return Object.fromEntries(album.tracks.map((track) => [track.id, { title: track.title, lyrics: track.lyrics }]));
}

export function MusicAlbumSettings() {
  const { t, config, synced, setMusicAlbumEnabled, setMusicAlbumEffect, activateMusicAlbum } = useAppearance();
  const [albums, setAlbums] = useState<MusicAlbum[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftLoop, setDraftLoop] = useState(false);
  const [draftMuted, setDraftMuted] = useState(false);
  const [trackDrafts, setTrackDrafts] = useState<Record<string, TrackDraft>>({});
  const [saving, setSaving] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState<MusicAlbum | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editingAlbum = useMemo(
    () => albums.find((album) => album.id === editingId),
    [albums, editingId],
  );

  const load = async () => {
    try {
      setAlbums(await musicApi.list());
    } catch {
      // The settings page remains usable when the service is temporarily unavailable.
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!editingAlbum) return;
    setTrackDrafts((current) => {
      const next: Record<string, TrackDraft> = {};
      for (const track of editingAlbum.tracks) {
        next[track.id] = current[track.id] ?? { title: track.title, lyrics: track.lyrics };
      }
      return next;
    });
  }, [editingAlbum]);

  const resetFeedback = () => {
    setError("");
    setMessage("");
  };

  const openNew = () => {
    resetFeedback();
    setDraftTitle("");
    setDraftLoop(false);
    setDraftMuted(false);
    setTrackDrafts({});
    setEditingId("new");
  };

  const openEdit = (album: MusicAlbum) => {
    resetFeedback();
    setDraftTitle(album.title);
    setDraftLoop(Boolean(album.loop_playback));
    setDraftMuted(Boolean(album.default_muted));
    setTrackDrafts(draftsFromAlbum(album));
    setEditingId(album.id);
  };

  const closeEditor = () => {
    resetFeedback();
    setEditingId(null);
  };

  const saveAlbum = async () => {
    const title = draftTitle.trim();
    if (!title) {
      setMessage("");
      setError(t("musicAlbumNeedTitle"));
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const playback = { loop_playback: draftLoop, default_muted: draftMuted };
      if (editingId === "new") {
        const album = await musicApi.create(title, playback);
        await load();
        setEditingId(album.id);
        setDraftTitle(album.title);
        setDraftLoop(Boolean(album.loop_playback));
        setDraftMuted(Boolean(album.default_muted));
        setMessage(t("musicAlbumCreated"));
        return;
      }
      if (!editingAlbum) return;
      if (
        title !== editingAlbum.title ||
        draftLoop !== Boolean(editingAlbum.loop_playback) ||
        draftMuted !== Boolean(editingAlbum.default_muted)
      ) {
        await musicApi.update(editingAlbum.id, title, playback);
      }
      for (const track of editingAlbum.tracks) {
        const draft = trackDrafts[track.id];
        if (!draft) continue;
        if (draft.title !== track.title || draft.lyrics !== track.lyrics) {
          await musicApi.updateTrack(editingAlbum.id, track.id, draft.title, draft.lyrics);
        }
      }
      await load();
      setMessage(t("musicAlbumSaved"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("musicAlbumSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const enable = async (album: MusicAlbum) => {
    await musicApi.enable(album.id);
    activateMusicAlbum(album.id);
    await load();
  };

  const confirmDelete = async () => {
    if (!deletingAlbum) return;
    setDeleting(true);
    try {
      await musicApi.remove(deletingAlbum.id);
      setDeletingAlbum(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="settings-module">
      <SettingsGroup footer={t("musicAlbumsHint")}>
        <SettingsSwitchRow
          id="music-album-enabled"
          title={t("musicAlbums")}
          checked={config.music_album_enabled}
          onCheckedChange={setMusicAlbumEnabled}
        />
      </SettingsGroup>

      <SettingsGroup label={t("musicRecordEffect")} footer={t("musicRecordEffectHint")}>
        {RECORD_EFFECTS.map((effect) => (
          <button
            type="button"
            key={effect.id}
            disabled={!synced}
            onClick={() => setMusicAlbumEffect(effect.id)}
            className={cn("settings-row", config.music_album_effect === effect.id && "is-selected")}
          >
            <span className="settings-row-title">{t(effect.key)}</span>
            {config.music_album_effect === effect.id ? (
              <span className="settings-row-value text-primary">{t("settingsOn")}</span>
            ) : null}
          </button>
        ))}
      </SettingsGroup>

      <SettingsGroup label={t("myMusicAlbums")} footer={t("myMusicAlbumsHint")}>
        <button type="button" className="settings-row" onClick={openNew}>
          <span className="settings-row-icon">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="settings-row-title">{t("createMusicAlbum")}</span>
        </button>
      </SettingsGroup>

      {albums.length ? (
        <SettingsGroup>
          {albums.map((album) => (
            <div key={album.id} className="settings-list-card">
              <div className="settings-cover">
                {album.cover_file ? (
                  <img src={musicCoverUrl(album.id)} alt="" />
                ) : (
                  <Music2 className="m-2.5 h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(album)}>
                <span className="block truncate font-medium">{album.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("musicAlbumTracks", { count: album.tracks.length })}
                </span>
              </button>
              <div className="settings-list-card-actions">
                <Button
                  size="sm"
                  variant={config.active_music_album_id === album.id ? "default" : "ghost"}
                  className="h-9 shrink-0 px-2"
                  onClick={() => void enable(album)}
                >
                  {config.active_music_album_id === album.id ? t("musicAlbumEnabled") : t("musicAlbumEnable")}
                </Button>
                <button
                  type="button"
                  className="settings-list-card-control text-destructive"
                  aria-label={t("musicAlbumDelete")}
                  onClick={() => setDeletingAlbum(album)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </SettingsGroup>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">{t("musicAlbumEmpty")}</p>
      )}

      <Dialog open={editingId !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <SettingsSheetBar
            title={<DialogTitle>{editingId === "new" ? t("createMusicAlbum") : t("editMusicAlbum")}</DialogTitle>}
            cancelLabel={t("settingsCancel")}
            doneLabel={t("settingsDone")}
            doneDisabled={saving || !draftTitle.trim()}
            onCancel={closeEditor}
            onDone={() => void saveAlbum()}
          />
          <div className="settings-sheet-body">
            <SettingsGroup>
              <label className="settings-row settings-row-stack">
                <span className="settings-row-title">{t("musicAlbumTitlePlaceholder")}</span>
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(event) => {
                    setDraftTitle(event.target.value);
                    if (message || error) resetFeedback();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveAlbum();
                  }}
                  className="settings-field-input is-start"
                />
              </label>
            </SettingsGroup>
            <SettingsGroup>
              <SettingsSwitchRow
                id="music-album-loop"
                title={t("musicAlbumLoop")}
                subtitle={t("musicAlbumLoopHint")}
                checked={draftLoop}
                onCheckedChange={setDraftLoop}
              />
              <SettingsSwitchRow
                id="music-album-mute"
                title={t("musicAlbumMute")}
                subtitle={t("musicAlbumMuteHint")}
                checked={draftMuted}
                onCheckedChange={setDraftMuted}
              />
            </SettingsGroup>
            {editingAlbum ? (
              <AlbumEditor
                album={editingAlbum}
                trackDrafts={trackDrafts}
                onTrackDraftChange={(trackId, draft) => {
                  setTrackDrafts((current) => ({ ...current, [trackId]: draft }));
                  if (message || error) resetFeedback();
                }}
                onChange={load}
                onError={(text) => {
                  setMessage("");
                  setError(text);
                }}
              />
            ) : (
              <p className="settings-group-footer">{t("musicAlbumSaveFirst")}</p>
            )}
            {message ? (
              <p role="status" className="settings-group-footer" style={{ color: "var(--primary)" }}>
                {message}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mb-4 rounded-[0.9rem] bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingAlbum !== null} onOpenChange={(open) => !open && !deleting && setDeletingAlbum(null)}>
        <DialogContent variant="alert">
          <DialogTitle className="settings-alert-title">{t("musicAlbumDelete")}</DialogTitle>
          <DialogDescription className="settings-alert-copy">
            {t("musicAlbumDeleteConfirm", { name: deletingAlbum?.title ?? "" })}
          </DialogDescription>
          <div className="settings-alert-actions">
            <button
              type="button"
              className="settings-alert-cancel"
              disabled={deleting}
              onClick={() => setDeletingAlbum(null)}
            >
              {t("settingsCancel")}
            </button>
            <button
              type="button"
              className="settings-alert-confirm"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {t("musicAlbumDelete")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlbumEditor({
  album,
  trackDrafts,
  onTrackDraftChange,
  onChange,
  onError,
}: {
  album: MusicAlbum;
  trackDrafts: Record<string, TrackDraft>;
  onTrackDraftChange: (trackId: string, draft: TrackDraft) => void;
  onChange: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const { t } = useAppearance();
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="h-20 w-20 overflow-hidden rounded-lg bg-muted">
          {album.cover_file ? <img src={musicCoverUrl(album.id)} alt={t("musicAlbumCoverAlt")} className="h-full w-full object-cover" /> : <Music2 className="m-6 h-8 w-8 text-muted-foreground" />}
        </div>
        <label>
          <Button asChild variant="outline" className="gap-2 rounded-lg"><span><Upload className="h-4 w-4" />{t("musicAlbumUploadCover")}</span></Button>
          <input className="hidden" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={async (event) => { const input = event.currentTarget; const file = input.files?.[0]; if (!file) return; onError(""); if (file.size > MAX_COVER_BYTES) { onError(t("musicAlbumCoverTooLarge", { size: (file.size / 1024 / 1024).toFixed(1) })); input.value = ""; return; } if (!SUPPORTED_COVER_TYPES.has(file.type)) { onError(t("musicAlbumCoverType")); input.value = ""; return; } try { await musicApi.cover(album.id, file); await onChange(); } catch (error) { onError(error instanceof Error ? error.message : t("musicAlbumCoverFailed")); } finally { input.value = ""; } }} />
        </label>
        <label>
          <Button asChild variant="outline" className="rounded-lg"><span>{t("musicAlbumChooseTracks")}</span></Button>
          <input className="hidden" type="file" multiple accept="audio/*" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
        </label>
        {files.length ? <Button className="rounded-lg" onClick={async () => { try { await musicApi.tracks(album.id, files); setFiles([]); await onChange(); } catch (error) { onError(error instanceof Error ? error.message : t("musicAlbumTracksFailed")); } }}>{t("musicAlbumUploadTracks", { count: files.length })}</Button> : null}
      </div>
      {album.tracks.length ? album.tracks.map((track) => {
        const draft = trackDrafts[track.id] ?? { title: track.title, lyrics: track.lyrics };
        return (
          <TrackEditor
            key={track.id}
            albumId={album.id}
            track={track}
            draft={draft}
            onDraftChange={(next) => onTrackDraftChange(track.id, next)}
            onChange={onChange}
          />
        );
      }) : <p className="text-sm text-muted-foreground">{t("musicAlbumNoTracks")}</p>}
    </div>
  );
}

function TrackEditor({
  albumId,
  track,
  draft,
  onDraftChange,
  onChange,
}: {
  albumId: string;
  track: MusicTrack;
  draft: TrackDraft;
  onDraftChange: (draft: TrackDraft) => void;
  onChange: () => Promise<void>;
}) {
  const { t } = useAppearance();
  return (
    <div className="space-y-2 rounded-xl border border-border/70 p-3">
      <div className="flex gap-2">
        <Input value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} />
        <Button
          variant="ghost"
          className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => {
            await musicApi.removeTrack(albumId, track.id);
            await onChange();
          }}
        >
          {t("musicAlbumDeleteTrack")}
        </Button>
      </div>
      <textarea
        className="min-h-24 w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        placeholder={t("musicAlbumLyricsPlaceholder")}
        value={draft.lyrics}
        onChange={(event) => onDraftChange({ ...draft, lyrics: event.target.value })}
      />
    </div>
  );
}
