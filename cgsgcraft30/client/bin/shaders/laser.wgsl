struct SceneUniforms {
  viewProjection: mat4x4<f32>,
};

struct LaserUniforms {
  model: mat4x4<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> laser: LaserUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(@location(0) localPos: vec3<f32>) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = laser.model * vec4<f32>(localPos, 1.0);
  out.position = scene.viewProjection * worldPos;
  out.color = laser.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return in.color;
}
