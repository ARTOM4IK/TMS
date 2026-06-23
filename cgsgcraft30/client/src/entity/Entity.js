import { vec3 } from "../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";

export class Entity
{
  constructor(Id, Type)
  {
    this.id = Id;
    this.type = Type;
    this.position = vec3.create(0, 0, 0);
    this.velocity = vec3.create(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.alive = true;
    this.animTime = 0;
    this.walkPhase = 0;
    this.modelId = Type;
    this.health = 20;
    this.onGround = false;
  }

  updateAnim(Delta)
  {
    this.animTime += Delta;
    const Speed = Math.hypot(this.velocity[0], this.velocity[2]);
    if (Speed > 0.05)
      this.walkPhase += Delta * Speed * 3;
  }
}
