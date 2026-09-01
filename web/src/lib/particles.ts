import type { ParticleLibraryResponse } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? body?.message ?? `Request failed (${response.status})`);
  return body as T;
}

export const particleApi = {
  list: () => request<ParticleLibraryResponse>("/api/particles"),
  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    return request<ParticleLibraryResponse>("/api/particles/images", { method: "POST", body: form });
  },
  setActive: (id: string) => request<ParticleLibraryResponse>("/api/particles/active", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }),
  remove: (id: string) => request<ParticleLibraryResponse>(`/api/particles/images/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
