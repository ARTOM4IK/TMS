export class ShaderManager
{
  constructor(webgpu)
  {
    this.gpu = webgpu;
    this.modules = new Map();
  }

  createModule(name, code)
  {
    if (this.modules.has(name))
    {
      return this.modules.get(name);
    }

    const shaderModule = this.gpu.device.createShaderModule({
      label: name,
      code: code
    });

    shaderModule.getCompilationInfo().then((info) =>
    {
      if (info.messages.length > 0)
      {
        for (const msg of info.messages)
        {
          if (msg.type === 'error')
          {
            console.error(`[Shader Error] В шейдере "${name}" на строке ${msg.lineNum}: ${msg.message}`);
          }
        }
      }
    });

    this.modules.set(name, shaderModule);
    return shaderModule;
  }

  async loadModule(name, url)
  {
    if (this.modules.has(name))
    {
      return this.modules.get(name);
    }

    try
    {
      const response = await fetch(url);
      const code = await response.text();
      return this.createModule(name, code);
    } catch (err)
    {
      console.error(`Не удалось загрузить шейдер по пути: ${url}`, err);
    }
  }

  removeModule(name)
  {
    this.modules.delete(name);
  }
}
