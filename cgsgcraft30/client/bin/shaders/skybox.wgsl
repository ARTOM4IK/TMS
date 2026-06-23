struct Uniforms {
    viewProjectionMatrix : mat4x4<f32>,
    TimeProjSizeDist : vec4<f32>,
    FrameWH : vec4<f32>,
    CamDir : vec4<f32>,
    CamRight : vec4<f32>,
    CamUp : vec4<f32>
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var skySampler : sampler;
@group(0) @binding(2) var skyTexture : texture_cube<f32>;

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) uv : vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    var output : VertexOutput;

    var pos = array<vec2f, 3>(
        vec2f(-1.0,  3.0),
        vec2f(-1.0, -1.0),
        vec2f( 3.0, -1.0)
    );

    let currentPos = pos[vertexIndex];

    output.position = vec4f(currentPos, 1.0, 1.0);
    output.uv = currentPos;
    return output;
}

@fragment
fn fs_main(@location(0) uv : vec2f) -> @location(0) vec4f {

    let coords = uv * 0.5 + 0.5;

    var Wp = uniforms.TimeProjSizeDist.z;
    var Hp = uniforms.TimeProjSizeDist.z;
    let FrameW = uniforms.FrameWH.x;
    let FrameH = uniforms.FrameWH.y;

    // Correct aspect ratio
    if (FrameW > FrameH)
    {
        Wp *= FrameW / f32(FrameH);
    }
    else
    {
        Hp *= FrameH / f32(FrameW);
    }

    // Project plane coordinates
    let xp = Wp * (coords.x) - Wp / 2.0;
    let yp = Hp * (coords.y) - Hp / 2.0;
    var Dir = uniforms.CamDir * uniforms.TimeProjSizeDist.w - uniforms.CamRight * xp + uniforms.CamUp * yp;
    Dir = normalize(Dir);

    return textureSample(skyTexture, skySampler, Dir.xyz);
}
