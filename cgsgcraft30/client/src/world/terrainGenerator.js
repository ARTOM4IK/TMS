// minecraftLikeTerrainGenerator.js

import { Chunk } from './chunk.js';
import { TERRAIN_CONFIG } from './terrainConfig.js';

// ============================================================
// FAST NOISE (оставляем твой стиль, но упрощаем слойность)
// ============================================================

function Hash(seed, x, y, z)
{
  let h = seed ^ (x * 374761393) ^ (y * 668265263) ^ (z * 1274126177);
  h = (h ^ (h >> 13)) * 1274126177;
  h = (h ^ (h >> 16));
  return (h & 0x7fffffff) / 0x7fffffff;
}

function lerp(a, b, t)
{
  t = t * t * (3 - 2 * t);
  return a + (b - a) * t;
}

function noise2(seed, x, z)
{
  const ix = Math.floor(x);
  const iz = Math.floor(z);

  const fx = x - ix;
  const fz = z - iz;

  const a = Hash(seed, ix, 0, iz);
  const b = Hash(seed, ix+1, 0, iz);
  const c = Hash(seed, ix, 0, iz+1);
  const d = Hash(seed, ix+1, 0, iz+1);

  return lerp(lerp(a,b,fx), lerp(c,d,fx), fz) * 2 - 1;
}

function fbm(seed, x, z, octaves)
{
  let v = 0;
  let amp = 1;
  let freq = 1;
  let max = 0;

  for(let i=0;i<octaves;i++)
  {
    v += noise2(seed+i*1013, x*freq, z*freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }

  return v / max;
}

// ============================================================
// TERRAIN SHAPING (ключ Minecraft-like логика)
// ============================================================

function getHeight(seed, x, z)
{
  // 1. континенты (очень низкая частота)
  const continent = fbm(seed+100, x/1200, z/1200, 3);

  // 2. базовый уровень океана
  const oceanLevel = -0.2;

  // 3. если океан — фиксим высоту
  if (continent < oceanLevel)
    return 30 + fbm(seed+200, x/400, z/400, 2) * 4;

  // 4. elevation (основная форма суши)
  const erosion = fbm(seed+300, x/600, z/600, 4);
  const peaks   = fbm(seed+400, x/250, z/250, 5);

  let height =
    60
    + continent * 35
    + erosion * 20
    + Math.pow(Math.max(0, peaks), 1.5) * 35;

  return height;
}

// ============================================================
// BIOMES (только визуал, НЕ форма)
// ============================================================

function getBiome(seed, x, z, height)
{
  const temp = fbm(seed+500, x * TERRAIN_CONFIG.BIOME_SCALE, z * TERRAIN_CONFIG.BIOME_SCALE, 3);
  const moist = fbm(seed+600, x * TERRAIN_CONFIG.BIOME_SCALE, z * TERRAIN_CONFIG.BIOME_SCALE, 3);

  const B = globalThis.Blocks;

  if (height < 45) return "ocean";

  if (temp < -0.3) return "snow";
  if (temp > 0.4 && moist < 0) return "desert";
  if (moist > 0.4) return "forest";
  if (temp > 0.2 && moist < 0) return "savanna";

  return "plains";
}

function noise3(seed, x, y, z)
{
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);

    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;

    const v000 = Hash(seed, ix, iy, iz);
    const v100 = Hash(seed, ix + 1, iy, iz);
    const v010 = Hash(seed, ix, iy + 1, iz);
    const v110 = Hash(seed, ix + 1, iy + 1, iz);

    const v001 = Hash(seed, ix, iy, iz + 1);
    const v101 = Hash(seed, ix + 1, iy, iz + 1);
    const v011 = Hash(seed, ix, iy + 1, iz + 1);
    const v111 = Hash(seed, ix + 1, iy + 1, iz + 1);

    const x00 = lerp(v000, v100, fx);
    const x10 = lerp(v010, v110, fx);
    const x01 = lerp(v001, v101, fx);
    const x11 = lerp(v011, v111, fx);

    const y0 = lerp(x00, x10, fy);
    const y1 = lerp(x01, x11, fy);

    return lerp(y0, y1, fz) * 2 - 1;
}

function fbm3(seed, x, y, z, octaves)
{
    let value = 0;
    let amp = 1;
    let freq = 1;
    let max = 0;

    for(let i = 0; i < octaves; i++)
    {
        value += noise3(
            seed + i * 7919,
            x * freq,
            y * freq,
            z * freq
        ) * amp;

        max += amp;
        amp *= 0.5;
        freq *= 2;
    }

    return value / max;
}

