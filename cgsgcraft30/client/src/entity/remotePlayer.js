import { mix } from '../math/math.js';

export class RemotePlayer
{
  constructor(Id, Name, Color)
  {
    this.id = Id;
    this.name = Name;
    this.color = Color;
    this.position = [0, 55, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.targetX = 0;
    this.targetY = 55;
    this.targetZ = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.lastUpdate = Date.now();
    this.hasState = false;
    this.walkPhase = 0;
    this.prevX = 0;
    this.prevZ = 0;
  }

  applyState(State)
  {
    this.targetX = State.x;
    this.targetY = State.y;
    this.targetZ = State.z;
    this.targetYaw = State.yaw;
    this.targetPitch = State.pitch;
    if (State.name)
      this.name = State.name;

    if (!this.hasState)
    {
      this.position[0] = State.x;
      this.position[1] = State.y;
      this.position[2] = State.z;
      this.yaw = State.yaw;
      this.pitch = State.pitch;
      this.prevX = State.x;
      this.prevZ = State.z;
      this.hasState = true;
    }

    this.lastUpdate = Date.now();
  }

  update(Delta)
  {
    const T = 1 - Math.exp(-18 * Delta);
    this.position[0] = mix(this.position[0], this.targetX, T);
    this.position[1] = mix(this.position[1], this.targetY, T);
    this.position[2] = mix(this.position[2], this.targetZ, T);
    this.yaw = mix(this.yaw, this.targetYaw, T);
    this.pitch = mix(this.pitch, this.targetPitch, T);

    const Speed = Math.hypot(this.position[0] - this.prevX, this.position[2] - this.prevZ);
    if (Speed > 0.01)
      this.walkPhase += Delta * Speed * 2;

    this.prevX = this.position[0];
    this.prevZ = this.position[2];
  }
}
