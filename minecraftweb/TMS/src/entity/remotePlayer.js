import { mix } from '../math/math.js';

const PLAYER_HEIGHT = 1.8;
const PLAYER_WIDTH = 0.6;

export class RemotePlayer
{
  constructor(Id, Name, Color)
  {
    this.id = Id;
    this.name = Name;
    this.color = Color;
    this.x = 0;
    this.y = 55;
    this.z = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.targetX = 0;
    this.targetY = 55;
    this.targetZ = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.lastUpdate = Date.now();
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
    this.lastUpdate = Date.now();
  }

  update(Delta)
  {
    const T = 1 - Math.exp(-18 * Delta);
    this.x = mix(this.x, this.targetX, T);
    this.y = mix(this.y, this.targetY, T);
    this.z = mix(this.z, this.targetZ, T);
    this.yaw = mix(this.yaw, this.targetYaw, T);
    this.pitch = mix(this.pitch, this.targetPitch, T);
  }

  getBodyCenter()
  {
    return [
      this.x,
      this.y - PLAYER_HEIGHT * 0.5,
      this.z
    ];
  }

  getHeadCenter()
  {
    return [
      this.x,
      this.y - 0.2,
      this.z
    ];
  }

  getBodyScale()
  {
    return [PLAYER_WIDTH, PLAYER_HEIGHT * 0.75, PLAYER_WIDTH];
  }

  getHeadScale()
  {
    return [0.35, 0.35, 0.35];
  }
}
