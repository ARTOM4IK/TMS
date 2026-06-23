struct Uniforms
{
  viewProjectionMatrix : mat4x4<f32>,
  TimeProjSizeDist : vec4<f32>,
  FrameWH : vec4<f32>,
  CamDir : vec4<f32>,
  CamRight : vec4<f32>,
  CamUp : vec4<f32>,
  CamLoc : vec4<f32>
};

@group(0) @binding(0) var<uniform> camera : Uniforms;
@group(0) @binding(1) var<uniform> offset : vec2<i32>;
@group(0) @binding(2) var<storage, read> faces : array<u32>;
@group(0) @binding(3) var<storage, read> materialPool: array<u32>;
@group(0) @binding(4) var blockTextureArray: texture_2d_array<f32>;
@group(0) @binding(5) var textureSampler: sampler;

struct VertexOutput
{
    @builtin(position) Position : vec4<f32>,
    @location(0) fragPos : vec3<f32>,
    @location(1) fragTexcoord : vec2<f32>,
    @location(2) fragNormal : vec3<f32>,
    @location(3) @interpolate(flat) texIndex : u32
};

const quad = array<vec2<u32>, 6>
(
  vec2<u32>(0, 0),
  vec2<u32>(1, 1),
  vec2<u32>(0, 1),

  vec2<u32>(1, 1),
  vec2<u32>(1, 0),
  vec2<u32>(0, 0),
);

const Normals = array<vec3f, 6>(
    vec3f( 1.0,  0.0,  0.0 ), // +X
    vec3f(-1.0,  0.0,  0.0 ), // -X
    vec3f( 0.0,  1.0,  0.0 ), // +Y
    vec3f( 0.0, -1.0,  0.0 ), // -Y
    vec3f( 0.0,  0.0,  1.0 ), // +Z
    vec3f( 0.0,  0.0, -1.0 ), // -Z
);

fn buildFaceVertex( face : u32, uv : vec2<u32>, packedMaterial : u32 ) -> vec4<u32>
{
  let topTex = (packedMaterial >> 20u) & 0x3FFu;
  let bottomTex = (packedMaterial >> 10u) & 0x3FFu;
  let sideTex = packedMaterial & 0x3FFu;
  let blocktype = (packedMaterial >> 30u) & 0x3u;

  if (blocktype == 2u)
  {
    let tex = sideTex;

    let u = uv.x;
    let v = uv.y;

    switch(face)
    {
      case 0u:
      {
        return vec4(u, v, u, tex);
      }
      default:
      {
        return vec4(u, v, 1u - u, tex);
      }
    }
  }

  switch(face)
  {
    // +X
    case 0u:
    {
      return vec4(1, uv.y, uv.x, sideTex);
    }
    // -X
    case 1u:
    {
      return vec4(0, uv.y, uv.x, sideTex);
    }
    // +Y
    case 2u:
    {
      return vec4(uv.x, 1, uv.y, topTex);
    }
    // -Y
    case 3u:
    {
      return vec4(uv.x, 0, uv.y, bottomTex);
    }
    // +Z
    case 4u:
    {
      return vec4(uv.x, uv.y, 1, sideTex);
    }
    // -Z
    default:
    {
      return vec4(uv.x, uv.y, 0, sideTex);
    }
  }
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32, @builtin(instance_index) instanceIndex : u32) -> VertexOutput
{
  var output : VertexOutput;

  let packed = faces[instanceIndex];

  let x = packed & 15u;
  let y = (packed >> 4u) & 255u;
  let z = (packed >> 12u) & 15u;

  let face = (packed >> 16u) & 7u;
  let blockType = packed >> 19u;
  let uv = quad[vertexIndex];
  let packedMaterial = materialPool[blockType];

  let localPos = vec3<f32>(f32(x), f32(y), f32(z));
  let corner = buildFaceVertex(face, uv, packedMaterial);

  let worldPos = vec3<f32>(f32(offset.x), 0, f32(offset.y)) + localPos + vec3<f32>(corner.xyz);
  output.Position = camera.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
  output.fragTexcoord = vec2<f32>(uv);
  output.fragPos = worldPos;
  output.fragNormal = Normals[face];
  output.texIndex = corner.w;

  return output;
}

fn faceForward( N: vec3f, V: vec3f ) -> vec3f
{
  if (dot(N, V) < 0.0)
  {
    return -N;
  }
  return N;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4<f32>
{
  let texColor = textureSample(blockTextureArray, textureSampler, vec2f(input.fragTexcoord.x, 1.0 - input.fragTexcoord.y), input.texIndex);
  if (texColor.a < 0.1)
  {
    discard;
  }

  let V = camera.CamLoc.xyz - input.fragPos;
  let distance = sqrt(dot(V, V));
  let viewDir = normalize(V);
  let N = faceForward(normalize(input.fragNormal), -viewDir);

  let lightDir = normalize(vec3f(1, 1, 1));
  let diffuse = max(dot(N, -lightDir), 0.0);

  let reflectDir = reflect(-viewDir, N);
  let specular = pow(max(dot(-viewDir, reflectDir), 0.0), 32.0) * 0.3;

  let finalColor = texColor.rgb + specular * 0.1;

  var alpha = 1.0 - smoothstep(16f * 8, 16f * 8 + 10, distance);

  if (texColor.a < 0.99)
  {
    alpha *= 1.0 - texColor.a;
  }

  return vec4<f32>(vec3f(finalColor), alpha);
//    return vec4<f32>(0.4 * texColor.rgb + texColor.rgb * finalColor, 1.0);
}
