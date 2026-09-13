import { createGlyphField, DISTANCE_RANGE, GLYPH_SIZE, type GlyphField } from "./glyphField";

/** WebGL port of React Bits GlassSurface's displacement -> RGB isolation ->
 * screen blend -> blur filter. Its rectangular gradient map is replaced by a
 * font contour field. See references/GlassSurface.tsx.txt and its license.
 */
const vertexShader = `
attribute vec2 position;
uniform vec2 resolution;
uniform vec4 rect;
varying vec2 uv;
varying vec2 screenUv;
void main() {
  uv = position;
  screenUv = (rect.xy + position * rect.zw) / resolution;
  gl_Position = vec4(screenUv * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}`;

const fragmentShader = `
precision highp float;
uniform sampler2D background;
uniform sampler2D glyph;
uniform vec2 resolution;
uniform vec3 baseColor;
uniform float glyphScale;
uniform float glass;
varying vec2 uv;
varying vec2 screenUv;

vec3 backdrop(vec2 p) {
  vec4 source = texture2D(background, clamp(p, vec2(0.0), vec2(1.0)));
  return mix(baseColor, source.rgb, source.a);
}
vec3 softBackdrop(vec2 p) {
  // GlassSurface's final feGaussianBlur; keep small text and moving detail clear.
  vec2 blur = vec2(0.65) / resolution;
  return backdrop(p) * 0.4 + (backdrop(p + vec2(blur.x, 0.0))
    + backdrop(p - vec2(blur.x, 0.0)) + backdrop(p + vec2(0.0, blur.y))
    + backdrop(p - vec2(0.0, blur.y))) * 0.15;
}
void main() {
  vec3 original = backdrop(screenUv);
  if (glass < 0.5) { gl_FragColor = vec4(original, 1.0); return; }
  vec4 field = texture2D(glyph, uv);
  float distance = (field.b * 2.0 - 1.0) * ${DISTANCE_RANGE.toFixed(1)} * glyphScale;
  vec2 normal = field.rg * 2.0 - 1.0;
  float bevelWidth = max(2.0, 18.0 * glyphScale);
  float depth = clamp(max(distance, 0.0) / bevelWidth, 0.0, 1.0);
  // Curved lens: steep at the silhouette and relaxed at the centre of each stroke.
  float slope = 1.0 - smoothstep(0.0, 1.0, depth);
  vec2 map = normal * slope * 0.28;
  // feDisplacementMap: P' = P + scale * (mapChannel - 0.5).
  // These are the example's distortionScale=-150 and RGB offsets=5/15/25.
  vec2 displacement = map * glyphScale / resolution;
  vec3 refracted = vec3(
    softBackdrop(screenUv - 145.0 * displacement).r,
    softBackdrop(screenUv - 135.0 * displacement).g,
    softBackdrop(screenUv - 125.0 * displacement).b
  );
  // Isolated channels combined with screen have precisely this RGB result.
  // Neutral, directional reflections replace the old opaque blue fill/neon strokes.
  float facing = dot(normal, normalize(vec2(-0.55, -0.83)));
  float rim = exp(-max(distance, 0.0) / max(0.75, 1.5 * glyphScale));
  float smallGlyph = 1.0 - smoothstep(0.08, 0.24, glyphScale);
  float highlight = pow(max(facing, 0.0), 3.0) * 0.8 + pow(max(-facing, 0.0), 5.0) * 0.28;
  float reflection = rim * (0.25 + highlight + smallGlyph * 0.32)
    + slope * slope * max(facing, 0.0) * 0.12 + smallGlyph * 0.055;
  refracted *= 1.0 - slope * max(-facing, 0.0) * 0.12;
  refracted = mix(refracted, vec3(1.0), clamp(reflection, 0.0, 0.88));
  // Glyph holes and the exterior use the unmodified frame, including alpha.
  gl_FragColor = vec4(mix(original, refracted, field.a), 1.0);
}`;

type CachedGlyph = GlyphField & { texture: WebGLTexture };

export class GlassGlyphRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private background: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null>;
  private glyphs = new Map<string, CachedGlyph>();
  private font = "";
  private width = 1;
  private height = 1;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    const shaders: WebGLShader[] = [];
    try {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Unable to allocate glass shader");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Glass shader compilation failed");
        return shader;
      };
      const program = gl.createProgram();
      if (!program) throw new Error("Unable to allocate glass program");
      this.program = program;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Glass shader linking failed");
      gl.useProgram(program);
      this.uniforms = Object.fromEntries(["resolution", "rect", "baseColor", "glyphScale", "glass", "background", "glyph"].map(name => [name, gl.getUniformLocation(program, name)]));
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to allocate glass geometry");
      this.buffer = buffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(this.uniforms.background, 0);
      gl.uniform1i(this.uniforms.glyph, 1);
      gl.activeTexture(gl.TEXTURE0);
      this.background = this.texture();
      this.clearBackground();
      // A complete texture is required on both samplers even for the base pass.
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.background);
    } catch (error) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      throw error;
    } finally {
      shaders.forEach(shader => gl.deleteShader(shader));
    }
  }

  private texture() {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Unable to allocate glass texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  clearBackground() {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.background);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  uploadBackground(source: HTMLCanvasElement) {
    if (!source.width || !source.height) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.background);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.uniform2f(this.uniforms.resolution, width, height);
  }

  setFont(font: string, force = false) {
    if (font === this.font && !force) return;
    this.glyphs.forEach(glyph => this.gl.deleteTexture(glyph.texture));
    this.glyphs.clear();
    this.font = font;
  }

  private glyph(character: string) {
    const existing = this.glyphs.get(character);
    if (existing) return existing;
    const field = createGlyphField(character, this.font);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    const texture = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, field.width, field.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, field.pixels);
    const glyph = { ...field, texture };
    this.glyphs.set(character, glyph);
    return glyph;
  }

  measureText(text: string, size: number) {
    const scale = size / GLYPH_SIZE;
    return [...text].reduce((sum, character) => sum + this.glyph(character).advance * scale, 0) + Math.max(0, text.length - 1) * size * 0.045;
  }

  begin(baseColor: [number, number, number]) {
    const gl = this.gl;
    gl.uniform3f(this.uniforms.baseColor, ...baseColor);
    gl.uniform1f(this.uniforms.glass, 0);
    gl.uniform4f(this.uniforms.rect, 0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawText(text: string, size: number, centerX: number, baseline: number) {
    const gl = this.gl;
    const scale = size / GLYPH_SIZE;
    let x = centerX - this.measureText(text, size) / 2;
    gl.uniform1f(this.uniforms.glass, 1);
    gl.uniform1f(this.uniforms.glyphScale, scale);
    for (const character of text) {
      const glyph = this.glyph(character);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, glyph.texture);
      gl.uniform4f(this.uniforms.rect, x - glyph.left * scale, baseline - glyph.top * scale, glyph.width * scale, glyph.height * scale);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      x += glyph.advance * scale + size * 0.045;
    }
  }

  dispose() {
    const gl = this.gl;
    this.glyphs.forEach(glyph => gl.deleteTexture(glyph.texture));
    this.glyphs.clear();
    gl.deleteTexture(this.background);
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
