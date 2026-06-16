import
{
  vec3,
  vec2,
  mat4
}
from "/node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";

export class Controller
{
  constructor()
  {
  }

  checkCollision(player, world)
  {
    const min = player.getMin();
    const max = player.getMax();

    let startX = Math.floor(min[0]);
    let endX = Math.floor(max[0]);
    let startY = Math.floor(min[1]);
    let endY = Math.floor(max[1]);
    let startZ = Math.floor(min[2]);
    let endZ = Math.floor(max[2]);

    for (let x = startX; x <= endX; x++)
    {
      for (let y = startY; y <= endY; y++)
      {
        for (let z = startZ; z <= endZ; z++)
        {
          const block = world.getBlock(x, y, z);
          if (block !== null && block !== 0)
          {
            return true;
          }
        }
      }
    }
    return false;
  }

  update(player, world, time)
  {
    let delta = time.delta;
    let currentTime = time.lastTime;

    var dir = vec2.create(player.camera.forward[0], player.camera.forward[2]);
    dir = vec2.normalize(dir);
    var right = vec2.create(player.camera.right[0], player.camera.right[2]);
    right = vec2.normalize(right);
    
    if (player.moveForward)
    {
      player.velocity[0] += player.speed * delta * dir[0];
      player.velocity[2] += player.speed * delta * dir[1];
    }

    if (player.moveBackward)
    {
      player.velocity[0] -= player.speed * delta * dir[0];
      player.velocity[2] -= player.speed * delta * dir[1];
    }

    if (player.moveLeft)
    {
      player.velocity[0] += player.speed * delta * right[0];
      player.velocity[2] += player.speed * delta * right[1];
    }

    if (player.moveRight)
    {
      player.velocity[0] -= player.speed * delta * right[0];
      player.velocity[2] -= player.speed * delta * right[1];
    }

    player.velocity[1] -= 11.5 * delta * 2;

    if (player.onGround && player.IsJump)
    {
      player.velocity[1] = player.jumpForce;
      player.IsJump = false;
      player.onGround = false;
    }

    if (player.IsFly)
    {
      if (player.IsJump)
        player.velocity[1] = player.jumpForce;
      if (player.IsCrouch)
        player.velocity[1] = -player.jumpForce * 0.73;
    }

    player.camera.position[0] += player.velocity[0] * delta;
    if (this.checkCollision(player, world))
    {
      player.camera.position[0] -= player.velocity[0] * delta; // Возврат
      player.velocity[0] = 0;
    }

    player.camera.position[2] += player.velocity[2] * delta;
    if (this.checkCollision(player, world))
    {
      player.camera.position[2] -= player.velocity[2] * delta; // Возврат
      player.velocity[2] = 0;
    }

    player.onGround = false;
    player.camera.position[1] += player.velocity[1] * delta;
    if (this.checkCollision(player, world))
    {
      if (player.velocity[1] < 0)
      {
        player.onGround = true;
      }
      player.camera.position[1] -= player.velocity[1] * delta; // Возврат
      player.velocity[1] = 0;
    }

    let friction = Math.exp(-10 * delta); // Независимо от FPS
    player.velocity[0] *= friction;
    player.velocity[2] *= friction;

    player.camera.updateViewMatrix();
  }
}
