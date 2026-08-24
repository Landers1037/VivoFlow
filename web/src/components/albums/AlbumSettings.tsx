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
import { CalendarDays, GripVertical, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppearance } from "@/hooks/useAppearance";
import { albumApi, type AlbumInput } from "@/lib/albums";
import { cn } from "@/lib/utils";
import type { Album, AlbumImage, PhotoAlbumEffect } from "@/types";
import { CardLinearSpread } from "./CardLinearSpread";

const INPUT_CLASS =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <div>
            <Label htmlFor="photo-album-enabled">{t("electronicAlbum")}</Label>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              {t("electronicAlbumHint")}
            </p>
          </div>
          <Switch
            id="photo-album-enabled"
            checked={config.photo_album_enabled}
            disabled={!synced}
            onCheckedChange={setPhotoAlbumEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("albumEffect")}</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {EFFECTS.map((effect) => (
              <button
                type="button"
                key={effect.id}
                disabled={!synced}
                onClick={() => setPhotoAlbumEffect(effect.id)}
                className={cn(
                  "min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  config.photo_album_effect === effect.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t(effect.key)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <div>
          <h2 className="text-base font-semibold">{t("albums")}</h2>
          <p className="text-xs text-muted-foreground">{t("dragToReorder")}</p>
        </div>
        <Button
          onClick={() => {
            setEditingId("new");
            setDraft(emptyDraft());
            setMessage(null);
            setError(null);
          }}
        >
          <Plus className="h-4 w-4" /> {t("createAlbum")}
        </Button>
      </div>

      {error && !editingId ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {albums.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{t("noAlbums")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("noAlbumsHint")}</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onAlbumDragEnd}>
          <SortableContext items={albums.map((album) => album.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {albums.map((album) => (
                <SortableAlbum key={album.id} album={album} onEdit={() => openAlbum(album)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={editingId != null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId === "new" ? t("createAlbum") : t("editAlbum")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="album-title">{t("albumTitle")}</Label>
                <input
                  id="album-title"
                  value={draft.title}
                  maxLength={120}
                  onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="album-description">{t("albumDescription")}</Label>
                <textarea
                  id="album-description"
                  value={draft.description ?? ""}
                  maxLength={2000}
                  rows={3}
                  onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value || null }))}
                  className={cn(INPUT_CLASS, "py-2.5")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="album-date">{t("albumDate")}</Label>
                <input
                  id="album-date"
                  type="date"
                  value={draft.date ?? ""}
                  onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value || null }))}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="album-interval">{t("albumInterval")}</Label>
                <input
                  id="album-interval"
                  type="number"
                  min={1}
                  max={60}
                  value={draft.interval_s}
                  onChange={(event) => setDraft((value) => ({ ...value, interval_s: Number(event.target.value) }))}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="vf-row flex min-h-14 items-center justify-between gap-3 px-3 py-2">
                <Label htmlFor="album-home">{t("showOnHome")}</Label>
                <Switch id="album-home" checked={draft.show_on_home} onCheckedChange={(checked) => setDraft((value) => ({ ...value, show_on_home: checked }))} />
              </div>
              <div className="vf-row flex min-h-14 items-center justify-between gap-3 px-3 py-2">
                <div>
                  <Label htmlFor="album-shuffle">{t("shuffleAlbum")}</Label>
                  <p className="text-[11px] text-muted-foreground">{t("shuffleAlbumHint")}</p>
                </div>
                <Switch id="album-shuffle" checked={draft.shuffle} onCheckedChange={(checked) => setDraft((value) => ({ ...value, shuffle: checked }))} />
              </div>
            </div>

            <Button className="w-full" disabled={busy || !draft.title.trim()} onClick={save}>
              {busy ? t("loading") : t("saveAlbum")}
            </Button>

            {editing ? (
              <ImageManager album={editing} busy={busy} onUpload={upload} onChange={replaceAlbum} onBusy={setBusy} onError={setError} />
            ) : null}

            {message ? <p className="text-sm text-primary">{message}</p> : null}
            {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

            {editing ? (
              <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10" disabled={busy} onClick={deleteCurrent}>
                <Trash2 className="h-4 w-4" /> {t("deleteAlbum")}
              </Button>
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
      className={cn("vf-row flex items-center gap-3 p-3", isDragging && "relative z-20 opacity-70 shadow-xl")}
    >
      <button type="button" aria-label={t("dragToReorder")} className="touch-none rounded-md p-1 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </button>
      <CardLinearSpread images={album.images} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold">{album.title}</h3>
          {album.show_on_home ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{t("showOnHome")}</span> : null}
        </div>
        {album.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{album.description}</p> : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{album.images.length} {t("albumImages")}</span>
          {album.date ? <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{album.date}</span> : null}
          <span>{album.interval_s}s</span>
        </p>
      </div>
      <Button variant="outline" size="icon" aria-label={t("editAlbum")} onClick={onEdit}>
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
}: {
  album: Album;
  busy: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onChange: (album: Album) => void;
  onBusy: (busy: boolean) => void;
  onError: (error: string | null) => void;
}) {
  const { t } = useAppearance();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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

  return (
    <section className="space-y-3 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">{t("albumImages")}</h3>
          <p className="text-xs text-muted-foreground">{t("emptyAlbumHint")}</p>
        </div>
        <label className={cn("inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground", busy && "pointer-events-none opacity-60")}>
          <ImagePlus className="h-4 w-4" />
          {busy ? t("uploadingImages") : t("uploadImages")}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" onChange={onUpload} />
        </label>
      </div>

      {album.images.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{t("emptyAlbum")}</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
          <SortableContext items={album.images.map((image) => image.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {album.images.map((image, index) => <SortableImage key={image.id} image={image} cover={index === 0} onDelete={() => remove(image)} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
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
