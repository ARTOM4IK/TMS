function createCube()
{
    return new Float32Array([
        // Задняя грань (-Z)
        0, 0, 0, 0,
        1, 1, 0, 0,  // 0
        1, 0, 0, 0,
        1, 1, 0, 0,
        0, 0, 0, 0,
        0, 1, 0, 0,

        // Передняя грань (+Z)
        0, 0, 1, 1,
        1, 0, 1, 1, // 1
        1, 1, 1, 1,
        1, 1, 1, 1,
        0, 1, 1, 1,
        0, 0, 1, 1,

        // Левая грань (-X)
        0, 0, 1, 2,
        0, 1, 0, 2,
        0, 0, 0, 2, // 2
        0, 0, 1, 2,
        0, 1, 1, 2,
        0, 1, 0, 2,

        // Правая грань (+X)
        1, 0, 0, 3,
        1, 1, 0, 3,
        1, 1, 1, 3, // 3
        1, 1, 1, 3,
        1, 0, 1, 3,
        1, 0, 0, 3,

        // Нижняя грань (-Y)
        0, 0, 0, 4,
        1, 0, 0, 4,
        1, 0, 1, 4, // 4
        1, 0, 1, 4,
        0, 0, 1, 4,
        0, 0, 0, 4,

        // Верхняя грань (+Y)
        0, 1, 0, 5,
        0, 1, 1, 5,
        1, 1, 1, 5,
        1, 1, 1, 5, // 5
        1, 1, 0, 5,
        0, 1, 0, 5,
    ]);
}

class Mesh
{
  constructor(VertexBuffer, InstanceBuffer, VertexCount, InstanceCount, AABB)
  {
    this.VertexBuffer = VertexBuffer;
    this.InstanceBuffer = InstanceBuffer;
    this.VertexCount = VertexCount;
    this.InstanceCount = InstanceCount;
    this.AABB = AABB;
  }

  destroy()
  {
    this.InstanceBuffer.destroy();
  }
}

export class MeshUploader
{
  constructor(renderer)
  {
    this.renderer = renderer;
    this.cube = createCube();
  }

  async InitCube()
  {
    // this.VertexBuffer = this.renderer.bufferPool.getBuffer(this.cube.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    // this.renderer.bufferPool.write(this.VertexBuffer, this.cube, 0);
  }

  Upload(Data)
  {
    let positions = Data.Positions;

    let I = this.renderer.bufferPool.getBuffer(positions.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    this.renderer.bufferPool.write(I, positions, 0);

    return new Mesh(this.VertexBuffer, I, this.cube.length / 4, positions.length / 4, Data.AABB);
  }
}
