import { vec2, vec3 } from "../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
import { exportChunkPayload, importChunkPayload } from './chunkCodec.js';
import { generateChunkTerrain } from './terrainGenerator.js';

export class Chunk
{
  static W = 16;
  static H = 256;
  static D = 16;
  static PAD = 1;
  static PADDED_W = Chunk.W + Chunk.PAD * 2;
  static PADDED_D = Chunk.D + Chunk.PAD * 2;
  static PADDED_BLOCKS = Chunk.PADDED_W * Chunk.H * Chunk.PADDED_D;

  static STRIDE_X = Chunk.W;
  static STRIDE_Z = Chunk.D;
  static STRIDE_Y = Chunk.W * Chunk.D;
  static TOTAL_BLOCKS = Chunk.W * Chunk.H * Chunk.D;

  constructor(renderer, X, Y)
  {
    this.renderer = renderer;
    this.x = X;
    this.y = Y;
    this.blocks = new Uint32Array(Chunk.TOTAL_BLOCKS);
    this.isDirty = true;
    this.isModified = false;
    this.generated = false;

    this.uniformOffset = this.renderer.bufferPool.getBuffer(4 + 4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.renderer.bufferPool.write(this.uniformOffset, new Int32Array(vec2.create(X * Chunk.W, Y * Chunk.D)), 0);

    this.faceBuffer = this.renderer.bufferPool.getBuffer(65536 * 4 * 6 / 8, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);

    this.ChunkBindGroupCreate = (() =>
    {
      this.bindGroup = null;
      this.bindGroup = this.renderer.webgpu.device.createBindGroup(
      {
        layout:
            this.renderer.pipelines.get("main").getBindGroupLayout(0),
        entries:
        [
            {
                binding: 0,
                resource:
                {
                    buffer: this.renderer.uniformBuffer
                }
            },
            {
                binding: 1,
                resource:
                {
                    buffer: this.uniformOffset
                }
            },
            {
                binding: 2,
                resource:
                {
                    buffer: this.faceBuffer
                }
            },
            {
                binding: 3,
                resource:
                {
                    buffer: this.renderer.materialPool.gpuBuffer
                }
            },
            {
                binding: 4,
                resource: this.renderer.textureArray.createView({ dimension: '2d-array' })
            },
            {
                binding: 5,
                resource: this.renderer.Sampler
            }
        ]
      });

    })

    this.ChunkBindGroupCreate();

    this.AABB = { min : this.getMin(), max : this.getMax() };
  }

  getIndex(x, y, z)
  {
    return (x) + (y * Chunk.STRIDE_Y) + z * Chunk.STRIDE_X;
  }

  IsInBounds(x, y, z)
  {
    return x >= 0 && x < Chunk.W &&
      y >= 0 && y < Chunk.H &&
      z >= 0 && z < Chunk.D;
  }

  getBlock(x, y, z)
  {
    if (!this.IsInBounds(x, y, z))
      return 0;
    return this.blocks[this.getIndex(x, y, z)];
  }

  setBlock(x, y, z, blockId)
  {
    if (!this.IsInBounds(x, y, z))
      return;

    const Index = this.getIndex(x, y, z);
    if (this.blocks[Index] !== blockId)
    {
      this.blocks[Index] = blockId;
      this.isDirty = true;
      this.isModified = true;
    }
  }

  removeBlock(x, y, z)
  {
    if (!this.IsInBounds(x, y, z))
      return null;

    const Index = this.getIndex(x, y, z);
    const Block = this.blocks[Index];

    if (Block !== 0)
    {
      this.blocks[Index] = 0;
      this.isDirty = true;
      this.isModified = true;
    }
    return Block;
  }

  generateTerrain(WorldSeed)
  {
    if (!this.generated)
    {
      generateChunkTerrain(this, WorldSeed);
      this.generated = true;
      this.isDirty = true;
    }
  }

  exportPayload()
  {
    return exportChunkPayload(this.blocks);
  }

  loadPayload(Payload)
  {
    this.blocks = importChunkPayload(Payload);
    this.isDirty = true;
    this.isModified = true;
  }

  getPaddedIndex(x, y, z)
  {
    return x + z * Chunk.PADDED_W + y * Chunk.PADDED_W * Chunk.PADDED_D;
  }

  buildPaddedBlocks(World)
  {
    const padded = new Uint32Array(Chunk.PADDED_BLOCKS);
    const pad = Chunk.PAD;

    for (let y = 0; y < Chunk.H; y++)
    {
      for (let z = 0; z < Chunk.D; z++)
      {
        for (let x = 0; x < Chunk.W; x++)
        {
          padded[this.getPaddedIndex(x + pad, y, z + pad)] = this.blocks[this.getIndex(x, y, z)];
        }
      }
    }

    const copyStrip = (NeighborChunk, localX, localZ, countX, countZ, padX, padZ) =>
    {
      if (!NeighborChunk)
        return;

      for (let y = 0; y < Chunk.H; y++)
      {
        for (let z = 0; z < countZ; z++)
        {
          for (let x = 0; x < countX; x++)
          {
            padded[this.getPaddedIndex(padX + x, y, padZ + z)] =
              NeighborChunk.getBlock(localX + x, y, localZ + z);
          }
        }
      }
    };

    copyStrip(World.getChunk(this.x - 1, this.y), Chunk.W - 1, 0, 1, Chunk.D, 0, pad);
    copyStrip(World.getChunk(this.x + 1, this.y), 0, 0, 1, Chunk.D, pad + Chunk.W, pad);
    copyStrip(World.getChunk(this.x, this.y - 1), 0, Chunk.D - 1, Chunk.W, 1, pad, 0);
    copyStrip(World.getChunk(this.x, this.y + 1), 0, 0, Chunk.W, 1, pad, pad + Chunk.D);

    const copyCorner = (NeighborChunk, localX, localZ, padX, padZ) =>
    {
      if (!NeighborChunk)
        return;

      for (let y = 0; y < Chunk.H; y++)
        padded[this.getPaddedIndex(padX, y, padZ)] = NeighborChunk.getBlock(localX, y, localZ);
    };

    copyCorner(World.getChunk(this.x - 1, this.y - 1), Chunk.W - 1, Chunk.D - 1, 0, 0);
    copyCorner(World.getChunk(this.x + 1, this.y - 1), 0, Chunk.D - 1, pad + Chunk.W, 0);
    copyCorner(World.getChunk(this.x - 1, this.y + 1), Chunk.W - 1, 0, 0, pad + Chunk.D);
    copyCorner(World.getChunk(this.x + 1, this.y + 1), 0, 0, pad + Chunk.W, pad + Chunk.D);

    return padded;
  }

  async RebuildMesh(World)
  {
    const readbackBuffer = this.renderer.bufferPool.getBuffer(4, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
    const meshBuffer = this.renderer.bufferPool.getBuffer(Chunk.PADDED_BLOCKS * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const paddedBlocks = World ? this.buildPaddedBlocks(World) : this.blocks;

    this.renderer.bufferPool.write(meshBuffer, paddedBlocks, 0);
    this.renderer.bufferPool.write(this.renderer.counterBuffer, new Uint32Array([0]), 0);

    var compbindGroup = this.renderer.webgpu.device.createBindGroup(
    {
      layout: this.renderer.computePipeline.getBindGroupLayout(0),
      entries:
      [
        {
            binding: 0,
            resource:
            {
              buffer: meshBuffer
            }
        },
        {
            binding: 1,
            resource:
            {
              buffer: this.faceBuffer
            }
        },
        {
            binding: 2,
            resource:
            {
              buffer: this.renderer.counterBuffer
            }
        },
        {
          binding: 3,
          resource:
          {
            buffer: this.renderer.materialPool.gpuBuffer
          }
        }
      ]
    });

    const encoder = this.renderer.webgpu.device.createCommandEncoder();
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(this.renderer.computePipeline);
    computePass.setBindGroup(0, compbindGroup);
    computePass.dispatchWorkgroups(2, 32, 2);
    computePass.end();

    encoder.copyBufferToBuffer(this.renderer.counterBuffer, 0, readbackBuffer, 0, 4);

    this.renderer.webgpu.device.queue.submit([encoder.finish()]);

    await readbackBuffer.mapAsync(GPUMapMode.READ)
    const count = new Uint32Array(readbackBuffer.getMappedRange())[0];
    readbackBuffer.unmap();

    this.CountFaces = count;

    compbindGroup = null;
    meshBuffer.destroy();
    readbackBuffer.destroy();
    this.isDirty = false;
  }

  getMin()
  {
    return vec3.create(this.x * Chunk.W, 0, this.y * Chunk.D);
  }

  getMax()
  {
    return vec3.create((this.x + 1) * Chunk.W, Chunk.H, (this.y + 1) * Chunk.D);
  }
}
