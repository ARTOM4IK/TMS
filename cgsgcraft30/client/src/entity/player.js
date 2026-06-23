import { vec3 } from "../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
import { Camera } from '../renderer/camera.js';
import { mix } from "../math/math.js";
import { WORLD_CONFIG } from '../world/worldConfig.js';
import { Inventory } from './inventory.js';

export const ROLES =
{
  PLAYER: 'player',
  HOMELANDER: 'homelander'
};

export class Player
{
  constructor()
  {
    this.camera = new Camera();
    this.OldPos = vec3.create();
    this.velocity = vec3.create();
    this.width = 0.6;
    this.height = 1.75;
    this.onGround = false;
    this.walkSpeed = 55;
    this.runSpeed = 82;
    this.flySpeed = 82;
    this.flyVerticalSpeed = 50;
    this.speed = this.walkSpeed;
    this.jumpForce = 9;
    this.IsJump = false;
    this.IsCrouch = false;
    this.IsRun = false;
    this.IsScope = false;
    this.IsFly = false;
    this.OldTime = 0;
    this.role = ROLES.PLAYER;
    this.inventory = new Inventory();
    this.inventory.seedStarterItems();
    this.laserCooldown = 0;
    this.lastSpaceTap = 0;
  }

  isHomelander()
  {
    return this.role === ROLES.HOMELANDER;
  }

  isStay()
  {
    const newPos = this.camera.position;
    const dx = Math.floor(newPos[0] / WORLD_CONFIG.CHUNK_W) === Math.floor(this.OldPos[0] / WORLD_CONFIG.CHUNK_W);
    const dz = Math.floor(newPos[2] / WORLD_CONFIG.CHUNK_D) === Math.floor(this.OldPos[2] / WORLD_CONFIG.CHUNK_D);
    vec3.set(newPos[0], newPos[1], newPos[2], this.OldPos);
    return dx && dz;
  }

  exportState()
  {
    return {
      position: [
        this.camera.position[0],
        this.camera.position[1],
        this.camera.position[2]
      ],
      yaw: this.camera.yaw,
      pitch: this.camera.pitch,
      target: [this.camera.target[0], this.camera.target[1]],
      inventory: this.inventory.exportData(),
      role: this.role,
      isFly: this.IsFly
    };
  }

  applyState(State)
  {
    if (!State)
      return;

    const Spawn = WORLD_CONFIG.DEFAULT_SPAWN;

    if (Array.isArray(State.position) && State.position.length === 3)
      vec3.set(State.position[0], State.position[1], State.position[2], this.camera.position);
    else
      vec3.set(Spawn.x, Spawn.y, Spawn.z, this.camera.position);

    this.camera.yaw = typeof State.yaw === 'number' ? State.yaw : Spawn.yaw;
    this.camera.pitch = typeof State.pitch === 'number' ? State.pitch : Spawn.pitch;

    if (Array.isArray(State.target) && State.target.length === 2)
    {
      this.camera.target[0] = State.target[0];
      this.camera.target[1] = State.target[1];
    }
    else
    {
      this.camera.target[0] = this.camera.yaw;
      this.camera.target[1] = this.camera.pitch;
    }

    if (State.inventory)
      this.inventory = Inventory.fromData(State.inventory);
    else
      this.inventory.seedStarterItems();

    if (State.inventory && !this.inventory.slots.some(Stack => Stack && Stack.count > 0))
      this.inventory.seedStarterItems();

    if (State.role)
      this.setRole(State.role);

    if (this.isHomelander() && typeof State.isFly === 'boolean')
      this.IsFly = State.isFly;
  }

  setRole(Role)
  {
    this.role = Role === ROLES.HOMELANDER ? ROLES.HOMELANDER : ROLES.PLAYER;
    this.IsFly = false;
  }

  handleFlyToggle(input)
  {
    if (!this.isHomelander() || input.uiCapture)
      return;

    if (!input.keysClick[' '])
      return;

    const Now = performance.now();
    if (Now - this.lastSpaceTap < 350)
    {
      this.IsFly = !this.IsFly;
      if (!this.IsFly)
        this.velocity[1] = Math.min(this.velocity[1], 0);
    }

    this.lastSpaceTap = Now;
    input.keysClick[' '] = false;
  }

