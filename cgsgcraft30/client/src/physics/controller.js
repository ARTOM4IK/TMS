import
{
  vec3,
  vec2
}
from "../../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";

export class Controller
{
  constructor()
  {
  }

  checkCollision(player, world)
  {
    return this.checkCollisionAt(
      player.camera.position[0],
      player.camera.position[1],
      player.camera.position[2],
      player,
      world
    );
  }

  checkCollisionAt(x, y, z, player, world)
  {
    const min = vec3.create(x - player.width * 0.5, y - player.height, z - player.width * 0.5);
    const max = vec3.create(x + player.width * 0.5, y, z + player.width * 0.5);

    const startX = Math.floor(min[0]);
    const endX = Math.floor(max[0]);
    const startY = Math.floor(min[1]);
    const endY = Math.floor(max[1]);
    const startZ = Math.floor(min[2]);
    const endZ = Math.floor(max[2]);

    for (let bx = startX; bx <= endX; bx++)
    {
      for (let by = startY; by <= endY; by++)
      {
        for (let bz = startZ; bz <= endZ; bz++)
        {
          const block = world.getBlock(bx, by, bz);
          if (block !== null && block !== 0 && block !== globalThis.Blocks?.WATER)
            return true;
        }
      }
    }
    return false;
  }

  update(player, world, time)
  {
    const delta = time.delta;

    const dir = vec2.normalize(vec2.create(player.camera.forward[0], player.camera.forward[2]));
    const right = vec2.normalize(vec2.create(player.camera.right[0], player.camera.right[2]));

    if (player.IsFly)
    {
      player.velocity[0] = 0;
      player.velocity[2] = 0;

      if (player.moveForward)
      {
        player.velocity[0] += player.speed * dir[0];
        player.velocity[2] += player.speed * dir[1];
      }
      if (player.moveBackward)
      {
        player.velocity[0] -= player.speed * dir[0];
        player.velocity[2] -= player.speed * dir[1];
      }
      if (player.moveLeft)
      {
        player.velocity[0] += player.speed * right[0];
        player.velocity[2] += player.speed * right[1];
      }
      if (player.moveRight)
      {
        player.velocity[0] -= player.speed * right[0];
        player.velocity[2] -= player.speed * right[1];
      }

      if (player.IsJump)
        player.velocity[1] = player.flyVerticalSpeed;
      else if (player.IsCrouch)
        player.velocity[1] = -player.flyVerticalSpeed;
      else
        player.velocity[1] *= Math.exp(-12 * delta);

      player.camera.position[0] += player.velocity[0] * delta;
      player.camera.position[1] += player.velocity[1] * delta;
      player.camera.position[2] += player.velocity[2] * delta;
      player.onGround = false;
      player.camera.updateViewMatrix();
      return;
    }

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

    player.camera.position[0] += player.velocity[0] * delta;
    if (this.checkCollision(player, world))
    {
      player.camera.position[0] -= player.velocity[0] * delta;
      player.velocity[0] = 0;
    }

    player.camera.position[2] += player.velocity[2] * delta;
    if (this.checkCollision(player, world))
    {
      player.camera.position[2] -= player.velocity[2] * delta;
      player.velocity[2] = 0;
    }

    player.onGround = false;
    player.camera.position[1] += player.velocity[1] * delta;
    if (this.checkCollision(player, world))
    {
      if (player.velocity[1] < 0)
        player.onGround = true;
      player.camera.position[1] -= player.velocity[1] * delta;
      player.velocity[1] = 0;
    }

    const friction = Math.exp(-10 * delta);
    player.velocity[0] *= friction;
    player.velocity[2] *= friction;

    player.camera.updateViewMatrix();
  }
}
