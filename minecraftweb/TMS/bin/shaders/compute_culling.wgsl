const CHUNK_SIZE_X : u32 = 16u;
const CHUNK_SIZE_Y : u32 = 256u;
const CHUNK_SIZE_Z : u32 = 16u;

struct Counter
{
   value : atomic<u32>
};

@group(0) @binding(0)
var<storage, read> blocks : array<u32>;
@group(0) @binding(1)
var<storage, read_write> faces : array<u32>;
@group(0) @binding(2)
var<storage, read_write> counter : Counter;

fn blockIndex(x : u32, y : u32, z : u32) -> u32
{
    return x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
}

fn isAir(x : i32, y : i32, z : i32) -> bool
{
  if (x < 0 || y < 0 || z < 0 ||
      x >= i32(CHUNK_SIZE_X) ||
      y >= i32(CHUNK_SIZE_Y) ||
      z >= i32(CHUNK_SIZE_Z))
  {
    return true;
  }
  let idx = blockIndex(u32(x), u32(y), u32(z));
  return blocks[idx] == 0u;
}

fn packFace( x : u32, y : u32, z : u32, face : u32, block : u32) -> u32
{
 return (x & 15u) | ((y & 255u) << 4u) | ((z & 15u) << 12u) | ((face & 7u) << 16u) | ((block & 4095u) << 19u);
}

fn emitFace( x : u32, y : u32, z : u32, face : u32, block : u32 )
{
  let dst = atomicAdd(&counter.value, 1u);
  faces[dst] = packFace(x, y, z, face, block);
}

@compute @workgroup_size(8, 8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>)
{
   if (gid.x >= CHUNK_SIZE_X ||
       gid.y >= CHUNK_SIZE_Y ||
       gid.z >= CHUNK_SIZE_Z)
   {
       return;
   }
   let idx = blockIndex(gid.x, gid.y, gid.z);
   let block = blocks[idx];
   if (block == 0u)
   {
       return;
   }
   let x = i32(gid.x);
   let y = i32(gid.y);
   let z = i32(gid.z);
   // +X
   if (isAir(x + 1, y, z))
   {
       emitFace(gid.x, gid.y, gid.z, 0u, block);
   }
   // -X
   if (isAir(x - 1, y, z))
   {
       emitFace(gid.x, gid.y, gid.z, 1u, block);
   }
   // +Y
   if (isAir(x, y + 1, z))
   {
       emitFace(gid.x, gid.y, gid.z, 2u, block);
   }
   // -Y
   if (isAir(x, y - 1, z))
   {
       emitFace(gid.x, gid.y, gid.z, 3u, block);
   }
   // +Z
   if (isAir(x, y, z + 1))
   {
       emitFace(gid.x, gid.y, gid.z, 4u, block);
   }
   // -Z
   if (isAir(x, y, z - 1))
   {
       emitFace(gid.x, gid.y, gid.z, 5u, block);
   }
}
