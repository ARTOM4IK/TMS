import { WebGPU } from "../gpu/WebGPU.js";
import { BufferPool } from "../gpu/BufferPool.js";
import { TexturePool } from "../gpu/TexturePool.js";
import { ShaderManager } from "../gpu/ShaderManager.js";
import { PipelineManager } from "../gpu/PipelineManager.js";
import { MaterialPool } from "../gpu/MaterialPool.js";

export class Renderer
{
    constructor()
    {
        this.webgpu = null;
        this.shaders = null;
        this.pipelines = null;
        this.bufferPool = null;
        this.texturePool = null;
        this.depthTexture = null;
        this.bindGroup = null;
        this.counterBuffer = null;
    }

    async loadBlocks()
    {
        // 1. Загружаем конфигурацию блоков
        const res = await fetch('../bin/config/blocks.json');
        const blocksConfig = await res.json();

        // 2. Собираем уникальный список путей ко ВСЕМ текстурам
        const uniqueTexturePaths = new Set();
        for (const block of Object.values(blocksConfig))
        {
            for (const path of Object.values(block.textures))
            {
                uniqueTexturePaths.add(path);
            }
        }

        // Превращаем Set в массив. Индекс в этом массиве — это будущий слой на GPU!
        const textureLayersOrder = Array.from(uniqueTexturePaths);

        const blockTextureArray = await this.texturePool.getTextureArray(textureLayersOrder);

        // Вспомогательная функция, чтобы быстро узнать индекс слоя по имени файла
        const getLayerIndex = (fileName) => textureLayersOrder.indexOf(fileName);

        // 5. Автоматически регистрируем блоки в Material Pool
        for (const [name, block] of Object.entries(blocksConfig))
        {
            let top, bottom, side;

            if (block.textures.all)
            {
                // Если текстура одинаковая со всех сторон
                top = bottom = side = getLayerIndex(block.textures.all);
            } else
            {
                // Если текстуры разные
                top = getLayerIndex(block.textures.top);
                bottom = getLayerIndex(block.textures.bottom);
                side = getLayerIndex(block.textures.side);
            }

            this.materialPool.register(block.id, { top, bottom, side });
        }

        // Обновляем буфер пула на GPU
        this.materialPool.updateGPU();

        return blockTextureArray;
    }

