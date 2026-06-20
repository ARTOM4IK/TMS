export class MaterialPool
{
  /**
   * @param {GPUDevice} device - Ваше WebGPU устройство
   * @param {number} maxTypes - Максимальное кол-во типов блоков (по умолчанию 256)
   */
  constructor(webgpu, maxTypes = 256)
  {
    this.webgpu = webgpu;
    this.maxTypes = maxTypes;

    // 1 тип блока = 4 байта (1 элемент Uint32)
    this.cpuBuffer = new Uint32Array(maxTypes);
    this._createGPUBuffer();
  }

  /** Внутренний метод создания буфера на GPU */
  _createGPUBuffer()
  {
    this.gpuBuffer = this.webgpu.device.createBuffer({
      label: "Voxel Material Pool Buffer",
      size: this.cpuBuffer.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Регистрация текстурных индексов для конкретного ID блока
   * @param {number} blockId - ID блока (например: 1 - трава, 2 - камень)
   * @param {Object} textures - Объект с индексами текстур (от 0 до 255)
   * @param {number} textures.top - Индекс текстуры верхней грани
   * @param {number} textures.bottom - Индекс текстуры нижней грани
   * @param {number} textures.side - Индекс текстуры боковых граней
   */
  register(blockId, { top, bottom, side })
  {
    if (blockId < 0 || blockId >= this.maxTypes)
    {
      console.error(`Block ID ${blockId} выходит за пределы пула (0-${this.maxTypes - 1})`);
      return;
    }

    // Побитово упаковываем 3 индекса (каждый по 1 байту) в один u32
    // Слой 0x000000FF (top) | 0x0000FF00 (bottom) | 0x00FF0000 (side)
    const packed =
      (top & 0xFF) |
      ((bottom & 0xFF) << 8) |
      ((side & 0xFF) << 16);

    this.cpuBuffer[blockId] = packed;
  }

  /** Синхронизация пула с GPU (вызывать при инициализации или обновлении материалов) */
  updateGPU()
  {
    this.webgpu.device.queue.writeBuffer(this.gpuBuffer, 0, this.cpuBuffer);
  }
}
