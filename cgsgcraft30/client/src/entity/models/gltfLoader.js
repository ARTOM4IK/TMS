const GLB_MAGIC = 0x46546C67;
const CHUNK_JSON = 0x4E4F534A;
const CHUNK_BIN = 0x004E4942;

const COMPONENT_FLOAT = 5126;
const COMPONENT_USHORT = 5123;
const COMPONENT_UINT = 5125;
const COMPONENT_UBYTE = 5121;

function readAccessor(gltf, bin, accessorIndex)
{
  const Accessor = gltf.accessors[accessorIndex];
  const View = gltf.bufferViews[Accessor.bufferView];
  const Offset = (View.byteOffset || 0) + (Accessor.byteOffset || 0);
  const Data = new DataView(bin, Offset);

  const Count = Accessor.count;
  const Type = Accessor.type;
  const ComponentType = Accessor.componentType;
  const Components =
  Type === 'VEC2' ? 2 :
  Type === 'VEC3' ? 3 :
  Type === 'VEC4' ? 4 :
  Type === 'SCALAR' ? 1 : 0;

  if (Components === 0)
    throw new Error(`Unsupported accessor type: ${Type}`);

  const Out = new Float32Array(Count * Components);

  for (let I = 0; I < Count; I++)
  {
    for (let C = 0; C < Components; C++)
    {
      const Idx = I * Components + C;
      if (ComponentType === COMPONENT_FLOAT)
        Out[Idx] = Data.getFloat32((I * Components + C) * 4, true);
      else if (ComponentType === COMPONENT_USHORT)
        Out[Idx] = Data.getUint16((I * Components + C) * 2, true);
      else if (ComponentType === COMPONENT_UINT)
        Out[Idx] = Data.getUint32((I * Components + C) * 4, true);
    }
  }

  return { data: Out, count: Count, components: Components };
}

function readIndices(gltf, bin, accessorIndex)
{
  const Accessor = gltf.accessors[accessorIndex];
  const View = gltf.bufferViews[Accessor.bufferView];
  const Offset = (View.byteOffset || 0) + (Accessor.byteOffset || 0);
  const Count = Accessor.count;
  const ComponentType = Accessor.componentType;
  const Data = new DataView(bin, Offset);
  const Out = new Uint32Array(Count);

  for (let I = 0; I < Count; I++)
  {
    if (ComponentType === COMPONENT_USHORT)
      Out[I] = Data.getUint16(I * 2, true);
    else if (ComponentType === COMPONENT_UINT)
      Out[I] = Data.getUint32(I * 4, true);
    else if (ComponentType === COMPONENT_FLOAT)
      Out[I] = Data.getFloat32(I * 4, true);
  }

  return Out;
}

function getBaseColor(gltf, materialIndex)
{
  if (materialIndex == null || !gltf.materials)
    return [0.8, 0.8, 0.8, 1];

  const Material = gltf.materials[materialIndex];
  const Factor = Material?.pbrMetallicRoughness?.baseColorFactor;
  if (Array.isArray(Factor) && Factor.length >= 3)
    return [Factor[0], Factor[1], Factor[2], Factor[3] ?? 1];

  return [0.8, 0.8, 0.8, 1];
}

function computeBounds(positions)
{
  const Min = [Infinity, Infinity, Infinity];
  const Max = [-Infinity, -Infinity, -Infinity];

  for (let I = 0; I < positions.length; I += 3)
  {
    for (let A = 0; A < 3; A++)
    {
      Min[A] = Math.min(Min[A], positions[I + A]);
      Max[A] = Math.max(Max[A], positions[I + A]);
    }
  }

  return { min: Min, max: Max, height: Max[1] - Min[1] };
}

function normalizePositions(positions, bounds, targetHeight)
{
  const Height = bounds.height || 1;
  const Scale = targetHeight / Height;
  const CenterX = (bounds.min[0] + bounds.max[0]) * 0.5;
  const CenterZ = (bounds.min[2] + bounds.max[2]) * 0.5;

  for (let I = 0; I < positions.length; I += 3)
  {
    positions[I] = (positions[I] - CenterX) * Scale;
    positions[I + 1] = (positions[I + 1] - bounds.min[1]) * Scale;
    positions[I + 2] = (positions[I + 2] - CenterZ) * Scale;
  }
}