    async init(canvas)
    {
        this.webgpu = new WebGPU();
        await this.webgpu.init(canvas);
        this.shaders = new ShaderManager(this.webgpu);
        this.pipelines = new PipelineManager(this.webgpu);
        this.bufferPool = new BufferPool(this.webgpu);
        this.texturePool = new TexturePool(this.webgpu, this.shaders);
        this.materialPool = new MaterialPool(this.webgpu);

        const resizeCanvas = () =>
        {
            const dpr = window.devicePixelRatio || 1;
            this.webgpu.resize(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr))
            // this.canvas.style.width = window.innerWidth + 'px';
            // this.canvas.style.height = window.innerHeight + 'px';
            this.IsResize = true;
            if (this.depthTexture)
                this.depthTexture.destroy();
            this.depthTexture = this.texturePool.getTexture(this.webgpu.canvas.width, this.webgpu.canvas.height, 'depth24plus', GPUTextureUsage.RENDER_ATTACHMENT);
            this.depthView = this.depthTexture.createView();
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        this.computePipeline = this.pipelines.createComputePipeline("Face culling compute pipeline",
            (await this.shaders.loadModule("culling", "../bin/shaders/compute_culling.wgsl")),
            "main"
        );

        this.counterBuffer = this.bufferPool.getBuffer(4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);

        const uniformBufferSize = 96 + 48 + 16;
        this.uniformBuffer = this.bufferPool.getBuffer(uniformBufferSize, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

        const urls =
            [
                "../../bin/textures/SkyLight/xpos.bmp",
                "../../bin/textures/SkyLight/xneg.bmp",
                "../../bin/textures/SkyLight/ypos.bmp",
                "../../bin/textures/SkyLight/yneg.bmp",
                "../../bin/textures/SkyLight/zpos.bmp",
                "../../bin/textures/SkyLight/zneg.bmp"
            ];
        this.SkyBox = await this.texturePool.getCubeTexture(urls);
        const cubeSampler = this.webgpu.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

        const bindGroupLayoutSky = this.webgpu.device.createBindGroupLayout({
            entries:
                [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' }
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT,
                        sampler: { type: 'filtering' }
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.FRAGMENT,
                        texture: { sampleType: 'float', viewDimension: 'cube' }
                    }
                ]
        });

        const skyShader = await this.shaders.loadModule("sky", "../bin/shaders/skybox.wgsl");

        const sky_pipeline = this.pipelines.createRenderPipeline("sky",
        {
            layout: this.webgpu.device.createPipelineLayout({ label: "sky_layout_pipeline", bindGroupLayouts: [bindGroupLayoutSky] }),
            vertexModule: skyShader,
            vertexEntry: 'vs_main',
            vertexBuffers: [],
            fragmentModule: skyShader,
            fragmentEntry: 'fs_main',
            targets: [{ format: this.webgpu.format }],
            primitive: { topology: 'triangle-list', cullMode : 'none' },
            depthStencil:
            {
                format: 'depth24plus',
                depthWriteEnabled: false,
                depthCompare: 'less-equal'
            }
        });
        this.skyboxBindGroup = this.webgpu.device.createBindGroup({
            layout: bindGroupLayoutSky,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } }, // Матрица камеры
                { binding: 1, resource: cubeSampler },
                { binding: 2, resource: this.SkyBox.createView({ dimension: 'cube' }) }
            ]
        });

        this.textureArray = await this.loadBlocks();

        const bindGroupLayout = this.webgpu.device.createBindGroupLayout({
            entries:
            [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float', viewDimension: '2d-array' }
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                }
            ]
        });
        this.Sampler = this.webgpu.device.createSampler({magFilter: 'nearest', minFilter: 'nearest', mipmapFilter: 'linear'});
        // this.bindGroup = this.webgpu.device.createBindGroup({
        //     layout: bindGroupLayout,
        //     entries:
        //     [
        //         {
        //             binding: 0,
        //             resource: { buffer: this.uniformBuffer }
        //         },
        //         {
        //             binding: 1,
        //             resource: { buffer: this.uniformBuffer }
        //         },
        //         {
        //             binding: 2,
        //             resource: { buffer: this.materialPool.gpuBuffer }
        //         },
        //         {
        //             binding: 3,
        //             resource: TextureArray.createView({ dimension: '2d-array' })
        //         },
        //         {
        //             binding: 4,
        //             resource: Sampler
        //         }
        //     ]
        // });
        const mainShader = await this.shaders.loadModule("default", "../bin/shaders/main.wgsl");
        const mainPipeline = this.pipelines.createRenderPipeline("main",
            {
                layout: this.webgpu.device.createPipelineLayout({ label: "main_layout_pipeline", bindGroupLayouts: [bindGroupLayout] }),
                vertexModule: mainShader,
                vertexEntry: 'vs_main',
                vertexBuffers: [],
                // [
                //     {
                //         arrayStride: 16, // 8 floats * 4 bytes
                //         stepMode: 'vertex',
                //         attributes:
                //         [
                //             { shaderLocation: 0, offset: 0, format: 'float32x3' },
                //             { shaderLocation: 1, offset: 12, format: 'float32' },
                //         ]
                //     },
                //     {
                //         arrayStride: 16, // 3 uint * 4 bytes + 4 bytes uint
                //         stepMode: 'instance',
                //         attributes:
                //         [
                //             { shaderLocation: 2, offset: 0, format: 'sint32x3' },
                //             { shaderLocation: 3, offset: 12, format: 'sint32' }
                //         ]
                //     }
                // ],
                fragmentModule: mainShader,
                fragmentEntry: 'fs_main',
                targets: [{ format: this.webgpu.format }],
                primitive: { topology: 'triangle-list', cullMode: 'back' },
                depthStencil:
                {
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                    format: 'depth24plus'
                },
            });
        this.depthTexture = this.texturePool.getTexture(canvas.width, canvas.height, 'depth24plus', GPUTextureUsage.RENDER_ATTACHMENT);

        // compute

