interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}

interface GPUDevice {
  readonly queue: GPUQueue;
  readonly lost: Promise<unknown>;
  createBuffer(descriptor: { size: number; usage: number }): GPUBuffer;
  createTexture(descriptor: {
    size: [number, number];
    format: GPUTextureFormat;
    usage: number;
  }): GPUTexture;
  createSampler(descriptor: { magFilter: string; minFilter: string }): GPUSampler;
  createShaderModule(descriptor: { code: string }): GPUShaderModule;
  createRenderPipeline(descriptor: {
    layout: "auto";
    vertex: { module: GPUShaderModule; entryPoint: string };
    fragment: {
      module: GPUShaderModule;
      entryPoint: string;
      targets: { format: GPUTextureFormat }[];
    };
    primitive: { topology: string };
  }): GPURenderPipeline;
  createBindGroup(descriptor: {
    layout: GPUBindGroupLayout;
    entries: { binding: number; resource: GPUBindingResource }[];
  }): GPUBindGroup;
  createCommandEncoder(): GPUCommandEncoder;
  destroy(): void;
}

interface GPUQueue {
  writeBuffer(buffer: GPUBuffer, offset: number, data: BufferSource): void;
  writeTexture(
    destination: { texture: GPUTexture },
    data: BufferSource,
    layout: { bytesPerRow: number },
    size: [number, number],
  ): void;
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

interface GPUBuffer {
  destroy(): void;
}

interface GPUTexture {
  createView(): GPUTextureView;
  destroy(): void;
}

interface GPUTextureView {}
interface GPUSampler {}
interface GPUShaderModule {}
interface GPUBindGroup {}
interface GPUBindGroupLayout {}
interface GPUCommandBuffer {}

interface GPURenderPipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

interface GPUCommandEncoder {
  beginRenderPass(descriptor: {
    colorAttachments: {
      view: GPUTextureView;
      loadOp: "clear" | "load";
      storeOp: "store" | "discard";
      clearValue: { r: number; g: number; b: number; a: number };
    }[];
  }): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  draw(vertexCount: number): void;
  end(): void;
}

interface GPUCanvasContext {
  configure(descriptor: {
    device: GPUDevice;
    format: GPUTextureFormat;
    alphaMode: "opaque" | "premultiplied";
  }): void;
  getCurrentTexture(): GPUTexture;
}

type GPUTextureFormat = string;
type GPUBindingResource =
  | { buffer: GPUBuffer }
  | GPUTextureView
  | GPUSampler;

interface GPUBufferUsage {
  readonly UNIFORM: number;
  readonly COPY_DST: number;
}

interface GPUTextureUsage {
  readonly TEXTURE_BINDING: number;
  readonly COPY_DST: number;
}

declare var GPUBufferUsage: GPUBufferUsage;
declare var GPUTextureUsage: GPUTextureUsage;

interface Navigator {
  readonly gpu?: GPU;
}

interface HTMLCanvasElement {
  getContext(contextId: "webgpu"): GPUCanvasContext | null;
}
