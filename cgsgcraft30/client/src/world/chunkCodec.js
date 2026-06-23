import { compress, decompress } from '../../node_modules/zstdify/dist/index.js';
import { Chunk } from './chunk.js';
import { WORLD_CONFIG } from './worldConfig.js';

export function encodeRle(Blocks)
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

export function decodeRle(RleData, ExpectedLength)
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

export function compressChunkBlocks(Blocks)
{
  const Rle = encodeRle(Blocks);
  const RleBytes = new Uint8Array(Rle.buffer, Rle.byteOffset, Rle.byteLength);
  return compress(RleBytes, { level: 3 });
}

export function decompressChunkBlocks(Compressed)
{
  const RleBytes = decompress(Compressed);

  if (RleBytes.byteLength % 4 !== 0)
    throw new Error('Invalid RLE byte alignment');

  const Rle = new Uint32Array(RleBytes.buffer, RleBytes.byteOffset, RleBytes.byteLength / 4);
  return decodeRle(Rle, Chunk.TOTAL_BLOCKS);
}

export function bytesToBase64(Bytes)
{
  let Binary = '';
  const Step = 8192;

  for (let I = 0; I < Bytes.length; I += Step)
    Binary += String.fromCharCode(...Bytes.subarray(I, I + Step));

  return btoa(Binary);
}

export function base64ToBytes(Base64)
{
  const Binary = atob(Base64);
  const Bytes = new Uint8Array(Binary.length);

  for (let I = 0; I < Binary.length; I++)
    Bytes[I] = Binary.charCodeAt(I);

  return Bytes;
}

export function exportChunkPayload(Blocks)
{
  return {
    format: WORLD_CONFIG.CHUNK_FORMAT,
    data: bytesToBase64(compressChunkBlocks(Blocks))
  };
}

export function importChunkPayload(Payload)
{
  if (!Payload || typeof Payload.data !== 'string')
    throw new Error('Invalid chunk payload');

  return decompressChunkBlocks(base64ToBytes(Payload.data));
}
