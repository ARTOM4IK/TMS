import { MOB_TYPES, pickRandomMobType } from './mobTypes.js';
import { WORLD_CONFIG } from '../../world/worldConfig.js';

const GROUND_LERP = 24;
const MAX_DELTA = 0.05;

function distSq2d(AX, AZ, BX, BZ)
{
  const Dx = AX - BX;
  const Dz = AZ - BZ;
  return Dx * Dx + Dz * Dz;
}

function refreshGround(Mob, World)
{
  const IX = Math.floor(Mob.position[0]);
  const IZ = Math.floor(Mob.position[2]);

  if (Mob.groundCellX === IX && Mob.groundCellZ === IZ)
    return;

  Mob.groundCellX = IX;
  Mob.groundCellZ = IZ;
  Mob.groundY = World.getSurfaceHeight(IX, IZ) + 1;
}

function snapGround(Mob, Delta)
{
  Mob.position[1] += (Mob.groundY - Mob.position[1]) * Math.min(1, Delta * GROUND_LERP);
}

function moveToward(Mob, TargetX, TargetZ, Delta, Speed)
{
  const Dx = TargetX - Mob.position[0];
  const Dz = TargetZ - Mob.position[2];
  const LenSq = Dx * Dx + Dz * Dz;

  if (LenSq < 0.0001)
    return;

  const InvLen = Speed / Math.sqrt(LenSq);
  Mob.velocity[0] = Dx * InvLen;
  Mob.velocity[2] = Dz * InvLen;
  Mob.yaw = Math.atan2(-Dx, -Dz);
  Mob.position[0] += Mob.velocity[0] * Delta;
  Mob.position[2] += Mob.velocity[2] * Delta;
}

function wander(Mob, Delta)
{
  Mob.aiTimer -= Delta;

  if (Mob.aiTimer <= 0)
  {
    Mob.aiTimer = 0.6 + Math.random() * 1.2;
    Mob.wanderYaw = Math.random() * Math.PI * 2;
  }

  const Speed = Mob.speed * 0.85;
  Mob.yaw = Mob.wanderYaw;
  Mob.velocity[0] = Math.sin(Mob.wanderYaw) * Speed;
  Mob.velocity[2] = Math.cos(Mob.wanderYaw) * Speed;
  Mob.position[0] += Mob.velocity[0] * Delta;
  Mob.position[2] += Mob.velocity[2] * Delta;
}

function updateCreeper(Mob, Px, Pz, DistSq, Delta)
{
  const ChaseRangeSq = 16 * 16;

  if (DistSq < ChaseRangeSq)
  {
    moveToward(Mob, Px, Pz, Delta, Mob.speed);

    const FuseRangeSq = Mob.fuseRange * Mob.fuseRange;
    if (DistSq < FuseRangeSq)
    {
      Mob.fuseTimer += Delta;
      Mob.aiState = 'fuse';

      if (Mob.fuseTimer > 2.5)
      {
        Mob.alive = false;
        Mob.aiState = 'exploded';
      }
    }
    else
    {
      Mob.fuseTimer = Math.max(0, Mob.fuseTimer - Delta * 2);
      Mob.aiState = 'chase';
    }
  }
  else
  {
    wander(Mob, Delta);
  }
}

function updateChicken(Mob, Delta)
{
  wander(Mob, Delta);

  if ((Mob.hopSeed++ & 63) === 0 && Math.random() < 0.35)
    Mob.velocity[1] = 4.5;

  Mob.position[1] += Mob.velocity[1] * Delta;
  Mob.velocity[1] -= 18 * Delta;

  if (Mob.position[1] < Mob.groundY)
  {
    Mob.position[1] = Mob.groundY;
    Mob.velocity[1] = 0;
  }
}

function updateSpecialMob(Mob, Px, Pz, DistSq, Delta)
{
  switch (Mob.type)
  {
    case MOB_TYPES.ZOMBIE:
      if (DistSq < 24 * 24)
        moveToward(Mob, Px, Pz, Delta, Mob.speed);
      else
        wander(Mob, Delta);
      break;

    case MOB_TYPES.CREEPER:
      updateCreeper(Mob, Px, Pz, DistSq, Delta);
      break;

    case MOB_TYPES.SMAZLIVY_HRYSH:
      Mob.teleportCooldown -= Delta;
      if (DistSq < 40 * 40)
        moveToward(Mob, Px, Pz, Delta, Mob.speed);

      if (Mob.teleportCooldown <= 0 && DistSq > 36 && DistSq < 900)
      {
        Mob.position[0] = Px + (Math.random() - 0.5) * 4;
        Mob.position[2] = Pz + (Math.random() - 0.5) * 4;
        Mob.groundCellX = null;
        Mob.teleportCooldown = 2 + Math.random() * 3;
      }
      break;

    case MOB_TYPES.CHICKEN:
      updateChicken(Mob, Delta);
      return;

    default:
      wander(Mob, Delta);
  }

  snapGround(Mob, Delta);
}

export function updateAllMobAI(Mobs, World, Player, Delta)
{
  const Dt = Math.min(Delta, MAX_DELTA);
  const Px = Player.camera.position[0];
  const Pz = Player.camera.position[2];

  for (const Mob of Mobs)
  {
    if (!Mob.alive)
      continue;

    Mob.updateAnim(Dt);
    refreshGround(Mob, World);

    if (Mob.groundY == null)
      Mob.groundY = World.getSurfaceHeight(Math.floor(Mob.position[0]), Math.floor(Mob.position[2])) + 1;

    const DistSq = distSq2d(Mob.position[0], Mob.position[2], Px, Pz);
    updateSpecialMob(Mob, Px, Pz, DistSq, Dt);
  }
}

export function spawnMobsForChunk(World, EntityManager, ChunkX, ChunkZ, WorldSeed)
{
  const Key = `${ChunkX},${ChunkZ}`;
  if (EntityManager.spawnedChunks.has(Key))
    return;

  EntityManager.spawnedChunks.add(Key);

  if (Math.random() > WORLD_CONFIG.MOB_SPAWN_CHANCE)
    return;

  const Count = 1 + Math.floor(Math.random() * WORLD_CONFIG.MAX_MOBS_PER_CHUNK);
  const BaseX = ChunkX * WORLD_CONFIG.CHUNK_W;
  const BaseZ = ChunkZ * WORLD_CONFIG.CHUNK_D;

  for (let I = 0; I < Count; I++)
  {
    const X = BaseX + 2 + Math.floor(Math.random() * (WORLD_CONFIG.CHUNK_W - 4));
    const Z = BaseZ + 2 + Math.floor(Math.random() * (WORLD_CONFIG.CHUNK_D - 4));
    const SurfaceY = World.getSurfaceHeight(X, Z);

    if (SurfaceY < 1)
      continue;

    const Block = World.getBlock(X, SurfaceY, Z);
    if (Block === globalThis.Blocks.WATER)
      continue;

    const Y = SurfaceY + 1;
    const Type = pickRandomMobType(parseInt(WorldSeed, 10) || 0, X, Z);
    EntityManager.spawnMob(Type, X, Y, Z);
  }
}
