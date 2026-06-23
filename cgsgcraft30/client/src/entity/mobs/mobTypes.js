import { Entity } from '../Entity.js';

export const MOB_TYPES =
{
  PIG: 'pig',
  COW: 'cow',
  SHEEP: 'sheep',
  ZOMBIE: 'zombie',
  CHICKEN: 'chicken',
  CREEPER: 'creeper',
  SMAZLIVY_HRYSH: 'smazlivy_hrysh'
};

export function createMob(Id, Type, X, Y, Z)
{
  const Mob = new Entity(Id, Type);
  Mob.modelId = Type;
  Mob.position[0] = X;
  Mob.position[1] = Y;
  Mob.position[2] = Z;
  Mob.aiState = 'idle';
  Mob.aiTimer = 0;
  Mob.target = null;
  Mob.fuseTimer = 0;
  Mob.teleportCooldown = 0;

  switch (Type)
  {
    case MOB_TYPES.ZOMBIE:
      Mob.speed = 5.5;
      Mob.health = 20;
      break;
    case MOB_TYPES.CREEPER:
      Mob.speed = 4.8;
      Mob.health = 20;
      Mob.fuseRange = 4;
      break;
    case MOB_TYPES.CHICKEN:
      Mob.speed = 5.2;
      Mob.health = 4;
      Mob.hopSeed = Math.floor(Math.random() * 64);
      break;
    case MOB_TYPES.SMAZLIVY_HRYSH:
      Mob.speed = 8;
      Mob.health = 40;
      Mob.secret = true;
      break;
    case MOB_TYPES.COW:
      Mob.speed = 3.8;
      Mob.health = 10;
      break;
    case MOB_TYPES.SHEEP:
      Mob.speed = 4.2;
      Mob.health = 8;
      break;
    default:
      Mob.speed = 4;
      Mob.health = 10;
  }

  return Mob;
}

export const MOB_SPAWN_TABLE =
[
  { type: MOB_TYPES.COW, weight: 30 },
  { type: MOB_TYPES.SHEEP, weight: 25 },
  { type: MOB_TYPES.CHICKEN, weight: 25 },
  { type: MOB_TYPES.CREEPER, weight: 20 }
];

export function pickRandomMobType(Seed, X, Z)
{
  const Hash = Math.abs(Math.sin(Seed * 0.001 + X * 12.9898 + Z * 78.233) * 43758.5453);
  const Roll = (Hash - Math.floor(Hash)) * 100;
  let Acc = 0;

  for (const Entry of MOB_SPAWN_TABLE)
  {
    Acc += Entry.weight;
    if (Roll < Acc)
      return Entry.type;
  }

  return MOB_TYPES.COW;
}
