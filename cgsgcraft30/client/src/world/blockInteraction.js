const B = () => globalThis.Blocks;

export const UNBREAKABLE_BLOCKS = new Set();

export function refreshBlockRules()
{
  UNBREAKABLE_BLOCKS.clear();
  UNBREAKABLE_BLOCKS.add(B().BEDROCK);
}

export function canBreakBlock(blockId)
{
  if (!blockId || blockId === B().AIR)
    return false;

  return !UNBREAKABLE_BLOCKS.has(blockId);
}

export function canCollectBlock(blockId)
{
  if (!blockId || blockId === B().AIR)
    return false;

  return blockId !== B().WATER;
}

export function canPlaceBlock(World, x, y, z, blockId)
{
  if (!blockId || blockId === B().AIR)
    return false;

  const Existing = World.getBlock(x, y, z);
  if (Existing != null && Existing !== B().AIR)
    return false;

  const Offsets =
  [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
  ];

  for (const [Ox, Oy, Oz] of Offsets)
  {
    const Neighbor = World.getBlock(x + Ox, y + Oy, z + Oz);
    if (Neighbor != null && Neighbor !== B().AIR && Neighbor !== B().WATER)
      return true;
  }

  return false;
}
