import { Chunk } from "./chunk.js";

export class World
{
  constructor()
  {
    // Используем Map для быстрой вставки и поиска по координатам
    this.chunks = new Map();
  }

  // Создает уникальный строковый ключ из координат
  _createKey(x, y)
  {
    return `${x},${y}`;
  }

  // Добавить или обновить блок
  AddChunk(renderer, x, y)
  {
    const key = this._createKey(x, y);
    this.chunks.set(key, new Chunk(renderer, x, y));
    return this.chunks.get(key);
  }

  // Получить данные о блоке
  getChunk(x, y)
  {
    const key = this._createKey(x, y);
    return this.chunks.get(key) || null;
  }

  // Удалить блок
  removeChunk(x, y)
  {
    const key = this._createKey(x, y);
    return this.chunks.delete(key);
  }

  setBlock(x, y, z, blockId)
  {
    const chunkX = Math.floor(x / Chunk.W);
    const chunkY = Math.floor(y / Chunk.H);
    const chunkZ = Math.floor(z / Chunk.D);
    const localX = x - chunkX * Chunk.W;
    const localY = y - chunkY * Chunk.D;
    const localZ = z - chunkZ * Chunk.D;

    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk)
      return null;

    return chunk.setBlock(localX, localY, localZ, blockId);
  }
  getBlock(x, y, z)
  {
    const chunkX = Math.floor(x / Chunk.W);
    const chunkY = Math.floor(y / Chunk.H);
    const chunkZ = Math.floor(z / Chunk.D);
    const localX = x - chunkX * Chunk.W;
    const localY = y - chunkY * Chunk.H;
    const localZ = z - chunkZ * Chunk.D;

    if (chunkY < 0 || chunkY >= Chunk.H)
      return null;
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk)
      return null;

    return chunk.getBlock(localX, localY, localZ);
  }

  removeBlock(x, y, z)
  {
    const chunkX = Math.floor(x / Chunk.W);
    const chunkY = Math.floor(y / Chunk.H);
    const chunkZ = Math.floor(z / Chunk.D);
    const localX = x - chunkX * Chunk.W;
    const localY = y - chunkY * Chunk.H;
    const localZ = z - chunkZ * Chunk.D;

    if (chunkY < 0 || chunkY >= Chunk.H)
      return null;
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk)
      return null;

    return chunk.removeBlock(localX, localY, localZ);
  }

  update()
  {
    this.chunks.forEach(element =>
    {
      if (element.isDirty)
        element.RebuildMesh();
    });
  }

  // Очистить весь мир
  clearWorld()
  {
    this.chunks.clear();
  }

  // Получить массив всех существующих блоков
  getAllChunks()
  {
    return Array.from(this.chunks.values());
  }
  raycastVoxel(cameraPos, cameraDir, maxDistance)
  {
    let x = Math.floor(cameraPos[0]);
    let y = Math.floor(cameraPos[1]);
    let z = Math.floor(cameraPos[2]);

    // Направление шага по осям (+1 или -1)
    const stepX = cameraDir[0] >= 0 ? 1 : -1;
    const stepY = cameraDir[1] >= 0 ? 1 : -1;
    const stepZ = cameraDir[2] >= 0 ? 1 : -1;

    // Сколько расстояния (t) нужно пройти лучу, чтобы пересечь одну целую единицу по каждой оси
    const deltaX = cameraDir[0] !== 0 ? Math.abs(1 / cameraDir[0]) : Infinity;
    const deltaY = cameraDir[1] !== 0 ? Math.abs(1 / cameraDir[1]) : Infinity;
    const deltaZ = cameraDir[2] !== 0 ? Math.abs(1 / cameraDir[2]) : Infinity;

    // Начальные значения расстояния (t) до ближайших границ сетки по осям X, Y, Z
    let tMaxX = cameraDir[0] !== 0 ? (stepX > 0 ? (x + 1 - cameraPos[0]) : (cameraPos[0] - x)) * deltaX : Infinity;
    let tMaxY = cameraDir[1] !== 0 ? (stepY > 0 ? (y + 1 - cameraPos[1]) : (cameraPos[1] - y)) * deltaY : Infinity;
    let tMaxZ = cameraDir[2] !== 0 ? (stepZ > 0 ? (z + 1 - cameraPos[2]) : (cameraPos[2] - z)) * deltaZ : Infinity;

    // Переменные для хранения координат предыдущего шага
    let prevX = x;
    let prevY = y;
    let prevZ = z;

    let distance = 0;

    while (distance < maxDistance)
    {
      // Если нашли твердый блок
      if (this.getBlock(x, y, z) > 0)
      {
        return {
          target: { x, y, z },          // Блок для УДАЛЕНИЯ (куда попали)
          previous: { x: prevX, y: prevY, z: prevZ } // Блок для СТРОИТЕЛЬСТВА (откуда пришли)
        };
      }

      // Запоминаем текущие координаты как "предыдущие" перед тем, как сделать шаг
      prevX = x;
      prevY = y;
      prevZ = z;

      // Продвигаем луч вперед
      if (tMaxX < tMaxY)
      {
        if (tMaxX < tMaxZ)
        {
          distance = tMaxX;
          tMaxX += deltaX;
          x += stepX;
        } else
        {
          distance = tMaxZ;
          tMaxZ += deltaZ;
          z += stepZ;
        }
      } else
      {
        if (tMaxY < tMaxZ)
        {
          distance = tMaxY;
          tMaxY += deltaY;
          y += stepY;
        } else
        {
          distance = tMaxZ;
          tMaxZ += deltaZ;
          z += stepZ;
        }
      }
    }

    return null;
  }
}
