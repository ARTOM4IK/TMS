import { mat4 } from '../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js';

function CreateUnitCubeVertices()
{
  const H = 0.5;
  const P = [
    [-H, -H, H], [H, -H, H], [H, H, H], [-H, H, H],
    [H, -H, -H], [-H, -H, -H], [-H, H, -H], [H, H, -H],
    [-H, H, H], [H, H, H], [H, H, -H], [-H, H, -H],
    [-H, -H, -H], [H, -H, -H], [H, -H, H], [-H, -H, H],
    [H, -H, H], [H, -H, -H], [H, H, -H], [H, H, H],
    [-H, -H, -H], [-H, -H, H], [-H, H, H], [-H, H, -H]
  ];
  const Tris = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23
  ];
  const Vertices = new Float32Array(Tris.length * 3);
  for (let I = 0; I < Tris.length; I++)
  {
    Vertices[I * 3] = P[Tris[I]][0];
    Vertices[I * 3 + 1] = P[Tris[I]][1];
    Vertices[I * 3 + 2] = P[Tris[I]][2];
  }
  return Vertices;
}

const PLAYER_UNIFORM_USAGE = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
const PLAYER_UNIFORM_SIZE = 80;

export class PlayerRenderer
{
  constructor(Renderer)
  {
    this.renderer = Renderer;
    this.playerUniforms = new Map();
  }

  async init()
  {
    const Gpu = this.renderer.webgpu;
    const Shader = await this.renderer.shaders.loadModule('player', '../bin/shaders/player.wgsl');

    this.sceneBuffer = this.renderer.bufferPool.getBuffer(64, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

    const SceneLayout = Gpu.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }]
    });
    this.playerLayout = Gpu.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
    });

    this.pipeline = this.renderer.pipelines.createRenderPipeline('player', {
      layout: Gpu.device.createPipelineLayout({ bindGroupLayouts: [SceneLayout, this.playerLayout] }),
      vertexModule: Shader,
      vertexEntry: 'vs_main',
      vertexBuffers: [{
        arrayStride: 12,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
      }],
      fragmentModule: Shader,
      fragmentEntry: 'fs_main',
      targets: [{ format: Gpu.format }],
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    });

    this.sceneBindGroup = Gpu.device.createBindGroup({
      layout: SceneLayout,
      entries: [{ binding: 0, resource: { buffer: this.sceneBuffer } }]
    });

    const Vertices = CreateUnitCubeVertices();
    this.vertexBuffer = Gpu.device.createBuffer({
      size: Vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(Vertices);
    this.vertexBuffer.unmap();
    this.vertexCount = Vertices.length / 3;
  }

  getPlayerGpu(RemoteId)
  {
    if (!this.playerUniforms.has(RemoteId))
    {
      const Buffer = this.renderer.bufferPool.getBuffer(PLAYER_UNIFORM_SIZE, PLAYER_UNIFORM_USAGE);
      const BindGroup = this.renderer.webgpu.device.createBindGroup({
        layout: this.playerLayout,
        entries: [{ binding: 0, resource: { buffer: Buffer } }]
      });
      this.playerUniforms.set(RemoteId, { buffer: Buffer, bindGroup: BindGroup });
    }
    return this.playerUniforms.get(RemoteId);
  }

  releaseStaleUniforms(RemotePlayers)
  {
    for (const RemoteId of this.playerUniforms.keys())
    {
      if (!RemotePlayers.has(RemoteId))
      {
        const Entry = this.playerUniforms.get(RemoteId);
        this.renderer.bufferPool.releaseBuffer(Entry.buffer, PLAYER_UNIFORM_USAGE);
        this.playerUniforms.delete(RemoteId);
      }
    }
  }

  writeModelUniform(UniformBuffer, Center, Scale, Yaw, Pitch, Color, HeadMode)
  {
    const ScaleMatrix = mat4.scaling(Scale);
    const RotY = mat4.rotationY(Yaw);
    const RotX = HeadMode ? mat4.rotationX(Pitch) : mat4.identity();
    const Translate = mat4.translation(Center);
    const Model = mat4.multiply(Translate, mat4.multiply(RotY, mat4.multiply(RotX, ScaleMatrix)));

    const Data = new Float32Array(20);
    Data.set(Model, 0);
    Data[16] = Color[0];
    Data[17] = Color[1];
    Data[18] = Color[2];
    Data[19] = Color[3];
    this.renderer.bufferPool.write(UniformBuffer, Data, 0);
  }

  render(RemotePlayers, Camera, CommandEncoder, ColorView, DepthView)
  {
    if (!this.pipeline || RemotePlayers.size === 0) return;

    this.releaseStaleUniforms(RemotePlayers);
    this.renderer.bufferPool.write(this.sceneBuffer, Camera.viewProjection, 0);

    const Pass = CommandEncoder.beginRenderPass({
      colorAttachments: [{
        view: ColorView,
        loadOp: 'load',
        storeOp: 'store'
      }],
      depthStencilAttachment: DepthView ? {
        view: DepthView,
        depthLoadOp: 'load',
        depthStoreOp: 'store'
      } : undefined
    });

    Pass.setPipeline(this.pipeline);
    Pass.setVertexBuffer(0, this.vertexBuffer);
    Pass.setBindGroup(0, this.sceneBindGroup);

    for (const Remote of RemotePlayers.values())
    {
      const PlayerGpu = this.getPlayerGpu(Remote.id);

      this.writeModelUniform(
        PlayerGpu.buffer,
        Remote.getBodyCenter(),
        Remote.getBodyScale(),
        Remote.yaw,
        0,
        Remote.color,
        false
      );
      Pass.setBindGroup(1, PlayerGpu.bindGroup);
      Pass.draw(this.vertexCount, 1, 0, 0);

      const HeadColor = [
        Math.min(Remote.color[0] + 0.15, 1),
        Math.min(Remote.color[1] + 0.15, 1),
        Math.min(Remote.color[2] + 0.15, 1),
        1
      ];
      this.writeModelUniform(
        PlayerGpu.buffer,
        Remote.getHeadCenter(),
        Remote.getHeadScale(),
        Remote.yaw,
        Remote.pitch,
        HeadColor,
        true
      );
      Pass.setBindGroup(1, PlayerGpu.bindGroup);
      Pass.draw(this.vertexCount, 1, 0, 0);
    }

    Pass.end();
  }
}
