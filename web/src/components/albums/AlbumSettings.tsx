import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, FolderOpen, GripVertical, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsGroup, SettingsSheetBar, SettingsSliderRow, SettingsSwitchRow } from "@/components/settings/SettingsList";
import { useAppearance } from "@/hooks/useAppearance";
import { albumApi, type AlbumInput } from "@/lib/albums";
import { cn } from "@/lib/utils";
import type { Album, AlbumImage, PhotoAlbumEffect } from "@/types";

const EFFECTS: { id: PhotoAlbumEffect; key: "effectSingle" | "effectTimeMachine" | "effectCoverFlow" }[] = [
  { id: "single", key: "effectSingle" },
  { id: "time_machine", key: "effectTimeMachine" },
  { id: "cover_flow", key: "effectCoverFlow" },
];

function emptyDraft(): AlbumInput {
  return {
    title: "",
    description: null,
    date: new Date().toISOString().slice(0, 10),
    show_on_home: false,
    shuffle: false,
    interval_s: 5,
  };
}

function toDraft(album: Album): AlbumInput {
  return {
    title: album.title,
    description: album.description,
    date: album.date,
    show_on_home: album.show_on_home,
    shuffle: album.shuffle,
    interval_s: album.interval_s,
  };
}

export function AlbumSettings() {
  const {
    t,
    config,
    synced,
    setPhotoAlbumEnabled,
    setPhotoAlbumEffect,
  } = useAppearance();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<AlbumInput>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const editing = useMemo(
    () => (editingId && editingId !== "new" ? albums.find((album) => album.id === editingId) ?? null : null),
    [albums, editingId],
  );

  useEffect(() => {
    let alive = true;
    albumApi.list().then((items) => alive && setAlbums(items)).catch((reason: Error) => {
      if (alive) setError(`${t("albumLoadFailed")}: ${reason.message}`);
    });
    return () => { alive = false; };
  }, [t]);

  const replaceAlbum = (next: Album) => {
    setAlbums((current) => current.map((album) => (album.id === next.id ? next : album)));
  };

  const openAlbum = (album: Album) => {
    setEditingId(album.id);
    setDraft(toDraft(album));
    setMessage(null);
    setError(null);
  };

  const onAlbumDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = albums.findIndex((album) => album.id === active.id);
    const to = albums.findIndex((album) => album.id === over.id);
    const next = arrayMove(albums, from, to);
    setAlbums(next);
    try {
      setAlbums(await albumApi.order(next.map((album) => album.id)));
    } catch (reason) {
      setAlbums(albums);
      setError(`${t("albumActionFailed")}: ${(reason as Error).message}`);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editingId === "new") {
        const created = await albumApi.create(draft);
        setAlbums((current) => [...current, created]);
        setEditingId(created.id);
        setDraft(toDraft(created));
      } else if (editingId) {
        replaceAlbum(await albumApi.update(editingId, draft));
      }
      setMessage(t("albumSaved"));
    } catch (reason) {
      setError(`${t("albumActionFailed")}: ${(reason as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!editing || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      replaceAlbum(await albumApi.upload(editing.id, files));
    } catch (reason) {
      setError(`${t("albumActionFailed")}: ${(reason as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteCurrent = async () => {
    if (!editing || !window.confirm(t("confirmDeleteAlbum"))) return;
    setBusy(true);
    try {
      await albumApi.remove(editing.id);
      setAlbums((current) => current.filter((album) => album.id !== editing.id));
      setEditingId(null);
    } catch (reason) {
      setError(`${t("albumActionFailed")}: ${(reason as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-module">
      <SettingsGroup footer={t("electronicAlbumHint")}>
        <SettingsSwitchRow
          id="photo-album-enabled"
          title={t("electronicAlbum")}
          checked={config.photo_album_enabled}
          disabled={!synced}
          onCheckedChange={setPhotoAlbumEnabled}
        />
      </SettingsGroup>

      <SettingsGroup label={t("albumEffect")}>
        {EFFECTS.map((effect) => (
          <button
            type="button"
            key={effect.id}
            disabled={!synced}
            onClick={() => setPhotoAlbumEffect(effect.id)}
            className={cn("settings-row", config.photo_album_effect === effect.id && "is-selected")}
          >
            <span className="settings-row-title">{t(effect.key)}</span>
            {config.photo_album_effect === effect.id ? (
              <span className="settings-row-value text-primary">{t("settingsOn")}</span>
            ) : null}
          </button>
        ))}
      </SettingsGroup>

      <SettingsGroup label={t("albums")} footer={t("dragToReorder")}>
        <button
          type="button"
          className="settings-row"
          onClick={() => {
            setEditingId("new");
            setDraft(emptyDraft());
            setMessage(null);
            setError(null);
          }}
        >
          <span className="settings-row-icon">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="settings-row-title">{t("createAlbum")}</span>
        </button>
      </SettingsGroup>

      {error && !editingId ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {albums.length === 0 ? (
        <div className="settings-group-body px-5 py-10 text-center">
          <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{t("noAlbums")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("noAlbumsHint")}</p>
        </div>
      ) : (
        <SettingsGroup>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onAlbumDragEnd}>
            <SortableContext items={albums.map((album) => album.id)} strategy={verticalListSortingStrategy}>
              {albums.map((album) => (
                <SortableAlbum key={album.id} album={album} onEdit={() => openAlbum(album)} />
              ))}
            </SortableContext>
          </DndContext>
        </SettingsGroup>
      )}

      <Dialog open={editingId != null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <SettingsSheetBar
            title={<DialogTitle>{editingId === "new" ? t("createAlbum") : t("editAlbum")}</DialogTitle>}
            cancelLabel={t("settingsCancel")}
            doneLabel={t("settingsDone")}
            doneDisabled={busy || !draft.title.trim()}
            onCancel={() => setEditingId(null)}
            onDone={() => void save()}
          />
          <div className="settings-sheet-body">
            <SettingsGroup>
              <label className="settings-row">
                <span className="settings-row-title">{t("albumTitle")}</span>
                <input
                  id="album-title"
                  value={draft.title}
                  maxLength={120}
                  autoComplete="off"
                  autoFocus
                  onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
                  className="settings-field-input"
                />
              </label>
              <label className="settings-row settings-row-stack">
                <span className="settings-row-title">{t("albumDescription")}</span>
                <textarea
                  id="album-description"
                  value={draft.description ?? ""}
                  maxLength={2000}
                  rows={3}
                  onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value || null }))}
                  className="settings-field-input is-start settings-field-area"
                />
              </label>
            </SettingsGroup>

            <SettingsGroup>
              <label className="settings-row">
                <span className="settings-row-title">{t("albumDate")}</span>
                <input
                  id="album-date"
                  type="date"
                  value={draft.date ?? ""}
                  onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value || null }))}
                  className="settings-field-input"
                />
              </label>
              <SettingsSliderRow
                id="album-interval"
                title={t("albumInterval")}
                valueLabel={String(draft.interval_s)}
                min={1}
                max={60}
                step={1}
                value={draft.interval_s}
                onChange={(interval_s) => setDraft((value) => ({ ...value, interval_s }))}
              />
              <SettingsSwitchRow
                id="album-home"
                title={t("showOnHome")}
                checked={draft.show_on_home}
                onCheckedChange={(checked) => setDraft((value) => ({ ...value, show_on_home: checked }))}
              />
              <SettingsSwitchRow
                id="album-shuffle"
                title={t("shuffleAlbum")}
                subtitle={t("shuffleAlbumHint")}
                checked={draft.shuffle}
                onCheckedChange={(checked) => setDraft((value) => ({ ...value, shuffle: checked }))}
              />
            </SettingsGroup>

            {editing ? (
              <ImageManager album={editing} busy={busy} onUpload={upload} onChange={replaceAlbum} onBusy={setBusy} onError={setError} onMessage={setMessage} />
            ) : (
              <p className="settings-group-footer">{t("emptyAlbumHint")}</p>
            )}

            {message ? <p className="settings-group-footer" style={{ color: "var(--primary)" }}>{message}</p> : null}
            {error ? <p className="mb-4 rounded-[0.9rem] bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

            {editing ? (
              <SettingsGroup>
                <button
                  type="button"
                  className="settings-row settings-row-destructive"
                  disabled={busy}
                  onClick={() => void deleteCurrent()}
                >
                  <span className="settings-row-title">{t("deleteAlbum")}</span>
                </button>
              </SettingsGroup>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableAlbum({ album, onEdit }: { album: Album; onEdit: () => void }) {
  const { t } = useAppearance();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: album.id });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("settings-list-card", isDragging && "relative z-20 opacity-70")}
    >
      <button type="button" aria-label={t("dragToReorder")} className="touch-none p-1 text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="settings-cover">
        {album.images[0] ? <img src={album.images[0].content_url} alt="" /> : null}
      </div>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <span className="block truncate font-medium">{album.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {album.images.length} {t("albumImages")}
          {album.show_on_home ? ` · ${t("showOnHome")}` : ""}
        </span>
      </button>
      <Button variant="ghost" size="icon" aria-label={t("editAlbum")} onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
    </article>
  );
}

function ImageManager({
  album,
  busy,
  onUpload,
  onChange,
  onBusy,
  onError,
  onMessage,
}: {
  album: Album;
  busy: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onChange: (album: Album) => void;
  onBusy: (busy: boolean) => void;
  onError: (error: string | null) => void;
  onMessage: (message: string | null) => void;
}) {
  const { t } = useAppearance();
  const [pathOpen, setPathOpen] = useState(false);
  const [localPath, setLocalPath] = useState(album.source_dir ?? "");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    setLocalPath(album.source_dir ?? "");
  }, [album.id, album.source_dir]);

  const dragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = album.images.findIndex((image) => image.id === active.id);
    const to = album.images.findIndex((image) => image.id === over.id);
    const images = arrayMove(album.images, from, to);
    onChange({ ...album, images });
    try {
      onChange(await albumApi.orderImages(album.id, images.map((image) => image.id)));
    } catch (reason) {
      onChange(album);
      onError(`${t("albumActionFailed")}: ${(reason as Error).message}`);
    }
  };

  const remove = async (image: AlbumImage) => {
    onBusy(true);
    onError(null);
    try {
      onChange(await albumApi.removeImage(album.id, image.id));
    } catch (reason) {
      onError(`${t("albumActionFailed")}: ${(reason as Error).message}`);
    } finally {
      onBusy(false);
    }
  };

  const scanLocal = async () => {
    const path = localPath.trim();
    if (!path) return;
    const previous = album.images.length;
    onBusy(true);
    onError(null);
    onMessage(null);
    try {
      const next = await albumApi.importFromPath(album.id, path);
      onChange(next);
      const added = Math.max(0, next.images.length - previous);
      onMessage(added > 0 ? t("localPathLoaded", { count: added }) : t("localPathNoNew"));
    } catch (reason) {
      onError(`${t("albumActionFailed")}: ${(reason as Error).message}`);
    } finally {
      onBusy(false);
    }
  };

  return (
    <>
      <SettingsGroup label={t("albumImages")} footer={t("emptyAlbumHint")}>
        <label className={cn("settings-row", busy && "is-disabled")}>
          <span className="settings-row-icon" aria-hidden="true">
            <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="settings-row-title">{busy ? t("uploadingImages") : t("uploadImages")}</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="sr-only"
            disabled={busy}
            onChange={onUpload}
          />
          <ChevronRight className="settings-row-chevron" aria-hidden="true" />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPathOpen((open) => !open)}
          className="settings-row"
        >
          <span className="settings-row-icon" aria-hidden="true">
            <FolderOpen className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="settings-row-copy">
            <span className="settings-row-title">{t("configureLocalPath")}</span>
          </span>
          <ChevronRight className="settings-row-chevron" aria-hidden="true" />
        </button>
      </SettingsGroup>

      {pathOpen ? (
        <SettingsGroup label={t("localPathLabel")} footer={t("configureLocalPathHint")}>
          <label className="settings-row settings-row-stack">
            <input
              id="album-local-path"
              value={localPath}
              placeholder={t("localPathPlaceholder")}
              onChange={(event) => setLocalPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void scanLocal();
                }
              }}
              className="settings-field-input is-start"
            />
          </label>
          <button
            type="button"
            className="settings-row"
            disabled={busy || !localPath.trim()}
            onClick={() => void scanLocal()}
          >
            <span className="settings-row-title text-primary">
              {busy ? t("scanningLocalPath") : t("scanLocalPath")}
            </span>
          </button>
        </SettingsGroup>
      ) : null}

      {album.images.length === 0 ? (
        <p className="settings-group-footer">{t("emptyAlbum")}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
          <SortableContext items={album.images.map((image) => image.id)} strategy={rectSortingStrategy}>
            <div className="mb-4 grid grid-cols-3 gap-1.5">
              {album.images.map((image, index) => (
                <SortableImage key={image.id} image={image} cover={index === 0} onDelete={() => remove(image)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}

function SortableImage({ image, cover, onDelete }: { image: AlbumImage; cover: boolean; onDelete: () => void }) {
  const { t } = useAppearance();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("group relative aspect-[4/3] overflow-hidden rounded-lg bg-muted", isDragging && "z-20 opacity-70")}>
      <img src={image.content_url} alt={image.original_name} className="h-full w-full object-cover" />
      <button type="button" aria-label={t("dragToReorder")} className="absolute left-1 top-1 touch-none rounded-md bg-black/55 p-1.5 text-white backdrop-blur" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      {cover ? <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">{t("albumCover")}</span> : null}
      <button type="button" aria-label={t("deleteImage")} onClick={onDelete} className="absolute right-1 top-1 rounded-md bg-black/55 p-1.5 text-white opacity-100 backdrop-blur hover:bg-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
