import { mat4, vec3 } from '../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js';
import { getModel, getAnimOffset } from '../entity/models/entityModels.js';
import { MOB_GLTF_MODELS } from '../entity/models/mobModelConfig.js';
import { loadGlbMesh } from '../entity/models/gltfLoader.js';

function createUnitCubeVertices()
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
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
  ];
  const Vertices = new Float32Array(Tris.length * 7);
  for (let I = 0; I < Tris.length; I++)
  {
    const Base = I * 7;
    Vertices[Base] = P[Tris[I]][0];
    Vertices[Base + 1] = P[Tris[I]][1];
    Vertices[Base + 2] = P[Tris[I]][2];
    Vertices[Base + 3] = 1;
    Vertices[Base + 4] = 1;
    Vertices[Base + 5] = 1;
    Vertices[Base + 6] = 1;
  }
  return Vertices;
}

const UNIFORM_SIZE = 80;
const UNIFORM_USAGE = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
const VERTEX_STRIDE = 20;

export class EntityRenderer
{
  constructor(Renderer)
  {
    this.renderer = Renderer;
    this.uniformCache = new Map();
    this.gltfMeshes = new Map();
    this.laserUniform = null;
    this.laserBindGroup = null;
  }

  async init()
  {
    const Gpu = this.renderer.webgpu;
    const Shader = await this.renderer.shaders.loadModule('player', '../bin/shaders/player.wgsl');
    const LaserShader = await this.renderer.shaders.loadModule('laser', '../bin/shaders/laser.wgsl');
    this.mobSampler =
      Gpu.device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
        mipmapFilter: 'nearest'
      });
    this.sceneBuffer = this.renderer.bufferPool.getBuffer(64, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

    const SceneLayout = Gpu.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }]
    });

    this.entityLayout = Gpu.device.createBindGroupLayout({
      entries: 
      [
        { binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, 
          buffer: { type: 'uniform' } 
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        }
      ]
    });

    const VertexLayout = [{
      arrayStride: VERTEX_STRIDE,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x2' }
      ]
    }];

    this.pipeline = this.renderer.pipelines.createRenderPipeline('entity', {
      layout: Gpu.device.createPipelineLayout({ bindGroupLayouts: [SceneLayout, this.entityLayout] }),
      vertexModule: Shader,
      vertexEntry: 'vs_main',
      vertexBuffers: VertexLayout,
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

    this.laserPipeline = this.renderer.pipelines.createRenderPipeline('laser', {
      layout: Gpu.device.createPipelineLayout({ bindGroupLayouts: [SceneLayout, this.entityLayout] }),
      vertexModule: LaserShader,
      vertexEntry: 'vs_main',
      vertexBuffers: [{
        arrayStride: 12,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
      }],
      fragmentModule: LaserShader,
      fragmentEntry: 'fs_main',
      targets: [{
        format: Gpu.format,
        blend: {
          color: { operation: 'add', srcFactor: 'src-alpha', dstFactor: 'one' },
          alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' }
        }
      }],
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false,
        depthCompare: 'always'
      }
    });

    this.sceneBindGroup = Gpu.device.createBindGroup({
      layout: SceneLayout,
      entries: [{ binding: 0, resource: { buffer: this.sceneBuffer } }]
    });

    const dummyTexture = this.renderer.webgpu.device.createTexture({
      size: [1, 1, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    this.laserUniform = this.renderer.bufferPool.getBuffer(UNIFORM_SIZE, UNIFORM_USAGE);
    this.laserBindGroup = Gpu.device.createBindGroup({
      layout: this.entityLayout,
      entries: 
        [
          { binding: 0, 
            resource: { buffer: this.laserUniform } 
          },
          {
            binding: 1,
            resource: dummyTexture.createView()
          },
          {
            binding: 2,
            resource: this.mobSampler
          }          
        ]
    });

    const Vertices = createUnitCubeVertices();
    this.vertexBuffer = Gpu.device.createBuffer({
      size: Vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(Vertices);
    this.vertexBuffer.unmap();
    this.vertexCount = Vertices.length / 7;

    await this.loadGltfModels();
  }

  uploadGltfMesh(MeshData)
  {
    const Gpu = this.renderer.webgpu;
    const VertexBuffer = Gpu.device.createBuffer({
      size: MeshData.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(VertexBuffer.getMappedRange()).set(MeshData.vertices);
    VertexBuffer.unmap();

    let IndexBuffer = null;
    if (MeshData.indices)
    {
      IndexBuffer = Gpu.device.createBuffer({
        size: MeshData.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
      new Uint32Array(IndexBuffer.getMappedRange()).set(MeshData.indices);
      IndexBuffer.unmap();
    }

    return {
      vertexBuffer: VertexBuffer,
      indexBuffer: IndexBuffer,
      textures : MeshData.textures,
      indexCount: MeshData.indexCount,
      scale: MeshData.scale,
      yOffset: MeshData.yOffset
    };
  }

  async loadGltfModels()
  {
    for (const [MobId, Config] of Object.entries(MOB_GLTF_MODELS))
    {
      try
      {
        const MeshData = await loadGlbMesh(Config.url, Config, this.renderer.webgpu.device);
        if (!MeshData)
          continue;

        this.gltfMeshes.set(MobId, this.uploadGltfMesh(MeshData));
      }
      catch (Error)
      {
        console.warn(`GLTF mob model "${MobId}" skipped:`, Error.message);
      }
    }
  }

  getUniform(Id)
  {
    if (!this.uniformCache.has(Id))
    {
      const Buffer = this.renderer.bufferPool.getBuffer(UNIFORM_SIZE, UNIFORM_USAGE);
      const BindGroup = this.renderer.webgpu.device.createBindGroup({
        layout: this.entityLayout,
        entries: 
        [
          { binding: 0, 
            resource: { buffer: Buffer } 
          },
          {
            binding: 1,
            resource:
              this.gltfMeshes.get("creeper").textures.createView()
          },
          {
            binding: 2,
            resource:
              this.mobSampler
          }          
        ]
      });
      this.uniformCache.set(Id, { buffer: Buffer, bindGroup: BindGroup });
    }
    return this.uniformCache.get(Id);
  }

  releaseStale(ActiveIds)
  {
    for (const Id of this.uniformCache.keys())
    {
      if (!ActiveIds.has(Id))
      {
        const Entry = this.uniformCache.get(Id);
        this.renderer.bufferPool.releaseBuffer(Entry.buffer, UNIFORM_USAGE);
        this.uniformCache.delete(Id);
      }
    }
  }

  writeModelUniform(UniformBuffer, ModelMatrix, Color)
  {
    const Data = new Float32Array(20);
    Data.set(ModelMatrix, 0);
    Data[16] = Color[0];
    Data[17] = Color[1];
    Data[18] = Color[2];
    Data[19] = Color[3];
    this.renderer.bufferPool.write(UniformBuffer, Data, 0);
  }

  writePartUniform(UniformBuffer, Entity, Part, Extra = {})
  {
    const Offset = [...Part.offset];
    const Scale = [...Part.scale];
    let Color = Part.color ? [...Part.color] : [1, 1, 1, 1];

    if (Part.animate)
    {
      const AnimVal = getAnimOffset(Part.animate, Entity.walkPhase);
      if (Part.animate === 'swingL' || Part.animate === 'swingR' || Part.animate === 'zombieArm')
        Offset[1] += AnimVal * 0.3;
      else
        Offset[1] += AnimVal;
    }

    if (Extra.fuseFlash && Entity.aiState === 'fuse')
      Color = [1, 0.2, 0.2, 1];

    if (Extra.colorOverride)
      Color = Extra.colorOverride;

    const Center = vec3.create(
      Entity.position[0] + Offset[0],
      Entity.position[1] + Offset[1],
      Entity.position[2] + Offset[2]
    );

    const RotY = mat4.rotationY(Entity.yaw);
    const RotX = Part.pitch ? mat4.rotationX(Entity.pitch || 0) : mat4.identity();
    const ScaleM = mat4.scaling(Scale);
    const Translate = mat4.translation(Center);
    const Model = mat4.multiply(Translate, mat4.multiply(RotY, mat4.multiply(RotX, ScaleM)));
    this.writeModelUniform(UniformBuffer, Model, Color);
  }

  buildLaserModel(Origin, Direction, Length)
  {
    const Dx = Direction[0];
    const Dy = Direction[1];
    const Dz = Direction[2];
    const Len = Math.sqrt(Dx * Dx + Dy * Dy + Dz * Dz) || 1;
    const Nx = Dx / Len;
    const Ny = Dy / Len;
    const Nz = Dz / Len;

    const Mid = vec3.create(
      Origin[0] + Nx * Length * 0.5,
      Origin[1] + Ny * Length * 0.5,
      Origin[2] + Nz * Length * 0.5
    );

    const Yaw = Math.atan2(-Nx, -Nz);
    const Pitch = Math.asin(Math.max(-1, Math.min(1, Ny)));
    const RotY = mat4.rotationY(Yaw);
    const RotX = mat4.rotationX(Pitch);
    const ScaleM = mat4.scaling([0.12, 0.12, Length]);
    const Translate = mat4.translation(Mid);
    return mat4.multiply(Translate, mat4.multiply(RotY, mat4.multiply(RotX, ScaleM)));
  }

  drawLaser(Pass, Laser)
  {
    const Model = this.buildLaserModel(Laser.origin, Laser.direction, Laser.length);
    this.writeModelUniform(this.laserUniform, Model, [1, 0.08, 0.08, 0.95]);
    Pass.setPipeline(this.laserPipeline);
    Pass.setBindGroup(1, this.laserBindGroup);
    Pass.draw(this.vertexCount, 1, 0, 0);
    Pass.setPipeline(this.pipeline);
  }

  drawGltfEntity(Pass, Entity, Mesh, Extra = {})
  {
    const Gpu = this.getUniform(Entity.id);
    const Scale = Mesh.scale ?? 1;
    const YOff = Mesh.yOffset ?? 0;
    let Color = [1, 1, 1, 1];

    if (Extra.fuseFlash && Entity.aiState === 'fuse')
      Color = [1, 0.35, 0.35, 1];

    const Center = vec3.create(
      Entity.position[0],
      Entity.position[1] + YOff,
      Entity.position[2]
    );
    const RotY = mat4.rotationY(Entity.yaw);
    const ScaleM = mat4.scaling([Scale, Scale, Scale]);
    const Model = mat4.multiply(mat4.translation(Center), mat4.multiply(RotY, ScaleM));

    this.writeModelUniform(Gpu.buffer, Model, Color);
    Pass.setVertexBuffer(0, Mesh.vertexBuffer);
    Pass.setBindGroup(1, Gpu.bindGroup);

    if (Mesh.indexBuffer)
    {
      Pass.setIndexBuffer(Mesh.indexBuffer, 'uint32');
      Pass.drawIndexed(Mesh.indexCount, 1, 0, 0, 0);
    }
    else
    {
      Pass.draw(Mesh.indexCount, 1, 0, 0);
    }

    Pass.setVertexBuffer(0, this.vertexBuffer);
  }

  drawBoxEntity(Pass, Entity, Extra = {})
  {
    const Model = getModel(Entity.modelId || Entity.type);
    const Gpu = this.getUniform(Entity.id);

    for (const Part of Model.parts)
    {
      this.writePartUniform(Gpu.buffer, Entity, Part, Extra);
      Pass.setBindGroup(1, Gpu.bindGroup);
      Pass.draw(this.vertexCount, 1, 0, 0);
    }
  }

  drawEntity(Pass, Entity, Extra = {})
  {
    const ModelId = Entity.modelId || Entity.type;
    const GltfMesh = this.gltfMeshes.get(ModelId);

    if (GltfMesh)
      this.drawGltfEntity(Pass, Entity, GltfMesh, Extra);
    else
      this.drawBoxEntity(Pass, Entity, Extra);
  }

  drawRemotePlayer(Pass, Remote)
  {
    const Entity = {
      id: Remote.id,
      modelId: 'player',
      position: [
        Remote.position[0],
        Remote.position[1] - 1.75,
        Remote.position[2]
      ],
      yaw: Remote.yaw,
      pitch: Remote.pitch,
      walkPhase: Remote.walkPhase || 0
    };

    this.drawEntity(Pass, Entity, { colorOverride: Remote.color });
  }

  render(RemotePlayers, EntityManager, Camera, CommandEncoder, ColorView, DepthView)
  {
    if (!this.pipeline)
      return;

    const ActiveIds = new Set(RemotePlayers.keys());
    for (const Mob of EntityManager.mobs.values())
      ActiveIds.add(Mob.id);

    this.releaseStale(ActiveIds);

    const HasLasers = EntityManager.lasers.length > 0;
    if (ActiveIds.size === 0 && !HasLasers)
      return;

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
      this.drawRemotePlayer(Pass, Remote);

    for (const Mob of EntityManager.mobs.values())
    {
      if (!Mob.alive)
        continue;
      this.drawEntity(Pass, Mob, { fuseFlash: Mob.type === 'creeper' });
    }

    if (HasLasers)
    {
      for (const Laser of EntityManager.lasers)
        this.drawLaser(Pass, Laser);
    }

    Pass.end();
  }
}

export { EntityRenderer as PlayerRenderer };
