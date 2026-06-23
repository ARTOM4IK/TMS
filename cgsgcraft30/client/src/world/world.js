import { vec2, vec3 } from "../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
import { Chunk } from "./chunk.js";
import { WORLD_CONFIG } from "./worldConfig.js";

export class World
{
  constructor(renderer)
  {
    this.renderer = renderer;
    this.chunks = new Map();
    this.seed = '0';
    this.pendingSaves = new Map();
    this.saveTimer = null;
    this.storage = null;
    this.generationQueue = new Array();
    this.surfaceCache = new Map();
    this.onChunkGenerated = null;
  }

  _createKey(x, z)
  {
    return `${x},${z}`;
  }

  setSeed(Seed)
  {
    this.seed = String(Seed);
  }

  setWorldType(WorldType)
  {
    this.worldType = WorldType || WORLD_TYPES.DEFAULT;
  }

  bindStorage(Storage)
  {
    this.storage = Storage;
  }

  addChunk(chunkX, chunkZ)
  {
    const Key = this._createKey(chunkX, chunkZ);
    const ChunkRef = new Chunk(this.renderer, chunkX, chunkZ);
    this.chunks.set(Key, ChunkRef);
    return ChunkRef;
  }

  getOrCreateChunk(chunkX, chunkZ)
  {
    return this.getChunk(chunkX, chunkZ) || this.addChunk(chunkX, chunkZ);
  }

  getChunk(chunkX, chunkZ)
  {
    return this.chunks.get(this._createKey(chunkX, chunkZ)) || null;
  }

  removeChunk(chunkX, chunkZ)
  {
    return this.chunks.delete(this._createKey(chunkX, chunkZ));
  }

  generateArea(minX, maxX, minZ, maxZ)
  {
    for (let ChunkX = minX; ChunkX <= maxX; ChunkX++)
    {
      for (let ChunkZ = minZ; ChunkZ <= maxZ; ChunkZ++)
      {
        const chunk = this.getOrCreateChunk(ChunkX, ChunkZ);
        const IsNew = !chunk.generated;
        chunk.generateTerrain(this.seed);
        chunk.isDirty = true;

        if (IsNew && this.onChunkGenerated)
          this.onChunkGenerated(ChunkX, ChunkZ);
      }
    }
  }

  applyModifiedChunks(ModifiedEntries)
  {
    let Applied = 0;

    for (const Entry of ModifiedEntries)
    {
      const ChunkRef = this.getChunk(Entry.chunkX, Entry.chunkZ);
      if (!ChunkRef)
        continue;

      try
      {
        ChunkRef.loadPayload(Entry);
        Applied++;
      }
      catch (Error)
      {
        console.warn(`Failed to apply chunk (${Entry.chunkX}, ${Entry.chunkZ}):`, Error);
      }
    }

    return Applied;
  }

  async loadModifiedChunksFromStorage(minX, maxX, minZ, maxZ)
  {
    if (!this.storage)
      return 0;

    const ModifiedEntries = await this.storage.fetchModifiedChunks(minX, maxX, minZ, maxZ);
    return this.applyModifiedChunks(ModifiedEntries);
  }

  worldToLocal(x, y, z)
  {
    const ChunkX = Math.floor(x / Chunk.W);
    const ChunkZ = Math.floor(z / Chunk.D);
    const LocalX = x - ChunkX * Chunk.W;
    const LocalY = y;
    const LocalZ = z - ChunkZ * Chunk.D;

    return { chunkX: ChunkX, chunkZ: ChunkZ, localX: LocalX, localY: LocalY, localZ: LocalZ };
  }

  setBlock(x, y, z, blockId)
  {
    const Local = this.worldToLocal(x, y, z);
    const ChunkRef = this.getChunk(Local.chunkX, Local.chunkZ);

    if (!ChunkRef || Local.localY < 0 || Local.localY >= Chunk.H)
      return false;

    const Prev = ChunkRef.getBlock(Local.localX, Local.localY, Local.localZ);
    ChunkRef.setBlock(Local.localX, Local.localY, Local.localZ, blockId);

    if (Prev !== blockId)
    {
      this.markNeighborChunksDirty(Local.chunkX, Local.chunkZ, Local.localX, Local.localY, Local.localZ);
      this.invalidateSurfaceCache(x, z);
    }

    return Prev !== blockId;
  }

