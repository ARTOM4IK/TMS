import
{
  vec4,
  vec3,
  vec2,
  mat4
}
from "../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
function mix(A, B, T)
{
    return A * (1 - T) + B * T;
}
function extractFrustumPlanes(m) {
    return [
        // left
        [
            m[3] + m[0],
            m[7] + m[4],
            m[11] + m[8],
            m[15] + m[12],
        ],

        // right
        [
            m[3] - m[0],
            m[7] - m[4],
            m[11] - m[8],
            m[15] - m[12],
        ],

        // bottom
        [
            m[3] + m[1],
            m[7] + m[5],
            m[11] + m[9],
            m[15] + m[13],
        ],

        // top
        [
            m[3] - m[1],
            m[7] - m[5],
            m[11] - m[9],
            m[15] - m[13],
        ],

        // near
        [
            m[3] + m[2],
            m[7] + m[6],
            m[11] + m[10],
            m[15] + m[14],
        ],

        // far
        [
            m[3] - m[2],
            m[7] - m[6],
            m[11] - m[10],
            m[15] - m[14],
        ],
    ];
}

export class Camera
{
    constructor()
    {
        this.position = vec3.create(3, 10, 0);
        this.forward = vec3.create(0, 0, 1);
        this.up = vec3.create(0, 1, 0);
        this.right = vec3.create(1, 0, 0);
        this.aspect = 1;
        this.yaw = 0;
        this.pitch = 0;
        this.target = vec2.create(0, 0);
        this.fov = 90;
        this.OldTime = 0;
        this.view = mat4.identity();
        this.projection = mat4.identity();
        this.viewProjection = mat4.identity();
        this.near = 0.1;
        this.far = 1000;

    }

    update(fov, aspect)
    {
        let target = vec3.add(this.position, this.forward);
        this.fov = fov;
        this.aspect = aspect;

        this.up = vec3.normalize(vec3.cross(this.forward, this.right));

        this.view = mat4.lookAt(this.position, target, this.up);
        this.projection = mat4.perspective(this.fov * Math.PI / 180, this.aspect, this.near, this.far);
        this.viewProjection = mat4.multiply(this.projection, this.view);
    }

    updateViewMatrix()
    {
        const target = vec3.add(this.position, this.forward);

        this.up = vec3.normalize(vec3.cross(this.forward, this.right));

        this.view = mat4.lookAt(this.position, target, this.up);
        this.projection = mat4.perspective(this.fov * Math.PI / 180, this.aspect, this.near, this.far);
        this.viewProjection = mat4.multiply(this.projection, this.view);
    }

    IsVisible(aabb) 
    {
        const m = this.viewProjection;

        const planes = extractFrustumPlanes(m);

        const min = aabb.min;
        const max = aabb.max;

        for (let i = 0; i < 6; i++) 
        {
            const a = planes[i][0];
            const b = planes[i][1];
            const c = planes[i][2];
            const d = planes[i][3];

            // p-vertex
            const px = a > 0 ? max[0] : min[0];
            const py = b > 0 ? max[1] : min[1];
            const pz = c > 0 ? max[2] : min[2];

            if (a * px + b * py + c * pz + d < 0) 
            {
                return false; // outside
            }
        }

        return true;
    }
}

