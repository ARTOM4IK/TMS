@group(0) @binding(0)
var srcTex: texture_2d<f32>;

@group(0) @binding(1)
var dstTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {

    let size = textureDimensions(dstTex);

    if (id.x >= size.x || id.y >= size.y) {
        return;
    }

    let base = vec2<i32>(id.xy) * 2;

    let c0 = textureLoad(srcTex, base + vec2<i32>(0, 0), 0);
    let c1 = textureLoad(srcTex, base + vec2<i32>(1, 0), 0);
    let c2 = textureLoad(srcTex, base + vec2<i32>(0, 1), 0);
    let c3 = textureLoad(srcTex, base + vec2<i32>(1, 1), 0);

    let result = (c0 + c1 + c2 + c3) * 0.25;

    textureStore(dstTex, vec2<i32>(id.xy), result);
}