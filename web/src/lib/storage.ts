import type { StorageStatus } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? body?.message ?? `Request failed (${response.status})`);
  }
  return body as T;
}

export const storageApi = {
  status: () => request<StorageStatus>("/api/storage"),
  setRoot: (root_path: string) =>
    request<StorageStatus>("/api/storage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root_path }),
    }),
  open: () => request<void>("/api/storage/open", { method: "POST" }),
};
