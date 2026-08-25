import type { Album } from "@/types";

export interface AlbumInput {
  title: string;
  description: string | null;
  date: string | null;
  show_on_home: boolean;
  shuffle: boolean;
  interval_s: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Preserve the status based fallback.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const albumApi = {
  list: () => request<Album[]>("/api/albums"),
  create: (input: AlbumInput) => request<Album>("/api/albums", json("POST", input)),
  update: (id: string, input: AlbumInput) =>
    request<Album>(`/api/albums/${id}`, json("PATCH", input)),
  remove: (id: string) => request<Album>(`/api/albums/${id}`, { method: "DELETE" }),
  order: (ids: string[]) => request<Album[]>("/api/albums/order", json("PUT", { ids })),
  upload: (id: string, files: File[]) => {
    const body = new FormData();
    files.forEach((file) => body.append("images", file));
    return request<Album>(`/api/albums/${id}/images`, { method: "POST", body });
  },
  importFromPath: (id: string, path: string) =>
    request<Album>(`/api/albums/${id}/images/from-path`, json("POST", { path })),
  orderImages: (id: string, ids: string[]) =>
    request<Album>(`/api/albums/${id}/images/order`, json("PUT", { ids })),
  removeImage: (albumId: string, imageId: string) =>
    request<Album>(`/api/albums/${albumId}/images/${imageId}`, { method: "DELETE" }),
};

export function shuffled<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}
