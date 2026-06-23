import { WORLD_CONFIG } from '../world/worldConfig.js';

export class WorldStorage
{
  constructor(WorldId, Token)
  {
    this.worldId = WorldId;
    this.token = Token;
  }

  getAuthHeaders()
  {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  async fetchUserProfile()
  {
    if (!this.token)
      return null;

    try
    {
      const Response = await fetch('/api/verify-token', {
        headers: this.getAuthHeaders()
      });
      if (!Response.ok)
        return null;
      const Data = await Response.json();
      return Data.valid ? Data.user : null;
    }
    catch (Error)
    {
      return null;
    }
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

  async fetchModifiedChunks(MinX, MaxX, MinZ, MaxZ)
  {
    if (!this.token || !this.worldId)
      return [];

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
        return [];

      const Data = await Response.json();
      return Data.chunks || [];
    }
    catch (Error)
    {
      console.warn('WorldStorage chunk fetch failed:', Error);
      return [];
    }
  }

  async saveChunks(Queue)
  {
    if (!this.token || !this.worldId || Queue.length === 0)
      return;

    for (const Entry of Queue)
    {
      try
      {
        const Payload = Entry.chunk.exportPayload();
        const Response = await fetch(
          `/api/worlds/${this.worldId}/chunks/${Entry.chunkX}/${Entry.chunkZ}`,
          {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(Payload)
          }
        );

        if (Response.ok)
          Entry.chunk.isModified = false;
      }
      catch (Error)
      {
        console.warn(`Chunk save failed (${Entry.chunkX}, ${Entry.chunkZ}):`, Error);
      }
    }
  }

  async fetchPlayerState()
  {
    if (!this.token || !this.worldId)
      return null;

    try
    {
      const Response = await fetch(`/api/worlds/${this.worldId}/players/me`, {
        headers: this.getAuthHeaders()
      });

      if (!Response.ok)
        return null;

      const Data = await Response.json();
      return Data.playerState || null;
    }
    catch (Error)
    {
      console.warn('WorldStorage player state fetch failed:', Error);
      return null;
    }
  }

  async savePlayerState(PlayerState)
  {
    if (!this.token || !this.worldId || !PlayerState)
      return;

    try
    {
      await fetch(`/api/worlds/${this.worldId}/players/me`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ playerState: PlayerState })
      });
    }
    catch (Error)
    {
      console.warn('WorldStorage player state save failed:', Error);
    }
  }

  async flush(World)
  {
    if (World)
      await World.flushPendingSaves();
  }
}

export { WORLD_CONFIG };
