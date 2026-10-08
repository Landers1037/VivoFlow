export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export async function minimizeDesktopWindow(): Promise<void> {
  await (await currentWindow()).minimize();
}

export async function toggleDesktopMaximize(): Promise<void> {
  await (await currentWindow()).toggleMaximize();
}

export async function closeDesktopWindow(): Promise<void> {
  await (await currentWindow()).close();
}

export async function desktopWindowMaximized(): Promise<boolean> {
  return (await currentWindow()).isMaximized();
}

export async function watchDesktopResize(handler: () => void): Promise<() => void> {
  return (await currentWindow()).onResized(() => handler());
}
