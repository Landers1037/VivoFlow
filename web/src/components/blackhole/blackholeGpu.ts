import shaderSource from "./black_hole.wgsl?raw";
import {
  SPIN_OMEGA,
  TARGET_DT,
  UNIFORM_FLOATS,
  canvasPixelSize,
  createBlackholeView,
  writeUniforms,
  type BlackholeGpuParams,
} from "./blackholeRuntime";

export type { BlackholeGpuParams };

const MAX_SHORT_SIDE = 800;

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.gpu);
}

export async function startBlackholeGpu(
  canvas: HTMLCanvasElement,
  params: { current: BlackholeGpuParams },
): Promise<() => void> {
  const gpu = navigator.gpu;
  if (!gpu) throw new Error("WebGPU unavailable");

  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU adapter unavailable");
  const device = await adapter.requestDevice();
  const format = gpu.getPreferredCanvasFormat();
  const uniformData = new Float32Array(UNIFORM_FLOATS);
  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const dummyTexture = device.createTexture({
    size: [1, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture: dummyTexture },
    new Uint8Array([0, 0, 0, 255]),
    { bytesPerRow: 4 },
    [1, 1],
  );
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  let pipeline: GPURenderPipeline;
  try {
    const module = device.createShaderModule({ code: shaderSource });
    pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vs_main" },
      fragment: {
        module,
        entryPoint: "fs_main",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
  } catch (error) {
    dummyTexture.destroy();
    uniformBuffer.destroy();
    device.destroy();
    throw error;
  }

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: dummyTexture.createView() },
      { binding: 2, resource: sampler },
    ],
  });

  const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!context) {
    dummyTexture.destroy();
    uniformBuffer.destroy();
    device.destroy();
    throw new Error("WebGPU canvas context unavailable");
  }

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
    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
  };

  const frame = (ts: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      lastTs = ts;
      return;
    }
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
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  };

  configure();
  raf = requestAnimationFrame(frame);

  const onLost = () => {
    if (!disposed) dispose();
  };
  device.lost.then(onLost);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    detachView();
    dummyTexture.destroy();
    uniformBuffer.destroy();
    device.destroy();
  }

  return dispose;
}
