export class WebGPU
{
  constructor()
  {
    this.canvas = null;
    this.context = null;
    this.adapter = null;
    this.device = null;
    this.format = '';
  }

  async init(canvas)
  {
    if (!navigator.gpu)
    {
      throw new Error("WebGPU не поддерживается этим браузером.");
    }

    this.canvas = canvas;
    this.adapter = await navigator.gpu.requestAdapter();

    if (!this.adapter)
    {
      throw new Error("Не удалось запросить WebGPU адаптер.");
    }


    // 1. Проверяем, сколько поддерживает видеокарта пользователя
    const requiredMaxInvocations = 512;
    const supportedMaxInvocations = this.adapter.limits.maxComputeInvocationsPerWorkgroup;

    if (supportedMaxInvocations < requiredMaxInvocations) {
        throw new Error(`Видеокарта не поддерживает ${requiredMaxInvocations} потоков!`);
    }

    const requiredLayers = 1024;
    const supportedMaxLayers = this.adapter.limits.maxTextureArrayLayers;

    if (supportedMaxLayers < requiredMaxInvocations)
    {
      throw new Error(`Видеокарта не поддерживает ${requiredMaxInvocations} уровней текстур!`);
    }

    // 2. Запрашиваем повышенный лимит при создании устройства
    this.device = await this.adapter.requestDevice(
      {
        requiredLimits:
        {
            maxComputeInvocationsPerWorkgroup: requiredMaxInvocations,
            maxTextureArrayLayers: requiredLayers
        }
    });

    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque'
    });
  }

  getCurrentTextureView()
  {
    return this.context.getCurrentTexture().createView();
  }

  resize(width, height)
  {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
