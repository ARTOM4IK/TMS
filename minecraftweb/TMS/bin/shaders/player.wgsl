struct SceneUniforms {
  viewProjection: mat4x4<f32>,
};

struct PlayerUniforms {
  model: mat4x4<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> player: PlayerUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(@location(0) localPos: vec3<f32>) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = player.model * vec4<f32>(localPos, 1.0);
  out.position = scene.viewProjection * worldPos;
  out.color = player.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return in.color;
}