  removeBlock(x, y, z)
  {
    const Local = this.worldToLocal(x, y, z);

    if (Local.localY < 0 || Local.localY >= Chunk.H)
      return null;

    const ChunkRef = this.getChunk(Local.chunkX, Local.chunkZ);
    if (!ChunkRef)
      return null;

    const Block = ChunkRef.removeBlock(Local.localX, Local.localY, Local.localZ);

    if (Block !== 0 && Block != null)
    {
      this.markNeighborChunksDirty(Local.chunkX, Local.chunkZ, Local.localX, Local.localY, Local.localZ);
      this.invalidateSurfaceCache(x, z);
    }

    return Block;
  }

  getBlock(x, y, z)
  {
    const Local = this.worldToLocal(x, y, z);

    if (Local.localY < 0 || Local.localY >= Chunk.H)
      return null;

    const ChunkRef = this.getChunk(Local.chunkX, Local.chunkZ);
    if (!ChunkRef)
      return null;

    return ChunkRef.getBlock(Local.localX, Local.localY, Local.localZ);
  }

  getSurfaceHeight(x, z)
  {
    const Key = `${x},${z}`;
    if (this.surfaceCache.has(Key))
      return this.surfaceCache.get(Key);

    const B = globalThis.Blocks;
    const NonSurface = new Set([B.AIR, B.WATER, B.LEAVES, B.GRASS_TALL, B.FLOWER]);

    for (let y = Chunk.H - 1; y >= 0; y--)
    {
      const BlockId = this.getBlock(x, y, z);
      if (BlockId == null)
        continue;
      if (!NonSurface.has(BlockId))
      {
        this.surfaceCache.set(Key, y);
        return y;
      }
    }

    this.surfaceCache.set(Key, 0);
    return 0;
  }

  invalidateSurfaceCache(x, z)
  {
    for (let dx = -1; dx <= 1; dx++)
    {
      for (let dz = -1; dz <= 1; dz++)
        this.surfaceCache.delete(`${x + dx},${z + dz}`);
    }
  }

  markNeighborChunksDirty(chunkX, chunkZ, localX, localY, localZ)
  {
    if (localX === 0)
    {
      const Neighbor = this.getChunk(chunkX - 1, chunkZ);
      if (Neighbor)
        Neighbor.isDirty = true;
    }
    if (localX === Chunk.W - 1)
    {
      const Neighbor = this.getChunk(chunkX + 1, chunkZ);
      if (Neighbor)
        Neighbor.isDirty = true;
    }
    if (localZ === 0)
    {
      const Neighbor = this.getChunk(chunkX, chunkZ - 1);
      if (Neighbor)
        Neighbor.isDirty = true;
    }
    if (localZ === Chunk.D - 1)
    {
      const Neighbor = this.getChunk(chunkX, chunkZ + 1);
      if (Neighbor)
        Neighbor.isDirty = true;
    }
  }

  applyLocalBlockChange(x, y, z, blockId, onNetworkSend)
  {
    let Changed = false;

    if (blockId === globalThis.Blocks.AIR)
      Changed = this.removeBlock(x, y, z) !== null;
    else
      Changed = this.setBlock(x, y, z, blockId);

    if (Changed)
    {
      this.queueChunkSaveAtBlock(x, y, z);
      if (onNetworkSend)
        onNetworkSend(x, y, z, blockId);
    }

    return Changed;
  }

  applyRemoteBlockChange(x, y, z, blockId)
  {
    let Changed = false;

    if (blockId === globalThis.Blocks.AIR)
      Changed = this.removeBlock(x, y, z) !== null;
    else
      Changed = this.setBlock(x, y, z, blockId);

    if (Changed)
      this.queueChunkSaveAtBlock(x, y, z);

    return Changed;
  }

  queueChunkSave(chunkX, chunkZ)
  {
    const ChunkRef = this.getChunk(chunkX, chunkZ);
    if (!ChunkRef || !ChunkRef.isModified || !this.storage)
      return;

    this.pendingSaves.set(this._createKey(chunkX, chunkZ), { chunkX, chunkZ, chunk: ChunkRef });

    if (this.saveTimer)
      clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(() => this.flushPendingSaves(), WORLD_CONFIG.CHUNK_SAVE_DELAY_MS);
  }

  queueChunkSaveAtBlock(x, y, z)
  {
    const Local = this.worldToLocal(x, y, z);
    this.queueChunkSave(Local.chunkX, Local.chunkZ);
  }