  update(input, time)
  {
    let zoom = 1;
    let latence = 42;

    this.IsJump = false;
    this.IsCrouch = false;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.IsScope = false;

    this.handleFlyToggle(input);

    if (input.keys['shift'] && input.keys['r'])
      this.camera.position = vec3.create(0, 200, 0);

    if (input.keys[' '] && !input.uiCapture)
      this.IsJump = true;

    if (input.keys['c'])
      this.IsScope = true;

    if (input.keys['shift'])
      this.IsCrouch = true;

    if (input.keys['w'])
    {
      this.moveForward = true;
      if (input.keys['control'] && !this.IsRun)
      {
        this.IsRun = true;
        this.OldTime = time.lastTime;
      }
    }
    else if (this.IsRun)
    {
      this.IsRun = false;
      this.OldTime = time.lastTime;
    }

    if (input.keys['s']) this.moveBackward = true;
    if (input.keys['a']) this.moveLeft = true;
    if (input.keys['d']) this.moveRight = true;

    const MoveSpeed = this.IsFly ? this.flySpeed : (this.IsRun ? this.runSpeed : this.walkSpeed);

    if (this.IsRun && !this.IsFly)
    {
      const alpha = 1 - Math.exp(-24 * time.delta);
      this.speed = mix(this.speed, MoveSpeed, alpha);
      if (!this.IsScope)
        this.camera.fov = mix(this.camera.fov, 110, alpha);
    }
    else
    {
      const alpha = 1 - Math.exp(-24 * time.delta);
      this.speed = mix(this.speed, MoveSpeed, alpha);
      if (!this.IsScope && !this.IsFly)
        this.camera.fov = mix(this.camera.fov, 90, alpha);
      else if (this.IsFly && !this.IsScope)
        this.camera.fov = mix(this.camera.fov, 95, alpha);
    }

    if (this.IsScope)
    {
      const alpha = 1 - Math.exp(-30 * time.delta);
      this.camera.fov = mix(this.camera.fov, 10, alpha);
      zoom *= 0.1;
      latence *= 0.3;
    }

    const T = 1 - Math.exp(-latence * time.delta);

    if (!input.uiCapture)
    {
      this.camera.target[0] -= input.mouseDeltaX * 0.01 * zoom;
      this.camera.target[1] -= input.mouseDeltaY * 0.01 * zoom;
    }

    this.camera.target[1] = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.camera.target[1]));
    this.camera.yaw = mix(this.camera.yaw, this.camera.target[0], T);
    this.camera.pitch = mix(this.camera.pitch, this.camera.target[1], T);
    this.camera.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.camera.pitch));

    this.camera.forward = vec3.create(
      -Math.sin(this.camera.yaw) * Math.cos(this.camera.pitch),
      Math.sin(this.camera.pitch),
      -Math.cos(this.camera.yaw) * Math.cos(this.camera.pitch)
    );
    this.camera.right = vec3.create(-Math.cos(this.camera.yaw), 0, Math.sin(this.camera.yaw));

    if (this.laserCooldown > 0)
      this.laserCooldown -= time.delta;
  }

  getMin()
  {
    return vec3.create(
      this.camera.position[0] - this.width * 0.5,
      this.camera.position[1] - this.height,
      this.camera.position[2] - this.width * 0.5
    );
  }

  getMax()
  {
    return vec3.create(
      this.camera.position[0] + this.width * 0.5,
      this.camera.position[1],
      this.camera.position[2] + this.width * 0.5
    );
  }

  blockOverlapsPlayer(bx, by, bz)
  {
    const BlockMin = [bx, by, bz];
    const BlockMax = [bx + 1, by + 1, bz + 1];
    const PMin = this.getMin();
    const PMax = this.getMax();

    return BlockMin[0] < PMax[0] && BlockMax[0] > PMin[0]
      && BlockMin[1] < PMax[1] && BlockMax[1] > PMin[1]
      && BlockMin[2] < PMax[2] && BlockMax[2] > PMin[2];
  }
}
