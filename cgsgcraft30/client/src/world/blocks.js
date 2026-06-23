import { refreshBlockRules } from './blockInteraction.js';

let registryLoaded = false;

globalThis.BlockNamesById = {};
globalThis.Blocks =
{
  AIR: 0,
  STONE: 584,
  SAND: 548,
  GRASS: 294,
  WOOD: 426,
  LEAVES: 425,
  WATER: 664,
  GLASS: 287,
  PLANKS: 18,
  DIRT: 243,
  SNOW: 20,
  ICE: 21,
  CLOUD: 22,
  BEDROCK: 38,
  FLOWER: 24,
  GRASS_TALL: 25,
  STONE_BRICKS: 26,
  BRICKS: 27,
  CONCRETE: 28,
  SANDSTONE: 29,
  OBSIDIAN: 30,
  COBBLESTONE: 31,
  NETHER_REACK: 32,
  END_STONE: 33,
  WHITE_WOOL: 34,
  ORANGE_WOOL: 35,
  MAGENTA_WOOL: 36,
  LIGHT_BLUE_WOOL: 37,
  YELLOW_WOOL: 38,
  LIME_WOOL: 39,
  PINK_WOOL: 40,
  GRAY_WOOL: 41,
  LIGHT_GRAY_WOOL: 42,
  CYAN_WOOL: 43,
  PURPLE_WOOL: 44,
  BLUE_WOOL: 45,
  BROWN_WOOL: 46,
  GREEN_WOOL: 47,
  RED_WOOL: 48,
  BLACK_WOOL: 49,
  GOLD_BLOCK: 50,
  IRON_BLOCK: 51,
  DIAMOND_BLOCK: 52,
  LAPIS_LAZULI_BLOCK: 53,
  COAL_BLOCK: 54,
  EMERALD_BLOCK: 55,
  REDSTONE_BLOCK: 56,
  QUARTZ_BLOCK: 57,
  BOOKSHELF: 58,
  MOSSY_COBBLESTONE: 59,
  OBSIDIAN: 60,
  NETHERRACK: 61,
  SOUL_SAND: 62,
  GLOWSTONE: 63,
  SEA_LANTERN: 64,
};

export async function loadBlockRegistry(renderer)
{
  if (registryLoaded)
    return globalThis.Blocks;

  try
  {
    const Response = await fetch('../bin/config/blocks.json');
    if (!Response.ok)
      return globalThis.Blocks;

    const Config = await Response.json();

    const uniqueTexturePaths = new Set();
    for (const block of Object.values(Config))
    {
      for (const path of Object.values(block.textures))
      {
        uniqueTexturePaths.add(path);
      }
    }

    const textureLayersOrder = Array.from(uniqueTexturePaths);
    renderer.textureArray = await renderer.texturePool.getTextureArray(textureLayersOrder);

    // Вспомогательная функция, чтобы быстро узнать индекс слоя по имени файла
    const getLayerIndex = (fileName) => textureLayersOrder.indexOf(fileName);

    for (const [Name, block] of Object.entries(Config))
    {
      globalThis.Blocks[Name.toUpperCase()] = block.id;
      globalThis.BlockNamesById[block.id] = Name;

      let top, bottom, side;

      if (block.textures.all)
      {
        // Если текстура одинаковая со всех сторон
        top = bottom = side = getLayerIndex(block.textures.all);
      } else
      {
        // Если текстуры разные
        top = getLayerIndex(block.textures.top);
        bottom = getLayerIndex(block.textures.bottom);
        side = getLayerIndex(block.textures.side);
      }

      var blockType = 0;

      if (Name.includes('flower') || Name.includes('_grass'))
        blockType = 2;
      if (Name.includes('water') || Name.includes('lava') || Name.includes('leaves'))
        blockType = 1;
      renderer.materialPool.register(block.id, { top, bottom, side }, blockType);

    }
    registryLoaded = true;
  }
  catch (Error)
  {
    console.warn('Block registry load failed, using defaults:', Error);
  }

  refreshBlockRules();
  renderer.materialPool.updateGPU();
}

export function getBlockName(blockId)
{
  return globalThis.BlockNamesById[blockId] || `block_${blockId}`;
}

export function isSolid(blockId)
{
  return blockId > globalThis.Blocks.AIR;
}
