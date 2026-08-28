import type { IllustrationImage, IllustrationsResponse, PixelArtSettings } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? body?.message ?? `Request failed (${response.status})`);
  }
  return body as T;
}

export const illustrationApi = {
  list: () => request<IllustrationsResponse>("/api/illustrations"),
  updateSettings: (settings: PixelArtSettings) =>
    request<IllustrationsResponse>("/api/illustrations/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    return request<IllustrationsResponse>("/api/illustrations/images", {
      method: "POST",
      body: form,
    });
  },
  order: (ids: string[]) =>
    request<IllustrationsResponse>("/api/illustrations/images/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  remove: (id: string) =>
    request<IllustrationsResponse>(`/api/illustrations/images/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  contentUrl: (image: IllustrationImage) => image.content_url,
};
