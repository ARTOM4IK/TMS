import { vec2, vec3 } from "../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
import { PerlinNoise } from '../math/math.js';

export class Chunk
{
  static W = 16;
  static H = 256;
  static D = 16;

  // Изменено: теперь шаги строго соответствуют раскладке в памяти
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

//    this.faceBuffer = this.renderer.bufferPool.getBuffer(65536 * 4 * 6, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST |GPUBufferUsage.COPY_SRC);
    this.uniformOffset = this.renderer.bufferPool.getBuffer(4 + 4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.renderer.bufferPool.write(this.uniformOffset, new Int32Array(vec2.create(X * Chunk.W, Y * Chunk.D)), 0);

    this.faceBuffer = this.renderer.bufferPool.getBuffer(65536 * 4 * 6 / 32, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST |GPUBufferUsage.COPY_SRC);

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

  #getIndex(x, y, z)
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
    return this.blocks[this.#getIndex(x, y, z)];
  }

  setBlock(x, y, z, blockId)
  {
    if (!this.IsInBounds(x, y, z))
      return;

    const index = this.#getIndex(x, y, z);
    if (this.blocks[index] !== blockId)
    {
      this.blocks[index] = blockId;
      this.isDirty = true;
    }
  }

  removeBlock(x, y, z)
  {
    if (!this.IsInBounds(x, y, z))
      return null;

    const index = this.#getIndex(x, y, z);
    const block = this.blocks[index];

    if (block !== 0)
    {
      this.blocks[index] = 0;
      this.isDirty = true;
    }
    return block;
  }

  async RebuildMesh()
  {
    const mesh = this.blocks;

    const readbackBuffer = this.renderer.bufferPool.getBuffer(4, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
    const meshBuffer = this.renderer.bufferPool.getBuffer(65536 * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);

    this.renderer.bufferPool.write(meshBuffer, this.blocks, 0);
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
    ///console.log(count);
    // this.faceBuffer = this.renderer.bufferPool.shrinkToFitBuffer(this.faceBuffer, this.CountFaces * 4)
    // this.ChunkBindGroupCreate();

    compbindGroup = null;
    meshBuffer.destroy();
    readbackBuffer.destroy();
    this.isDirty = false;
  }

  generateTerrain()
  {
    // Настройки ландшафта
    const baseHeight = 40;     // Минимальная высота земли
    const noiseScale = 0.015;   // Масштаб больших холмов (чем меньше, тем шире биомы)
    const detailScale = Math.random() * 0.025;   // Масштаб мелких шероховатостей земли
    const caveScale = Math.random() * 0.17;     // Масштаб трехмерного шума для пещер

    // Мировое смещение чанка
    const worldXOffset = this.x * Chunk.W;
    const worldZOffset = this.y * Chunk.D;

    for (let x = 0; x < Chunk.W; x++)
    {
      for (let z = 0; z < Chunk.D; z++)
      {
        // Текущие мировые координаты X и Z
        const wsX = worldXOffset + x;
        const wsZ = worldZOffset + z;

        // Считаем карту высот (2D Перлин Шум из нескольких октав)
        const nLarge = PerlinNoise.noise(wsX * noiseScale, wsZ * noiseScale) * 35; // Большие горы (амплитуда 35)
        const nSmall = PerlinNoise.noise(wsX * detailScale, wsZ * detailScale) * 4; // Мелкие холмики (амплитуда 4)

        // Финальная высота поверхности в этой точке
        const surfaceHeight = Math.floor(baseHeight + nLarge + nSmall);

        // --- Генерация биомов для песка ---
        // Используем еще один 2D шум для определения биома (пустыня/равнина)
        const biomeScale = 0.005; // Очень медленное изменение для больших биомов
        const biomeNoise = PerlinNoise.noise(wsX * biomeScale, wsZ * biomeScale);

        // Определяем, является ли эта область пустыней (песчаным биомом)
        const isDesert = biomeNoise > 0.3;

        // Случайная высота уровня воды для вариативности
        const seaLevel = 42;

        for (let y = 0; y < Chunk.H; y++)
        {
          // Мировая координата Y (для вертикальных многоуровневых чанков)
          const wsY = y;

          let blockId = 0; // По умолчанию воздух

          if (wsY <= surfaceHeight)
          {
            // Выбираем базовый тип блока в зависимости от глубины и биома
            if (wsY === surfaceHeight)
            {
              // Поверхность: песок в пустыне и на пляжах, трава везде
              if (isDesert || surfaceHeight <= seaLevel + 2)
              {
                blockId = 6; // Песок на поверхности пустыни или на пляже
              }
              else
              {
                blockId = 2; // Трава на поверхности
              }
            }
            else if (wsY > surfaceHeight - 4)
            {
              // Верхний слой почвы: песок в пустыне, земля в обычных биомах
              if (isDesert)
              {
                blockId = 5; // Песок под поверхностью в пустыне
              }
              else if (surfaceHeight <= seaLevel + 2)
              {
                blockId = 4; // Песчаный пляж
              }
              else
              {
                blockId = 3; // Земля под травой
              }
            }
            else
            {
              blockId = 1; // Камень глубоко внизу
            }

            // --- Генерация 3D пещер ---
            // Генерируем пещеры только ниже уровня земли и не у самого дна мира
            if (wsY < surfaceHeight - 3 && wsY > 5)
            {
              // 3D Шум Перлина возвращает плотность. Если она выше порога — прорубаем пещеру (воздух)
              const caveDensity = PerlinNoise.noise(wsX * caveScale, wsY * caveScale, wsZ * caveScale);
              if (caveDensity > 0.35)
              {
                blockId = 0; // Превращаем камень в воздух
              }
            }

            // Бедрок (коренная порода) на самом дне мира, чтобы игрок не провалился
            if (wsY === 0)
            {
              blockId = 4;
            }
          }

          // Быстрая линейная запись в Uint8Array
          this.blocks[this.#getIndex(x, y, z)] = blockId;
        }
      }
    }

    this.isDirty = true; // Маркируем чанк для обязательной пересборки меша WebGPU
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
