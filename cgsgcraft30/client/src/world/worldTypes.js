export const WORLD_TYPES =
{
  DEFAULT: 'default',
  FLAT: 'flat',
  LARGE_BIOMES: 'large_biomes',
  AMPLIFIED: 'amplified'
};

export const WORLD_TYPE_CONFIG =
{
  [WORLD_TYPES.DEFAULT]:
  {
    biomeScale: 1,
    heightScale: 1,
    flat: false
  },
  [WORLD_TYPES.FLAT]:
  {
    biomeScale: 1,
    heightScale: 0,
    flat: true,
    flatHeight: 64
  },
  [WORLD_TYPES.LARGE_BIOMES]:
  {
    biomeScale: 2.5,
    heightScale: 1,
    flat: false
  },
  [WORLD_TYPES.AMPLIFIED]:
  {
    biomeScale: 1,
    heightScale: 2.2,
    flat: false
  }
};

export function resolveWorldTypeConfig(worldType)
{
  return WORLD_TYPE_CONFIG[worldType] || WORLD_TYPE_CONFIG[WORLD_TYPES.DEFAULT];
}
