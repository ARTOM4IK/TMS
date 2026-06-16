import { Renderer } from '../renderer/renderer.js';
import { Input } from './input.js';
import { Time } from './time.js';
import { World } from '../world/world.js';
import { MeshUploader } from '../renderer/mesh.js';
import { Player } from '../entity/player.js';
import { Controller } from '../physics/controller.js';
import { Camera } from '../renderer/camera.js';
import { Multiplayer } from '../network/multiplayer.js';
import { PlayerRenderer } from '../renderer/playerRenderer.js';
import { WorldStorage } from '../network/worldStorage.js';
import { Chunk } from '../world/chunk.js';

/**
 * Находит первую целую координату (воксель), которую пересекает луч из камеры.
 * @param {Object} cameraPos - Позиция камеры {x, y, z}
 * @param {Object} cameraDir - Направление взгляда (нормализованный вектор) {x, y, z}
 * @param {number} maxDistance - Максимальное расстояние полета луча
 * @param {Function} isSolidBlock - Функция-колбэк (x,y,z) => boolean. Возвращает true, если по этим координатам есть блок.
 * @returns {Object|null} Координаты целого блока {x, y, z} или null, если ничего не найдено
 */

export class Game
{
    constructor()
    {
        this.world = new World();
        this.renderer = new Renderer();
        this.meshUploader = new MeshUploader(this.renderer);
        this.input = new Input(document.getElementById("gpuCanvas"));
        this.time = new Time();
        this.player = new Player();
        this.controller = new Controller();
        this.ThirdCamera = new Camera();
        this.meshes = [];
        this.multiplayer = new Multiplayer();
        this.playerRenderer = null;
        this.worldStorage = null;
        this.worldId = null;
    }

    async init()
    {
        await this.renderer.init(document.getElementById("gpuCanvas"));

        const distance = 10;

        for (let i = -distance; i < distance; i++)
        {
            for (let j = -distance; j < distance; j++)
            {
                this.world.AddChunk(this.renderer, i, j).generateTerrain();
            }
        }

        this.worldId = new URLSearchParams(window.location.search).get('worldId') || 'default';
        const Token = localStorage.getItem('ls_token');
        this.worldStorage = new WorldStorage(this.worldId, Token);
        await this.worldStorage.loadArea(this.world, -distance, distance - 1, -distance, distance - 1);

        window.addEventListener('beforeunload', () =>
        {
            this.multiplayer.disconnect();
            if (this.worldStorage)
                this.worldStorage.flush();
        });
        this.player.camera.position = [0, 55, 0];
        this.player.camera.update(90, this.renderer.webgpu.canvas.width / this.renderer.webgpu.canvas.height);

        this.ThirdCamera.position = [-70, 100, -70];
        this.ThirdCamera.forward = [1, -0.5, 1];
        this.ThirdCamera.up = [0, 1, 0];
        this.ThirdCamera.update(90, this.renderer.webgpu.canvas.width / this.renderer.webgpu.canvas.height);

        this.playerRenderer = new PlayerRenderer(this.renderer);
        await this.playerRenderer.init();

        const WorldId = this.worldId;
        const Username = localStorage.getItem('ls_username') || 'guest';
        this.multiplayer.bindLocalPlayer(this.player);
        this.multiplayer.connect(WorldId, Username);

    }

    queueChunkSave(WorldX, WorldZ)
    {
        if (!this.worldStorage)
            return;

        const ChunkRef = this.world.getChunk(WorldX, WorldZ);
        if (ChunkRef)
            this.worldStorage.queueChunkSave(WorldX, WorldZ, ChunkRef);
    }

    queueChunkSaveAtBlock(x, y, z)
    {
        const ChunkX = Math.floor(x / Chunk.W);
        const ChunkZ = Math.floor(z / Chunk.D);
        this.queueChunkSave(ChunkX, ChunkZ);
    }

    start()
    {
        requestAnimationFrame(this.loop.bind(this));
    }

    update()
    {
        this.input.update();
        this.time.update();

        if (this.input.mouseButtonsClick[0])
        {
            const p = this.world.raycastVoxel(this.player.camera.position, this.player.camera.forward, 5);
            if (p != null)
            {
                this.world.removeBlock(p.target.x, p.target.y, p.target.z);
                this.queueChunkSaveAtBlock(p.target.x, p.target.y, p.target.z);
            }
        }
        if (this.input.mouseButtonsClick[2])
        {
            const p = this.world.raycastVoxel(this.player.camera.position, this.player.camera.forward, 5);
            if (p != null)
            {
                this.world.setBlock(p.previous.x, p.previous.y, p.previous.z, 1);
                this.queueChunkSaveAtBlock(p.previous.x, p.previous.y, p.previous.z);
            }
        }

        this.player.update(this.input, this.time);
        this.controller.update(this.player, this.world, this.time);

//        this.camera.PlayerCamera(this.time, this.input);
//        this.camera.update(this.camera.fov, this.renderer.webgpu.canvas.width / this.renderer.webgpu.canvas.height);

        this.world.update();

        this.multiplayer.sendLocalState(this.player);
        for (const Remote of this.multiplayer.remotePlayers.values())
        {
            Remote.update(this.time.delta);
        }

        const fpsElement = document.getElementById('fps');
        fpsElement.textContent = `FPS: ${this.time.fps}`;
        const Pos = document.getElementById('position');
        Pos.textContent = `Pos: ${Math.floor(this.player.camera.position[0])}, ${Math.floor(this.player.camera.position[1])}, ${Math.floor(this.player.camera.position[2])}`;

        const OnlineEl = document.getElementById('online');
        if (OnlineEl)
        {
            const PeerCount = this.multiplayer.getConnectedPeerCount();
            OnlineEl.textContent = `P2P: ${PeerCount} | В мире: ${PeerCount + 1}`;
        }
    }

    loop()
    {
        this.update();

        this.render();


        this.input.postUpdate();
        requestAnimationFrame(this.loop.bind(this));
    }

    render()
    {
        this.renderer.FrameStart(this.player.camera);//this.ThirdCamera);
        this.renderer.renderSky();
        this.renderer.renderWorld(this.world.chunks, this.player.camera);
        if (this.playerRenderer)
        {
            this.playerRenderer.render(
                this.multiplayer.remotePlayers,
                this.player.camera,
                this.renderer.commandEncoder,
                this.renderer.CurrentImage,
                this.renderer.depthView
            );
        }
        this.renderer.FrameEnd();
    }
}