// ..        const cubeBuffer = device.createBuffer({
//         size: cubes.length * 16,
//         usage: GPUBufferUsage.STORAGE,
//         mappedAtCreation: true
//         });
//         new Float32Array(cubeBuffer.getMappedRange()).set(cubeData);
//         cubeBuffer.unmap();

//         const visibleBuffer = device.createBuffer({
//         size: cubes.length * 16,
//         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX
//         });

//         const counterBuffer = device.createBuffer({
//         size: 4,
//         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
//         });

//         const indirectBuffer = device.createBuffer({
//         size: 16,
//         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_SRC
// ..        });
    }

    FrameStart(camera)
    {
        if (this.IsResize)
        {
            this.IsResize = false;
            camera.update(camera.fov, this.webgpu.canvas.width / this.webgpu.canvas.height);
        }

        const uniformBufferSize = 96 + 48 + 16;
        const uniformData = new Float32Array(uniformBufferSize / 4);

        uniformData.set(camera.viewProjection, 0);
        uniformData[16] = 0;
        uniformData[18] = 2 * camera.near * Math.tan(camera.fov * Math.PI / 360);
        uniformData[19] = camera.near;
        uniformData[20] = this.webgpu.canvas.width;
        uniformData[21] = this.webgpu.canvas.height;

        uniformData[24] = camera.forward[0];
        uniformData[25] = camera.forward[1];
        uniformData[26] = camera.forward[2];

        uniformData[28] = camera.right[0];
        uniformData[29] = camera.right[1];
        uniformData[30] = camera.right[2];

        uniformData[32] = camera.up[0];
        uniformData[33] = camera.up[1];
        uniformData[34] = camera.up[2];

        uniformData[36] = camera.position[0];
        uniformData[37] = camera.position[1];
        uniformData[38] = camera.position[2];

        this.bufferPool.write(this.uniformBuffer, uniformData, 0);

        this.commandEncoder = this.webgpu.device.createCommandEncoder();
        this.CurrentImage = this.webgpu.context.getCurrentTexture().createView();
    }

    FrameEnd()
    {
        this.webgpu.device.queue.submit([this.commandEncoder.finish()]);
    }

    renderWorld(chunks, camera)
    {

        const renderPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.CurrentImage,
                clearValue: [0.40, 0.55, 0.7, 1.0],
                loadOp: 'load',
                storeOp: 'store'
            }],
            depthStencilAttachment: this.depthTexture ? {
                view: this.depthView,
                depthClearValue: 1.0,
                depthLoadOp: 'load',
                depthStoreOp: 'store'
            } : undefined
        });

        const mainPipeline = this.pipelines.get("main");
        renderPass.setPipeline(mainPipeline);

        for (const chunk of chunks.values())
        {
            if (!camera.IsVisible(chunk.AABB))
                continue;

            renderPass.setBindGroup(0, chunk.bindGroup);
            renderPass.draw(6, chunk.CountFaces, 0, 0);
        }
        renderPass.end();
    }

    renderSky(skybox)
    {
        const renderPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.CurrentImage,
                    clearValue: [0.05, 0.05, 0.1, 1.0],
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: this.depthTexture ?
            {
                view: this.depthView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            } : undefined
        });

        renderPass.setPipeline(this.pipelines.get("sky"));
        renderPass.setBindGroup(0, this.skyboxBindGroup);
        renderPass.draw(3);
        renderPass.end();
    }
}
