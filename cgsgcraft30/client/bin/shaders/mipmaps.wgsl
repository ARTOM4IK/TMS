@group(0) @binding(0) var imgSource : texture_2d_array<f32>;
@group(0) @binding(1) var imgDestination : texture_storage_2d_array<rgba8unorm, write>;

const ALPHA_CUTOFF : f32 = 0.5;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) id : vec3<u32>)
{
    let dstSize = textureDimensions(imgDestination);
    if (id.x >= dstSize.x || id.y >= dstSize.y) {
        return;
    }

    let layer = id.z;
    let srcCoord = id.xy * 2u;

    let c00 = textureLoad(imgSource, srcCoord, layer, 0u);
    let c10 = textureLoad(imgSource, srcCoord + vec2<u32>(1u, 0u), layer, 0u);
    let c01 = textureLoad(imgSource, srcCoord + vec2<u32>(0u, 1u), layer, 0u);
    let c11 = textureLoad(imgSource, srcCoord + vec2<u32>(1u, 1u), layer, 0u);

    let samples = array<vec4<f32>, 4>(c00, c10, c01, c11);
    var sumColor = vec3<f32>(0.0);
    var sumWeight = 0.0;
    var maxAlpha = 0.0;

    for (var i = 0u; i < 4u; i = i + 1u) {
        let s = samples[i];
        maxAlpha = max(maxAlpha, s.a);
        if (s.a >= ALPHA_CUTOFF) {
            sumColor += s.rgb * s.a;
            sumWeight += s.a;
        }
    }

    var finalColor : vec4<f32>;
    if (sumWeight > 0.001) {
        finalColor = vec4<f32>(sumColor / sumWeight, maxAlpha);
    } else {
        finalColor = vec4<f32>(0.0, 0.0, 0.0, maxAlpha);
    }

    textureStore(imgDestination, id.xy, layer, finalColor);
}
