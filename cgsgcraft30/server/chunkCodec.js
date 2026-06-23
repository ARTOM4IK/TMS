const CHUNK_W = 16;
const CHUNK_H = 256;
const CHUNK_D = 16;
const CHUNK_BLOCK_COUNT = CHUNK_W * CHUNK_H * CHUNK_D;
const CHUNK_FORMAT = 'rle-zstd-v1';

let ZstdModule = null;

async function getZstd()
{
  if (!ZstdModule)
    ZstdModule = await import('zstdify');

  return ZstdModule;
}

function encodeRle(Blocks)
{
  const Runs = [];
  let Index = 0;

  while (Index < Blocks.length)
  {
    const Value = Blocks[Index];
    let Count = 1;

    while (Index + Count < Blocks.length && Blocks[Index + Count] === Value)
      Count++;

    Runs.push(Value, Count);
    Index += Count;
  }

  return new Uint32Array(Runs);
}

function decodeRle(RleData, ExpectedLength)
{
  const Blocks = new Uint32Array(ExpectedLength);
  let WriteIndex = 0;

  for (let I = 0; I < RleData.length; I += 2)
  {
    const Value = RleData[I];
    const Count = RleData[I + 1];
    Blocks.fill(Value, WriteIndex, WriteIndex + Count);
    WriteIndex += Count;
  }

  if (WriteIndex !== ExpectedLength)
    throw new Error(`RLE length mismatch: ${WriteIndex} vs ${ExpectedLength}`);

  return Blocks;
}

async function compressChunkBlocks(Blocks)
{
  const Rle = encodeRle(Blocks);
  const RleBytes = Buffer.from(Rle.buffer, Rle.byteOffset, Rle.byteLength);
  const { compress } = await getZstd();
  return Buffer.from(compress(RleBytes, { level: 3 }));
}

async function decompressChunkBlocks(CompressedBuffer)
{
  const { decompress } = await getZstd();
  const RleBytes = decompress(new Uint8Array(CompressedBuffer));

  if (RleBytes.byteLength % 4 !== 0)
    throw new Error('Invalid RLE byte alignment');

  const Rle = new Uint32Array(RleBytes.buffer, RleBytes.byteOffset, RleBytes.byteLength / 4);
  return decodeRle(Rle, CHUNK_BLOCK_COUNT);
}

function normalizePlayerState(State)
{
  if (!State || typeof State !== 'object')
    return null;

  const Position = Array.isArray(State.position) ? State.position : [0, 55, 0];

  const Inventory = State.inventory;
  let InventoryData = { slots: [], selectedSlot: 0 };

  if (Inventory && Array.isArray(Inventory.slots))
    InventoryData = { slots: Inventory.slots, selectedSlot: Inventory.selectedSlot || 0 };
  else if (Array.isArray(Inventory))
    InventoryData = { slots: Inventory, selectedSlot: 0 };

  return {
    position:
    {
      x: Number(Position[0]) || 0,
      y: Number(Position[1]) || 55,
      z: Number(Position[2]) || 0
    },
    yaw: typeof State.yaw === 'number' ? State.yaw : 0,
    pitch: typeof State.pitch === 'number' ? State.pitch : 0,
    target: Array.isArray(State.target) ? State.target.slice(0, 2) : [0, 0],
    inventory: InventoryData,
    role: State.role === 'homelander' ? 'homelander' : 'player',
    lastSavedAt: new Date()
  };
}

function playerStateToClient(StoredState)
{
  if (!StoredState)
    return null;

  return {
    position: [
      StoredState.position?.x ?? 0,
      StoredState.position?.y ?? 55,
      StoredState.position?.z ?? 0
    ],
    yaw: StoredState.yaw ?? 0,
    pitch: StoredState.pitch ?? 0,
    target: StoredState.target ?? [0, 0],
    inventory: StoredState.inventory ?? { slots: [], selectedSlot: 0 },
    role: StoredState.role ?? 'player'
  };
}

module.exports =
{
  CHUNK_W,
  CHUNK_H,
  CHUNK_D,
  CHUNK_BLOCK_COUNT,
  CHUNK_FORMAT,
  encodeRle,
  decodeRle,
  compressChunkBlocks,
  decompressChunkBlocks,
  normalizePlayerState,
  playerStateToClient
};
