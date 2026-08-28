/** iPhone / iPad (including iPadOS that reports as Mac). All browsers on iOS are WebKit. */
export function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * Safari's WebGPU (iOS 18+ and desktop) often returns an adapter, so Three.js
 * will not fall back to WebGL — then TSL output stays a black canvas.
 */
export function shouldForceWebGL(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!navigator.gpu) return true;
  if (isAppleMobile()) return true;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/i.test(ua);
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
