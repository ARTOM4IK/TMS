struct SceneUniforms {
  viewProjection: mat4x4<f32>,
};

struct PlayerUniforms {
  model: mat4x4<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> player: PlayerUniforms;
@group(1) @binding(1) var Tex : texture_2d<f32>;
@group(1) @binding(2) var Samp : sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv : vec2<f32>
};

@vertex
fn vs_main(
  @location(0) localPos: vec3<f32>,
  @location(1) uv : vec2<f32>
) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = player.model * vec4<f32>(localPos, 1.0);
  out.position = scene.viewProjection * worldPos;
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> 
{
  return textureSample(Tex, Samp, in.uv);
}
