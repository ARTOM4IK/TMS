export class PipelineManager
{
  constructor(webgpu)
  {
    this.gpu = webgpu;
    this.pipelines = new Map(); // Кэш пайплайнов (Ключ: строковое имя, Значение: Pipeline объект)
  }

  /**
   * Создает и кэширует графический конвейер (Render Pipeline)
   * @param {string} name - Уникальное имя пайплайна для кэша
   * @param {Object} options - Конфигурация пайплайна
   */
  createRenderPipeline(name, options)
  {
    if (this.pipelines.has(name))
    {
      return this.pipelines.get(name);
    }

    // Собираем дефолтные настройки, если они не переданы явно
    const vertexState = {
      module: options.vertexModule,
      entryPoint: options.vertexEntry || 'vertexMain',
      buffers: options.vertexBuffers || [] // Описание Layout-а вершинных буферов
    };

    const fragmentState = options.fragmentModule ? {
      module: options.fragmentModule,
      entryPoint: options.fragmentEntry || 'fragmentMain',
      targets: options.targets || [{
        format: this.gpu.format, // Формат экрана по умолчанию
        blend: options.blend || undefined
      }]
    } : undefined;

    const primitiveState = {
      topology: options.topology || 'triangle-list',
      stripIndexFormat: undefined,
      frontFace: options.frontFace || 'ccw',
      cullMode: options.cullMode || 'none',
    };

    const pipelineDescriptor = {
      label: name,
      layout: options.layout || 'auto', // 'auto' автоматически генерирует Bind Group Layout на основе шейдера
      vertex: vertexState,
      fragment: fragmentState,
      primitive: primitiveState,
      depthStencil: options.depthStencil || undefined,
      multisample: options.multisample || undefined
    };

    const pipeline = this.gpu.device.createRenderPipeline(pipelineDescriptor);
    this.pipelines.set(name, pipeline);
    return pipeline;
  }

  /**
   * Создает и кэширует вычислительный конвейер (Compute Pipeline)
   * @param {string} name - Уникальное имя пайплайна
   * @param {GPUShaderModule} module - Скомпилированный шейдерный модуль
   * @param {string} entryPoint - Имя функции в шейдере
   * @param {GPUPipelineLayout|string} layout - Схема привязок ресурсов
   */
  createComputePipeline(name, module, entryPoint = 'computeMain', layout = 'auto')
  {
    if (this.pipelines.has(name))
    {
      return this.pipelines.get(name);
    }

    const pipeline = this.gpu.device.createComputePipeline({
      label: name,
      layout: layout,
      compute: {
        module: module,
        entryPoint: entryPoint
      }
    });

    this.pipelines.set(name, pipeline);
    return pipeline;
  }

  get(name)
  {
    const pipeline = this.pipelines.get(name);
    if (!pipeline)
    {
      console.warn(`[PipelineManager] Пайплайн "${name}" не найден.`);
    }
    return pipeline;
  }

  clear()
  {
    this.pipelines.clear();
  }
}
