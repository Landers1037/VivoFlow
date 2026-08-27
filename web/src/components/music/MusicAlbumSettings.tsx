import { useEffect, useMemo, useState } from "react";
import { Music2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { musicApi, musicCoverUrl } from "@/lib/music";
import type { MusicAlbum, MusicTrack } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppearance } from "@/hooks/useAppearance";

const MAX_COVER_BYTES = 25 * 1024 * 1024;
const SUPPORTED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type TrackDraft = { title: string; lyrics: string };

function draftsFromAlbum(album: MusicAlbum): Record<string, TrackDraft> {
  return Object.fromEntries(album.tracks.map((track) => [track.id, { title: track.title, lyrics: track.lyrics }]));
}

export function MusicAlbumSettings() {
  const { config, setMusicAlbumEnabled, activateMusicAlbum } = useAppearance();
  const [albums, setAlbums] = useState<MusicAlbum[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [trackDrafts, setTrackDrafts] = useState<Record<string, TrackDraft>>({});
  const [saving, setSaving] = useState(false);
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
    setTrackDrafts({});
    setEditingId("new");
  };

  const openEdit = (album: MusicAlbum) => {
    resetFeedback();
    setDraftTitle(album.title);
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
      setError("请填写专辑标题");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingId === "new") {
        const album = await musicApi.create(title);
        await load();
        setEditingId(album.id);
        setDraftTitle(album.title);
        setMessage("专辑已创建，可以继续上传封面和音乐");
        return;
      }
      if (!editingAlbum) return;
      if (title !== editingAlbum.title) {
        await musicApi.update(editingAlbum.id, title);
      }
      for (const track of editingAlbum.tracks) {
        const draft = trackDrafts[track.id];
        if (!draft) continue;
        if (draft.title !== track.title || draft.lyrics !== track.lyrics) {
          await musicApi.updateTrack(editingAlbum.id, track.id, draft.title, draft.lyrics);
        }
      }
      await load();
      setMessage("已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const enable = async (album: MusicAlbum) => {
    await musicApi.enable(album.id);
    activateMusicAlbum(album.id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/40 p-4">
        <div>
          <h3 className="font-semibold">音乐专辑</h3>
          <p className="mt-1 text-xs text-muted-foreground">与相册、音频可视化互斥</p>
        </div>
        <Switch checked={config.music_album_enabled} onCheckedChange={setMusicAlbumEnabled} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="font-medium">我的专辑</h4>
          <p className="text-sm text-muted-foreground">创建专辑后，在弹窗中管理封面、音乐和歌词。</p>
        </div>
        <Button onClick={openNew} className="shrink-0 gap-2 rounded-lg">
          <Plus className="h-4 w-4" />
          新建专辑
        </Button>
      </div>

      {albums.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {albums.map((album) => (
            <div
              key={album.id}
              className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card/35 p-3 transition-colors hover:border-primary/50 hover:bg-card/70"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                {album.cover_file ? (
                  <img src={musicCoverUrl(album.id)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Music2 className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{album.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{album.tracks.length} 首曲目</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 gap-1 rounded-lg px-2" onClick={() => openEdit(album)}>
                    <Pencil className="h-3 w-3" /> 编辑
                  </Button>
                  <Button size="sm" variant={config.active_music_album_id === album.id ? "default" : "ghost"} className="h-7 rounded-lg px-2" onClick={() => void enable(album)}>
                    {config.active_music_album_id === album.id ? "已启用" : "启用"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-lg px-2 text-destructive" onClick={async () => { await musicApi.remove(album.id); await load(); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/80 px-6 py-10 text-center text-sm text-muted-foreground">
          还没有专辑，点击“新建专辑”开始创建。
        </div>
      )}

      <Dialog open={editingId !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId === "new" ? "新建音乐专辑" : "编辑音乐专辑"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <Input
              autoFocus
              placeholder="专辑标题"
              value={draftTitle}
              onChange={(event) => {
                setDraftTitle(event.target.value);
                if (message || error) resetFeedback();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveAlbum();
              }}
            />
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
              <p className="text-sm text-muted-foreground">先填写标题并保存，随后即可上传媒体文件。</p>
            )}
            <div className="sticky bottom-0 space-y-3 border-t border-border bg-card pt-4">
              {message ? (
                <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button className="w-full rounded-lg" onClick={() => void saveAlbum()} disabled={saving || !draftTitle.trim()}>
                {saving ? "保存中…" : "保存"}
              </Button>
            </div>
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
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="h-20 w-20 overflow-hidden rounded-lg bg-muted">
          {album.cover_file ? <img src={musicCoverUrl(album.id)} alt="专辑封面" className="h-full w-full object-cover" /> : <Music2 className="m-6 h-8 w-8 text-muted-foreground" />}
        </div>
        <label>
          <Button asChild variant="outline" className="gap-2 rounded-lg"><span><Upload className="h-4 w-4" />上传封面</span></Button>
          <input className="hidden" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={async (event) => { const input = event.currentTarget; const file = input.files?.[0]; if (!file) return; onError(""); if (file.size > MAX_COVER_BYTES) { onError(`封面大小不能超过 25 MB，当前文件为 ${(file.size / 1024 / 1024).toFixed(1)} MB。`); input.value = ""; return; } if (!SUPPORTED_COVER_TYPES.has(file.type)) { onError("封面仅支持 JPEG、PNG、GIF 和 WebP 格式。"); input.value = ""; return; } try { await musicApi.cover(album.id, file); await onChange(); } catch (error) { onError(error instanceof Error ? error.message : "封面上传失败"); } finally { input.value = ""; } }} />
        </label>
        <label>
          <Button asChild variant="outline" className="rounded-lg"><span>选择音乐</span></Button>
          <input className="hidden" type="file" multiple accept="audio/*" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
        </label>
        {files.length ? <Button className="rounded-lg" onClick={async () => { try { await musicApi.tracks(album.id, files); setFiles([]); await onChange(); } catch (error) { onError(error instanceof Error ? error.message : "音乐上传失败"); } }}>上传 {files.length} 首</Button> : null}
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
      }) : <p className="text-sm text-muted-foreground">还没有曲目，请选择音乐文件上传。</p>}
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
          删除
        </Button>
      </div>
      <textarea
        className="min-h-24 w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        placeholder="歌词或 LRC"
        value={draft.lyrics}
        onChange={(event) => onDraftChange({ ...draft, lyrics: event.target.value })}
      />
    </div>
  );
}
