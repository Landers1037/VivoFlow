import { GlassGlyphRenderer } from "../src/components/clock/glass/GlassGlyphRenderer";

/** Run in a real browser: these checks exercise canvas uploads and shader output,
 * which jsdom cannot validate. The striped source is a test fixture only.
 */
export async function checkGlassRendering() {
  await document.fonts.load("400 256px Jua", "08周日9月13日");
  const width = 600, height = 320;
  const canvas = document.createElement("canvas");
  const renderer = new GlassGlyphRenderer(canvas);
  renderer.resize(width, height, 1);
  renderer.setFont("400 256px Jua");
  const gl = canvas.getContext("webgl")!;
  const source = document.createElement("canvas");
  source.width = width; source.height = height;
  const context = source.getContext("2d")!;
  const paint = (offset: number) => {
    context.fillStyle = "#182040"; context.fillRect(0, 0, width, height);
    for (let x = -40; x < width; x += 40) {
      context.fillStyle = "#d5f5ff"; context.fillRect(x + offset, 0, 12, height);
    }
  };
  const read = () => {
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  };
  const at = (pixels: Uint8Array, x: number, y: number) => pixels.slice(((height - 1 - y) * width + x) * 4, ((height - 1 - y) * width + x) * 4 + 3);
  const delta = (a: Uint8Array, b: Uint8Array) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0);
  const unchangedRatio = (a: Uint8Array, b: Uint8Array) => {
    let unchanged = 0;
    let total = 0;
    for (let y = 145; y <= 175; y += 3) for (let x = 288; x <= 312; x += 3) {
      if (delta(at(a, x, y), at(b, x, y)) <= 3) unchanged++;
      total++;
    }
    return unchanged / total;
  };
  const results: Record<string, boolean | number> = {};
  try {
    paint(0);
    renderer.uploadBackground(source);
    renderer.begin([0, 0, 0]);
    const base = read();
    renderer.drawText("0", 220, 300, 240);
    const glass = read();
    results.holeUnchangedRatio = unchangedRatio(base, glass);
    results.exteriorUnchanged = delta(at(base, 30, 30), at(glass, 30, 30)) === 0;
    let changed = 0;
    // On the dark stripe interiors, bright samples far above the neutral rim
    // demonstrate actual displaced background detail, not a uniform glass fill.
    let refractedDetail = 0;
    for (let y = 90; y < 230; y++) for (let x = 220; x < 380; x++) {
      const a = at(base, x, y), b = at(glass, x, y);
      if (delta(a, b) > 12) changed++;
      if (a[0] < 40 && b[0] > 120 && b[1] > 140) refractedDetail++;
    }
    results.changedStrokePixels = changed;
    results.refractedDetailPixels = refractedDetail;
    renderer.begin([0, 0, 0]);
    renderer.drawText("8", 220, 300, 240);
    results.timeChangeKeepsBackground = delta(at(base, 30, 30), at(read(), 30, 30)) === 0;
    renderer.begin([0, 0, 0]);
    const metadataBase = read();
    renderer.drawText("周日 · 9月13日", 42, 300, 292);
    const metadataGlass = read();
    let metadataGlassPixels = 0;
    for (let y = 245; y < 310; y++) for (let x = 130; x < 470; x++) {
      if (delta(at(metadataBase, x, y), at(metadataGlass, x, y)) > 12) metadataGlassPixels++;
    }
    results.metadataGlassPixels = metadataGlassPixels;
    paint(20);
    renderer.uploadBackground(source);
    renderer.begin([0, 0, 0]);
    const nextBase = read();
    renderer.drawText("0", 220, 300, 240);
    const nextGlass = read();
    results.sameFrameExterior = delta(at(nextBase, 30, 30), at(nextGlass, 30, 30)) === 0;
    results.sameFrameHoleRatio = unchangedRatio(nextBase, nextGlass);
    results.newFrameUploaded = delta(at(base, 30, 30), at(nextBase, 30, 30)) > 50;
    results.glError = gl.getError();
    results.passed = Number(results.holeUnchangedRatio) > 0.85 && results.exteriorUnchanged && results.timeChangeKeepsBackground && results.sameFrameExterior && Number(results.sameFrameHoleRatio) > 0.85 && results.newFrameUploaded && changed > 500 && refractedDetail > 100 && metadataGlassPixels > 100 && results.glError === 0;
    return results;
  } finally { renderer.dispose(); }
}
