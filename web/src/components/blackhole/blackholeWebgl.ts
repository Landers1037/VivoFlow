import fragSource from "./black_hole.frag.glsl?raw";
import vertSource from "./black_hole.vert.glsl?raw";
import {
  SPIN_OMEGA,
  UNIFORM_CORE_BYTES,
  canvasPixelSize,
  createBlackholeView,
  writeUniforms,
  type BlackholeGpuParams,
} from "./blackholeRuntime";

const MAX_SHORT_SIDE = 560;
const TARGET_DT = 1 / 24;
const UNIFORM_FLOATS = 64;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL2 shader alloc failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "compile failed";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vert: WebGLShader, frag: WebGLShader) {
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL2 program alloc failed");
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "link failed";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

export function startBlackholeWebgl(
  canvas: HTMLCanvasElement,
  params: { current: BlackholeGpuParams },
): () => void {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("WebGL2 unavailable");
  const glCtx = gl;

  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = linkProgram(gl, vert, frag);
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  const blockIndex = gl.getUniformBlockIndex(program, "Uniforms");
  if (blockIndex === gl.INVALID_INDEX) {
    gl.deleteProgram(program);
    throw new Error("WebGL2 uniform block missing");
  }
  gl.uniformBlockBinding(program, blockIndex, 0);
  const blockSize = Number(gl.getActiveUniformBlockParameter(
    program,
    blockIndex,
    gl.UNIFORM_BLOCK_DATA_SIZE,
  ));

  const vao = gl.createVertexArray();
  const ubo = gl.createBuffer();
  if (!vao || !ubo) {
    gl.deleteProgram(program);
    throw new Error("WebGL2 buffer alloc failed");
  }

  const uniformFloats = Math.max(UNIFORM_FLOATS, Math.ceil(Math.max(blockSize, UNIFORM_CORE_BYTES) / 4));
  const uniformData = new Float32Array(uniformFloats);
  gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
  gl.bufferData(gl.UNIFORM_BUFFER, uniformData.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);

  gl.bindVertexArray(vao);
  gl.useProgram(program);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 1);

  const view = createBlackholeView(params);
  const detachView = view.attach(canvas);

  let disposed = false;
  let raf = 0;
  let width = 0;
  let height = 0;
  let spinPhase = 0;
  let lastTs = 0;

  const configure = () => {
    const size = canvasPixelSize(canvas, MAX_SHORT_SIDE);
    if (size.width === width && size.height === height) return;
    width = size.width;
    height = size.height;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  };

  const frame = (ts: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      lastTs = ts;
      return;
    }
    if (gl.isContextLost()) return;
    if (lastTs === 0) lastTs = ts;
    const dt = Math.min(0.25, (ts - lastTs) / 1000);
    if (dt < TARGET_DT * 0.85 && lastTs !== ts) return;
    lastTs = ts;
    const sampled = view.sample();
    spinPhase += SPIN_OMEGA * sampled.speed * dt;
    configure();
    writeUniforms(
      uniformData,
      width,
      height,
      ts / 1000,
      spinPhase,
      sampled.incl,
      sampled.roll,
      sampled.holeRadius,
      sampled.diskSpeed,
      sampled.tint,
    );
    gl.bindVertexArray(vao);
    gl.useProgram(program);
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, uniformData.subarray(0, UNIFORM_CORE_BYTES / 4));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const onLost = (event: Event) => {
    event.preventDefault();
    dispose();
  };
  canvas.addEventListener("webglcontextlost", onLost, false);

  configure();
  raf = requestAnimationFrame(frame);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    canvas.removeEventListener("webglcontextlost", onLost);
    detachView();
    if (!glCtx.isContextLost()) {
      glCtx.deleteBuffer(ubo);
      glCtx.deleteVertexArray(vao);
      glCtx.deleteProgram(program);
    }
  }

  return dispose;
}
