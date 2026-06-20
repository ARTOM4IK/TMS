const SAVE_DELAY_MS = 1500;

export class WorldStorage
{
  constructor(WorldId, Token)
  {
    this.worldId = WorldId;
    this.token = Token;
    this.pendingChunks = new Map();
    this.saveTimer = null;
  }

  getAuthHeaders()
  {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  async fetchWorldMeta()
  {
    if (!this.token || !this.worldId)
      return null;

    try
    {
      const Response = await fetch(`/api/worlds/${this.worldId}`, {
        headers: this.getAuthHeaders()
      });

      if (!Response.ok)
        return null;

      const Data = await Response.json();
      return Data.world;
    }
    catch (Error)
    {
      console.warn('WorldStorage meta fetch failed:', Error);
      return null;
    }
  }

  async loadArea(World, MinX, MaxX, MinZ, MaxZ)
  {
    if (!this.token || !this.worldId)
      return 0;

    try
    {
      const Query = new URLSearchParams({
        minX: String(MinX),
        maxX: String(MaxX),
        minZ: String(MinZ),
        maxZ: String(MaxZ)
      });

      const Response = await fetch(`/api/worlds/${this.worldId}/chunks?${Query}`, {
        headers: this.getAuthHeaders()
      });

      if (!Response.ok)
        return 0;

      const Data = await Response.json();
      let Applied = 0;

      for (const Entry of Data.chunks)
      {
        const Chunk = World.getChunk(Entry.chunkX, Entry.chunkZ);
        if (Chunk)
        {
          Chunk.loadBlocksBase64(Entry.blocks);
          Applied++;
        }
      }

      return Applied;
    }
    catch (Error)
    {
      console.warn('WorldStorage load failed:', Error);
      return 0;
    }
  }

  queueChunkSave(ChunkX, ChunkZ, Chunk)
  {
    this.pendingChunks.set(`${ChunkX},${ChunkZ}`, { ChunkX, ChunkZ, Chunk });

    if (this.saveTimer)
      clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  async flush()
  {
    if (!this.token || !this.worldId || this.pendingChunks.size === 0)
      return;

    const Queue = Array.from(this.pendingChunks.values());
    this.pendingChunks.clear();
    this.saveTimer = null;

    for (const Entry of Queue)
    {
      try
      { 
        await fetch(`/api/worlds/${this.worldId}/chunks/${Entry.ChunkX}/${Entry.ChunkZ}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ blocks: Entry.Chunk.exportBlocksBase64() })
        });
      }
      catch (Error)
      {
        console.warn(`Chunk save failed (${Entry.ChunkX}, ${Entry.ChunkZ}):`, Error);
      }
    }
  }
}
