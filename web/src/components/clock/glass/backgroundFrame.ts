/** Called synchronously after the upstream renderer's final screen pass.
 * WebGL's default drawing buffer can be cleared once that callback returns.
 */
export const CLOCK_BACKGROUND_FRAME = "clock-background-frame";

export function publishBackgroundFrame(canvas: HTMLCanvasElement) {
  canvas.dispatchEvent(new CustomEvent(CLOCK_BACKGROUND_FRAME, { bubbles: true }));
}
