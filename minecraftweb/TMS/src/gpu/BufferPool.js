export class BufferPool
{
  constructor(webgpu)
  {
    this.gpu = webgpu;
    this.pool = new Map();
  }

  getBuffer(size, usage)
  {
    const alignedSize = (size + 3) & ~3;
    const key = `${usage}_${alignedSize}`;

    if (!this.pool.has(key))
    {
      this.pool.set(key, []);
    }

    const list = this.pool.get(key);
    if (list.length > 0)
    {
      return list.pop();
    }

    return this.gpu.device.createBuffer({size: alignedSize, usage: usage});
  }

  releaseBuffer(buffer, usage)
  {
    const key = `${usage}_${buffer.size}`;
    if (!this.pool.has(key))
    {
      this.pool.set(key, []);
    }
    this.pool.get(key).push(buffer);
  }

  shrinkToFitBuffer(oldBuffer, actualDataSize) 
  {
    // 1. Создаем новый буфер точного размера
    const newBuffer = this.getBuffer(actualDataSize, oldBuffer.usage);

    // 2. Копируем данные через CommandEncoder
    const commandEncoder = this.gpu.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      oldBuffer,   // Источник (избыточный буфер)
      0,           // Смещение источника
      newBuffer,   // Назначение (компактный буфер)
      0,           // Смещение назначения
      actualDataSize // Размер полезных данных
    );

    // 3. Отправляем команды на исполнение
    this.gpu.device.queue.submit([commandEncoder.finish()]);

    // 4. Принудительно освобождаем видеопамять старого буфера
    oldBuffer.destroy();

    return newBuffer;
  }

  write(buffer, data, offset = 0)
  {
    this.gpu.device.queue.writeBuffer(buffer, offset, data.buffer || data);
  }

  clear()
  {
    for (const list of this.pool.values())
    {
      while (list.length > 0)
      {
        list.pop().destroy();
      }
    }
    this.pool.clear();
  }
}