  async flushPendingSaves()
  {
    if (!this.storage || this.pendingSaves.size === 0)
      return;

    const Queue = Array.from(this.pendingSaves.values());
    this.pendingSaves.clear();
    this.saveTimer = null;

    await this.storage.saveChunks(Queue);
  }

  async update(Player)
  {
    const Bounds = getViewBounds(WORLD_CONFIG.VIEW_DISTANCE, vec2.create(Player.camera.position[0], Player.camera.position[2]));

    if (!Player.isStay())
    {
      this.generateArea(Bounds.minX, Bounds.maxX, Bounds.minZ, Bounds.maxZ);
      this.loadModifiedChunksFromStorage(Bounds.minX, Bounds.maxX, Bounds.minZ, Bounds.maxZ);
    }

    const start = performance.now();

    while (this.generationQueue.length && performance.now() - start < 2)
    {
      const chunk = this.generationQueue.pop();

      if (chunk.isDirty)
        chunk.RebuildMesh(this);
    }

    this.chunks.forEach(ChunkRef =>
    {
      if (ChunkRef.isDirty)
        this.generationQueue.push(ChunkRef);
    });
  }

  clearWorld()
  {
    this.chunks.clear();
    this.pendingSaves.clear();
    this.surfaceCache.clear();
    if (this.saveTimer)
    {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  getAllChunks()
  {
    return Array.from(this.chunks.values());
  }

  raycastVoxel(cameraPos, cameraDir, maxDistance)
  {
    let x = Math.floor(cameraPos[0]);
    let y = Math.floor(cameraPos[1]);
    let z = Math.floor(cameraPos[2]);

    const stepX = cameraDir[0] >= 0 ? 1 : -1;
    const stepY = cameraDir[1] >= 0 ? 1 : -1;
    const stepZ = cameraDir[2] >= 0 ? 1 : -1;

    const deltaX = cameraDir[0] !== 0 ? Math.abs(1 / cameraDir[0]) : Infinity;
    const deltaY = cameraDir[1] !== 0 ? Math.abs(1 / cameraDir[1]) : Infinity;
    const deltaZ = cameraDir[2] !== 0 ? Math.abs(1 / cameraDir[2]) : Infinity;

    let tMaxX = cameraDir[0] !== 0 ? (stepX > 0 ? (x + 1 - cameraPos[0]) : (cameraPos[0] - x)) * deltaX : Infinity;
    let tMaxY = cameraDir[1] !== 0 ? (stepY > 0 ? (y + 1 - cameraPos[1]) : (cameraPos[1] - y)) * deltaY : Infinity;
    let tMaxZ = cameraDir[2] !== 0 ? (stepZ > 0 ? (z + 1 - cameraPos[2]) : (cameraPos[2] - z)) * deltaZ : Infinity;

    let prevX = x;
    let prevY = y;
    let prevZ = z;

    let distance = 0;

    while (distance < maxDistance)
    {
      if (this.getBlock(x, y, z) > globalThis.Blocks.AIR)
      {
        return {
          target: { x, y, z },
          previous: { x: prevX, y: prevY, z: prevZ }
        };
      }

      prevX = x;
      prevY = y;
      prevZ = z;

      if (tMaxX < tMaxY)
      {
        if (tMaxX < tMaxZ)
        {
          distance = tMaxX;
          tMaxX += deltaX;
          x += stepX;
        }
        else
        {
          distance = tMaxZ;
          tMaxZ += deltaZ;
          z += stepZ;
        }
      }
      else
      {
        if (tMaxY < tMaxZ)
        {
          distance = tMaxY;
          tMaxY += deltaY;
          y += stepY;
        }
        else
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

export function resolveWorldSeed(WorldMeta, WorldId)
{
  if (WorldMeta && WorldMeta.seed)
    return String(WorldMeta.seed);

  try
  {
    const SavedWorld = JSON.parse(localStorage.getItem('ls_currentWorld') || 'null');
    if (SavedWorld && SavedWorld.id === WorldId && SavedWorld.seed)
      return String(SavedWorld.seed);
  }
  catch (Error) {}

  return '0';
}

export function getViewBounds(ViewDistance, Pos = vec2.create(0, 0))
{
  const playerChunkX = Math.floor(Pos[0] / Chunk.W);
  const playerChunkZ = Math.floor(Pos[1] / Chunk.D);

  return {
    minX: playerChunkX - ViewDistance,
    maxX: playerChunkX + ViewDistance,
    minZ: playerChunkZ - ViewDistance,
    maxZ: playerChunkZ + ViewDistance
  };
}
