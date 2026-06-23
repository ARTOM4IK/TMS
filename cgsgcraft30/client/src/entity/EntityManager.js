import { createMob } from './mobs/mobTypes.js';
import { updateAllMobAI, spawnMobsForChunk } from './mobs/mobAI.js';
import { WORLD_CONFIG } from '../world/worldConfig.js';

let nextMobId = 1;

export class EntityManager
{
  constructor(World)
  {
    this.world = World;
    this.mobs = new Map();
    this.spawnedChunks = new Set();
    this.lasers = [];
  }

  spawnMob(Type, X, Y, Z)
  {
    const Id = `mob-${nextMobId++}`;
    const Mob = createMob(Id, Type, X, Y, Z);
    this.mobs.set(Id, Mob);
    return Mob;
  }

  onChunkGenerated(ChunkX, ChunkZ, WorldSeed)
  {
    spawnMobsForChunk(this.world, this, ChunkX, ChunkZ, WorldSeed);
  }

  update(Player, Delta)
  {
    updateAllMobAI(this.mobs.values(), this.world, Player, Delta);

    for (const [Id, Mob] of this.mobs.entries())
    {
      if (!Mob.alive)
        this.mobs.delete(Id);
    }

    this.lasers = this.lasers.filter(L =>
    {
      L.life -= Delta;
      return L.life > 0;
    });
  }

  addLaser(Origin, Direction, Length = 80)
  {
    this.lasers.push({
      origin: [...Origin],
      direction: [...Direction],
      length: Length,
      life: 0.35
    });
  }

  damageMobsAlongRay(Origin, Direction, MaxDist = 80, Damage = 999)
  {
    const Dx = Direction[0];
    const Dy = Direction[1];
    const Dz = Direction[2];
    const Len = Math.sqrt(Dx * Dx + Dy * Dy + Dz * Dz) || 1;
    const Nx = Dx / Len;
    const Ny = Dy / Len;
    const Nz = Dz / Len;

    for (const Mob of this.mobs.values())
    {
      if (!Mob.alive)
        continue;

      const Ox = Mob.position[0] - Origin[0];
      const Oy = Mob.position[1] - Origin[1];
      const Oz = Mob.position[2] - Origin[2];
      const Proj = Ox * Nx + Oy * Ny + Oz * Nz;

      if (Proj < 0 || Proj > MaxDist)
        continue;

      const Px = Origin[0] + Nx * Proj;
      const Py = Origin[1] + Ny * Proj;
      const Pz = Origin[2] + Nz * Proj;
      const Dist = Math.hypot(Mob.position[0] - Px, Mob.position[1] - Py, Mob.position[2] - Pz);

      if (Dist < 1.2)
      {
        Mob.health -= Damage;
        if (Mob.health <= 0)
          Mob.alive = false;
      }
    }
  }

  unloadFarFrom(Player)
  {
    const Px = Player.camera.position[0];
    const Pz = Player.camera.position[2];
    const MaxDist = (WORLD_CONFIG.VIEW_DISTANCE + 2) * WORLD_CONFIG.CHUNK_W;

    for (const [Id, Mob] of this.mobs.entries())
    {
      if (Math.abs(Mob.position[0] - Px) > MaxDist || Math.abs(Mob.position[2] - Pz) > MaxDist)
        this.mobs.delete(Id);
    }
  }
}
