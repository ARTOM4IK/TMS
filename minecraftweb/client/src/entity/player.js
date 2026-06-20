import { vec3 } from "../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
import { Camera } from '../renderer/camera.js';
import { mix } from "../math/math.js";

export class Player
{
  constructor()
  {
    this.camera = new Camera();

    this.velocity = vec3.create();
    this.width = 0.6
    this.height = 1.8;
    this.onGround = false;
    this.walkSpeed = 55;
    this.runSpeed = 82;
    this.speed = this.walkSpeed;
    this.jumpForce = 8;
    this.IsJump = false;
    this.IsCrouch = false;
    this.IsRun = false;
    this.IsScope = false;
    this.OldTime = 0;
  }

  update(input, time)
  {
    var zoom = 1;
    var latence = 42;

    this.IsJump = false;
    this.IsCrouch = false;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.IsFly = true;
    this.IsScope = false;

    if (input.keys[' '])
    {
      this.IsJump = true;
    }
    if (input.keys['c'])
    {
      this.IsScope = true;
    }
    if (input.keys['shift'])
    {
      this.IsCrouch = true;
    }
    if (input.keys['w'])
    {
      this.moveForward = true;
      if (input.keys['control'] && !this.IsRun)
      {
        this.IsRun = true;
        this.OldTime = time.lastTime;
      }
    }
    else
    {
      if (this.IsRun)
      {
        this.IsRun = false;
        this.OldTime = time.lastTime;
      }
    }
    if (input.keys['s'])
    {
      this.moveBackward = true;
    }
    if (input.keys['a'])
    {
      this.moveLeft = true;
    }
    if (input.keys['d'])
    {
      this.moveRight = true;
    }

    if (this.IsRun)
    {
      const alpha = 1 - Math.exp(-24 * time.delta);
      this.speed = mix(this.speed, this.runSpeed, alpha);
      if (!this.IsScope)
        this.camera.fov = mix(this.camera.fov, 110, alpha);

    }
    else
    {
      const alpha = 1 - Math.exp(-24 * time.delta);
      this.speed = mix(this.speed, this.walkSpeed, alpha);
      if (!this.IsScope)
        this.camera.fov = mix(this.camera.fov, 90, alpha);
    }

    if (this.IsScope)
    {
      const alpha = 1 - Math.exp(-30 * time.delta);
      this.camera.fov = mix(this.camera.fov, 10, alpha);
      zoom *= 0.1;
      latence *= 0.3;
    }

    const T = 1 - Math.exp(-latence * time.delta);

    this.camera.target[0] -= input.mouseDeltaX * 0.01 * zoom;
    this.camera.target[1] -= input.mouseDeltaY * 0.01 * zoom;
    this.camera.target[1] = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.camera.target[1]));

    this.camera.yaw = mix(this.camera.yaw, this.camera.target[0], T);
    this.camera.pitch = mix(this.camera.pitch, this.camera.target[1], T);

    this.camera.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.camera.pitch));

    this.camera.forward = vec3.create(-Math.sin(this.camera.yaw) * Math.cos(this.camera.pitch), Math.sin(this.camera.pitch), -Math.cos(this.camera.yaw) * Math.cos(this.camera.pitch));
    this.camera.right = vec3.create(-Math.cos(this.camera.yaw), 0, Math.sin(this.camera.yaw));

  }

  getMin()
  {
    return vec3.create(this.camera.position[0] - this.width * 0.5, this.camera.position[1] - this.height, this.camera.position[2] - this.width * 0.5);
  }

  getMax()
  {
    return vec3.create(this.camera.position[0] + this.width * 0.5, this.camera.position[1], this.camera.position[2] + this.width * 0.5);
  }
}