async function loadTextureFromGlb(
  Gltf,
  Bin,
  Device
)
{
  if (!Gltf.images?.length)
    return null;

  const Image = Gltf.images[0];

  const View =
    Gltf.bufferViews[
      Image.bufferView
    ];

  const Offset =
    View.byteOffset || 0;

  const Bytes =
    Bin.slice(
      Offset,
      Offset + View.byteLength
    );

  const BlobObj =
    new Blob(
      [Bytes],
      { type: Image.mimeType }
    );

  const Bitmap =
    await createImageBitmap(
      BlobObj
    );

  const Texture =
    Device.createTexture({
      size: [
        Bitmap.width,
        Bitmap.height
      ],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT
    });

  Device.queue.copyExternalImageToTexture(
    { source: Bitmap },
    { texture: Texture },
    [
      Bitmap.width,
      Bitmap.height
    ]
  );

  return Texture;
}

function buildTexturedVertices(positions, uvs)
{
  const VertexCount = positions.length / 3;

  const Vertices = new Float32Array(VertexCount * 5);

  for (let I = 0; I < VertexCount; I++)
  {
    const P = I * 3;
    const T = I * 2;
    const V = I * 5;

    Vertices[V]     = positions[P];
    Vertices[V + 1] = positions[P + 1];
    Vertices[V + 2] = positions[P + 2];

    Vertices[V + 3] = uvs ? uvs[T] : 0;
    Vertices[V + 4] = uvs ? (1 - uvs[T + 1]) : 0;
  }

  return Vertices;
}

export async function loadGlbMesh(Url, Options = {}, device = null )
{
  const Response = await fetch(Url);

  if (!Response.ok)
    return null;

  const Buffer = await Response.arrayBuffer();
  const View = new DataView(Buffer);

  if (View.getUint32(0, true) !== GLB_MAGIC)
    throw new Error('Invalid GLB file');

  const JsonLength = View.getUint32(12, true);

  const Gltf = JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(Buffer, 20, JsonLength)
    )
  );

  const BinStart = 20 + ((JsonLength + 3) & ~3);

  let Bin = null;

  if (BinStart + 8 <= Buffer.byteLength)
  {
    const BinLength = View.getUint32(BinStart, true);
    const BinType = View.getUint32(BinStart + 4, true);

    if (BinType === CHUNK_BIN)
      Bin = Buffer.slice(BinStart + 8, BinStart + 8 + BinLength);
  }

  const AllPositions = [];
  const AllUvs = [];
  const AllIndices = [];
  let VertexOffset = 0;

  for (const Mesh of Gltf.meshes)
  {
    for (const Primitive of Mesh.primitives)
    {
      if (Primitive.attributes?.POSITION == null)
        continue;

      const Positions =
        readAccessor(
          Gltf,
          Bin,
          Primitive.attributes.POSITION
        );
      const Uvs =
        Primitive.attributes?.TEXCOORD_0 != null
          ? readAccessor(
              Gltf,
              Bin,
              Primitive.attributes.TEXCOORD_0
            )
          : null;

      const PosCopy = new Float32Array(Positions.data);

      AllPositions.push(PosCopy);

      if (Uvs)
      {
        AllUvs.push(
          new Float32Array(Uvs.data)
        );
      }
      else
      {
        AllUvs.push(
          new Float32Array(
            Positions.count * 2
          )
        );
      }

      if (Primitive.indices != null)
      {
        const Indices =
          readIndices(
            Gltf,
            Bin,
            Primitive.indices
          );

        for (let I = 0; I < Indices.length; I++)
          AllIndices.push(Indices[I] + VertexOffset);
      }
      else
      {
        for (let I = 0; I < Positions.count; I++)
          AllIndices.push(VertexOffset + I);
      }

      VertexOffset += Positions.count;
    }
  }

  const TotalVertexCount =
    AllPositions.reduce(
      (A, B) => A + B.length,
      0
    );

  const TotalUvCount =
    AllUvs.reduce(
      (A, B) => A + B.length,
      0
    );

  const UvData =
    new Float32Array(
      TotalUvCount
    );

  let UvOffset = 0;

  for (const Chunk of AllUvs)
  {
    UvData.set(
      Chunk,
      UvOffset
    );

    UvOffset += Chunk.length;
  }

  const Positions = new Float32Array(TotalVertexCount);

  let PosOffset = 0;

  for (const Chunk of AllPositions)
  {
    Positions.set(Chunk, PosOffset);
    PosOffset += Chunk.length;
  }

  const Bounds = computeBounds(Positions);

  normalizePositions(
    Positions,
    Bounds,
    Options.targetHeight ?? 1.6
  );

  const Color = [1, 1, 1, 1];

  const Vertices =
    buildTexturedVertices(
      Positions,
      UvData
    );

  return {
    vertices: Vertices,
    indices: new Uint32Array(AllIndices),
    indexCount: AllIndices.length,
    textures : device ? await loadTextureFromGlb(Gltf, Bin, device) : null,
    bounds: Bounds,
    scale: Options.scale ?? 1,
    yOffset: Options.yOffset ?? 0
  };
}