export class TexturePool
{
  constructor(webgpu, shaderPool)
  {
    this.gpu = webgpu;
    this.shaderPool = shaderPool;
    this.pool = new Map();

  }

  async initMipPipeline()
  {
    this.mipShaderModule = await this.shaderPool.loadModule("mipmaps", "../../bin/shaders/mipmaps.wgsl")

    this.mipPipeline = this.gpu.device.createComputePipeline({
      label: 'Mipmap Generation Pipeline',
      layout: 'auto',
      compute: {
        module: this.mipShaderModule,
        entryPoint: 'main',
      }
    });
  }

  async uploadTextureArrayWithMipmaps(textureArray, images)
  {
    const device = this.gpu.device;
    const width = images[0].width;
    const height = images[0].height;
    const layerCount = images.length;
    const mipCount = Math.floor(Math.log2(Math.max(width, height))) + 1;

    if (!this.mipPipeline)
      await this.initMipPipeline();

    // 1. Загружаем Mip 0 для всех слоев
    for (let layer = 0; layer < layerCount; layer++)
    {
      device.queue.copyExternalImageToTexture(
        { source: images[layer], flipY: false, premultipliedAlpha: false },
        { texture: textureArray, origin: [0, 0, layer], mipLevel: 0 },
        [width, height]
      );
    }

    const commandEncoder = device.createCommandEncoder({ label: 'Mipmap Encoder' });
    let mipWidth = width;
    let mipHeight = height;

    // 2. Последовательно генерируем уровни мипмапов
    for (let mip = 1; mip < mipCount; mip++)
    {
      mipWidth = Math.max(1, mipWidth >> 1);
      mipHeight = Math.max(1, mipHeight >> 1);

      // Изолируем ровно ОДИН уровень для чтения и ОДИН для записи
      const srcView = textureArray.createView({ baseMipLevel: mip - 1, mipLevelCount: 1 });
      const dstView = textureArray.createView({ baseMipLevel: mip, mipLevelCount: 1 });

      // В биндингах теперь только текстуры, никакого буфера и никаких смещений!
      const bindGroup = device.createBindGroup({
        layout: this.mipPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: srcView },
          { binding: 1, resource: dstView }
        ]
      });

      const workgroupCountX = Math.ceil(mipWidth / 16);
      const workgroupCountY = Math.ceil(mipHeight / 16);

      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(this.mipPipeline);
      passEncoder.setBindGroup(0, bindGroup);

      // Обрабатываем все слои параллельно на GPU
      passEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY, layerCount);
      passEncoder.end();
    }

    device.queue.submit([commandEncoder.finish()]);
  }

  getTexture(width, height, format, usage, mipLevelCount = 1)
  {
    const key = `${width}x${height}_${format}_${usage}_mip${mipLevelCount}`;

    if (!this.pool.has(key))
    {
      this.pool.set(key, []);
    }

    const list = this.pool.get(key);
    if (list.length > 0)
    {
      return list.pop();
    }

    return this.gpu.device.createTexture({
      size: [width, height],
      format: format,
      usage: usage,
      mipLevelCount: mipLevelCount
    });
  }

  async getTextureArray(urls)
  {
    const images = await Promise.all(
          urls.map(async url =>
          {
              const response =
                  await fetch('../bin/textures/block/' + url);

              const blob =
                  await response.blob();

              return await createImageBitmap(blob);
          })
      );

    const width = images[0].width;
    const height = images[0].height;

    const layerCount = images.length;

    const mipLevelCount = 
          Math.floor(
              Math.log2(
                  Math.max(width, height)
              )
          ) + 1;

    const textureArray =
          this.gpu.device.createTexture(
          {
              label: "Voxel Texture Array",

              size:
              [
                  width,
                  height,
                  layerCount
              ],

              format: 'rgba8unorm',

              mipLevelCount,

              usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING
          });
    await this.uploadTextureArrayWithMipmaps(textureArray, images);
    return textureArray;
  }

  async loadTexture(url)
  {
    const response = await fetch(url);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    const mipLevelCount = Math.floor(Math.log2(Math.max(imageBitmap.width, imageBitmap.height))) + 1;
    const usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;
    const texture = this.getTexture(imageBitmap.width, imageBitmap.height, 'rgba8unorm', usage, mipLevelCount);

    this.gpu.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: texture, mipLevel: 0 },
      [imageBitmap.width, imageBitmap.height]
    );

    return texture;
  }

  async getCubeTexture(urls)
  {
    const promises = urls.map(async (url) =>
    {
      const response = await fetch(url);
      const blob = await response.blob();
      return await createImageBitmap(blob);
    });
    const images = await Promise.all(promises);

    const width = images[0].width;
    const height = images[0].height;

    const mipLevelCount = 1;//Math.floor(Math.log2(Math.max(width, height))) + 1;

    const texture = this.gpu.device.createTexture({
      size: [width, height, 6],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount: mipLevelCount
    });

    for (let i = 0; i < 6; i++)
    {
      this.gpu.device.queue.copyExternalImageToTexture(
        { source: images[i], flipY: false },
        { texture: texture, origin: [0, 0, i], mipLevel: 0 },
        [width, height]
      );
    }

    if (mipLevelCount > 1) {
      await this.generateMipmaps(texture, mipLevelCount, 6);
    }

    return texture;
  }

  releaseTexture(texture, format, usage)
  {
    const key = `${texture.width}x${texture.height}_${format}_${usage}_mip${texture.mipLevelCount}`;
    if (!this.pool.has(key))
    {
      this.pool.set(key, []);
    }
    this.pool.get(key).push(texture);
  }

  clear()
  {
    for (const list of this.pool.values())
    {
      while (list.length > 0)
      {
        list.pop().destroy();
      }
    }
    this.pool.clear();
  }
}
