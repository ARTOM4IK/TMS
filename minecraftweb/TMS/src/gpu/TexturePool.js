export class TexturePool
{
  constructor(webgpu, shaderPool)
  {
    this.gpu = webgpu;
    this.shaderPool = shaderPool;
    this.pool = new Map();

  }

  async uploadTextureArrayWithMipmaps(textureArray, images)
  {
      const width = images[0].width;
      const height = images[0].height;

      const mipCanvas = document.createElement("canvas");
      const ctx = mipCanvas.getContext("2d");

      for (let layer = 0; layer < images.length; layer++)
      {
          let currentBitmap = images[layer];

          let mipWidth = width;
          let mipHeight = height;

          // mip0
          this.gpu.device.queue.copyExternalImageToTexture(
          {
              source: currentBitmap,
              flipY: false
          },
          {
              texture: textureArray,
              origin: [0, 0, layer],
              mipLevel: 0
          },
          [mipWidth, mipHeight]);

          const mipCount =
              Math.floor(Math.log2(Math.max(width, height))) + 1;

          for (let mip = 1; mip < mipCount; mip++)
          {
              mipWidth = Math.max(1, mipWidth >> 1);
              mipHeight = Math.max(1, mipHeight >> 1);

              mipCanvas.width = mipWidth;
              mipCanvas.height = mipHeight;

              ctx.clearRect(0, 0, mipWidth, mipHeight);

              ctx.drawImage(
                  currentBitmap,
                  0,
                  0,
                  currentBitmap.width,
                  currentBitmap.height,
                  0,
                  0,
                  mipWidth,
                  mipHeight
              );

              this.gpu.device.queue.copyExternalImageToTexture(
              {
                  source: mipCanvas
              },
              {
                  texture: textureArray,
                  origin: [0, 0, layer],
                  mipLevel: mip
              },
              [mipWidth, mipHeight]);

              currentBitmap =
                  await createImageBitmap(mipCanvas);
          }
      }
  }

  // --- ВОЗВРАЩАЕМ МЕТОД getTexture В БЕЗОПАСНЫЙ РЕЖИМ (БЕЗ ДОБАВЛЕНИЯ STORAGE ФЛАГОВ) ---
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
                  await fetch('../bin/textures/' + url);

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

              usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
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

    if (mipLevelCount > 1) {
      await this.generateMipmaps(texture, mipLevelCount, 1);
    }

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

    // Для кубмапы тоже считаем мип-мапы (кубмапа — это массив из 6 слоев)
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