function cave(seed, x, y, z)
{
    if (y < 8)
        return false;

    const a = Math.abs(
        fbm3(seed + 1000,
            x / 48,
            y / 36,
            z / 48,
            3)
    );

    const b = Math.abs(
        fbm3(seed + 2000,
            x / 96,
            y / 72,
            z / 96,
            2)
    );

    return (a + b * 0.5) < 0.16;
}

// ============================================================
// MAIN
// ============================================================

export function generateChunkTerrain(ChunkRef, WorldSeed)
{
  const seed = +WorldSeed || 0;

  const W = Chunk.W;
  const H = Chunk.H;
  const D = Chunk.D;

  const blocks = ChunkRef.blocks;
  const getIndex = ChunkRef.getIndex.bind(ChunkRef);

  const wx0 = ChunkRef.x * W;
  const wz0 = ChunkRef.y * D;

  const heightMap = new Uint16Array(W * D);
  const biomeMap = new Array(W * D);

  const B = globalThis.Blocks;

  // ============================================================
  // PASS 1: HEIGHT + BIOME
  // ============================================================

  for(let x=0;x<W;x++)
  for(let z=0;z<D;z++)
  {
    const wx = wx0 + x;
    const wz = wz0 + z;
    const i = z * W + x;

    const h = getHeight(seed, wx, wz);
    heightMap[i] = h;

    biomeMap[i] = getBiome(seed, wx, wz, h);
  }

  // ============================================================
  // PASS 2: BUILD
  // ============================================================

  for(let x=0;x<W;x++)
  for(let z=0;z<D;z++)
  {
    const i = z * W + x;
    const wx = wx0 + x;
    const wz = wz0 + z;

    const surface = heightMap[i];
    const biome = biomeMap[i];

    // bedrock
    for(let y=0;y<4;y++)
      blocks[getIndex(x,y,z)] = B.BEDROCK;

    // stone
    for(let y=4;y<surface;y++)
      blocks[getIndex(x,y,z)] = B.STONE;

    // caves carve
    for(let y=5;y<surface-3;y++)
      if(cave(seed, wx,y,wz))
        blocks[getIndex(x,y,z)] = B.AIR;

    // surface block
    let surf =
      biome === "desert" ? B.SAND :
      biome === "snow"   ? B.SNOW :
      B.GRASS;

    blocks[getIndex(x, surface, z)] = surf;

    // dirt layer
    for(let y=surface-3;y<surface;y++)
      if(y>3)
        blocks[getIndex(x,y,z)] = B.DIRT;

    // water
    if(surface < 45)
      for(let y=surface+1;y<45;y++)
        blocks[getIndex(x,y,z)] = B.WATER;
  }

  // ============================================================
  // PASS 3: TREES
  // ============================================================

  for(let x=0;x<W;x++)
  for(let z=0;z<D;z++)
  {
    const i = z * W + x;
    const wx = wx0 + x;
    const wz = wz0 + z;
    const surface = heightMap[i];
    const biome = biomeMap[i];

    if (surface < 45)
      continue;

    if (biome !== "forest" && biome !== "plains" && biome !== "savanna")
      continue;

    const roll = Hash(seed + 7000, wx, 0, wz);
    if (roll < 0.96)
      continue;

    placeTree(blocks, getIndex, x, z, surface, seed, W, H, D);
  }

  ChunkRef.isDirty = true;
}

function placeTree(blocks, getIndex, x, z, surfaceY, seed, W, H, D)
{
  const B = globalThis.Blocks;
  const trunkH = 4 + Math.floor(Hash(seed + 8000, x, surfaceY, z) * 3);

  for (let y = 1; y <= trunkH; y++)
  {
    const ty = surfaceY + y;
    if (ty >= H)
      return;
    blocks[getIndex(x, ty, z)] = B.WOOD;
  }

  const top = surfaceY + trunkH;
  const radius = 2;

  for (let dx = -radius; dx <= radius; dx++)
  {
    for (let dy = -1; dy <= 2; dy++)
    {
      for (let dz = -radius; dz <= radius; dz++)
      {
        if (dx === 0 && dy <= 0 && dz === 0)
          continue;

        const lx = x + dx;
        const ly = top + dy;
        const lz = z + dz;

        if (lx < 0 || lx >= W || lz < 0 || lz >= D || ly < 0 || ly >= H)
          continue;

        const dist = dx * dx + dz * dz + Math.max(0, dy) * 0.5;
        if (dist > radius * radius + 1)
          continue;

        const idx = getIndex(lx, ly, lz);
        if (blocks[idx] === B.AIR)
          blocks[idx] = B.LEAVES;
      }
    }
  }
}