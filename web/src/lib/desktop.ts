const OPEN_SETTINGS_EVENT = "vivoflow-open-settings";
const PAGE_EVENT = "vivoflow-desktop-page";

export type DesktopPage = "dashboard" | "settings";

export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function requestOpenSettings(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

export function onOpenSettings(handler: () => void): () => void {
  window.addEventListener(OPEN_SETTINGS_EVENT, handler);
  return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
}

export function publishDesktopPage(page: DesktopPage): void {
  document.documentElement.dataset.page = page;
  window.dispatchEvent(new CustomEvent<DesktopPage>(PAGE_EVENT, { detail: page }));
}

export function onDesktopPage(handler: (page: DesktopPage) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<DesktopPage>).detail);
  window.addEventListener(PAGE_EVENT, listener);
  return () => window.removeEventListener(PAGE_EVENT, listener);
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

export async function desktopWindowFullscreen(): Promise<boolean> {
  return (await currentWindow()).isFullscreen();
}

let fullscreenChain: Promise<void> = Promise.resolve();

export function setDesktopFullscreen(fullscreen: boolean): Promise<void> {
  const task = fullscreenChain.then(() => changeDesktopFullscreen(fullscreen));
  fullscreenChain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

async function changeDesktopFullscreen(fullscreen: boolean): Promise<void> {
  const win = await currentWindow();
  if ((await win.isFullscreen()) === fullscreen) return;
  await win.setFullscreen(fullscreen);
}

export async function watchDesktopResize(handler: () => void): Promise<() => void> {
  return (await currentWindow()).onResized(() => handler());
}

export async function watchDesktopFocus(handler: (focused: boolean) => void): Promise<() => void> {
  return (await currentWindow()).onFocusChanged(({ payload }) => handler(payload));
}
