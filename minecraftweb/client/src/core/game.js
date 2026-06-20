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
        this.worldSeed = '0';
    }

    resolveWorldSeed(WorldMeta)
    {
        if (WorldMeta && WorldMeta.seed)
            return String(WorldMeta.seed);

        try
        {
            const SavedWorld = JSON.parse(localStorage.getItem('ls_currentWorld') || 'null');
            if (SavedWorld && SavedWorld.id === this.worldId && SavedWorld.seed)
                return String(SavedWorld.seed);
        }
        catch (Error) {}

        return '0';
    }

    async init()
    {
        await this.renderer.init(document.getElementById("gpuCanvas"));

        this.worldId = new URLSearchParams(window.location.search).get('worldId') || 'default';
        const Token = localStorage.getItem('ls_token');
        this.worldStorage = new WorldStorage(this.worldId, Token);

        const WorldMeta = await this.worldStorage.fetchWorldMeta();
        this.worldSeed = this.resolveWorldSeed(WorldMeta);

        const distance = 10;

        for (let i = -distance; i < distance; i++)
        {
            for (let j = -distance; j < distance; j++)
            {
                this.world.AddChunk(this.renderer, i, j).generateTerrain(this.worldSeed);
            }
        }

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

        const Username = localStorage.getItem('ls_username') || 'guest';
        this.multiplayer.bindLocalPlayer(this.player);
        this.multiplayer.bindBlockHandler((x, y, z, blockId) =>
        {
            this.applyRemoteBlock(x, y, z, blockId);
        });
        this.multiplayer.connect(this.worldId, Username);
    }

    applyRemoteBlock(x, y, z, blockId)
    {
        this.world.applyRemoteBlock(x, y, z, blockId);
        this.queueChunkSaveAtBlock(x, y, z);
    }

    applyLocalBlockChange(x, y, z, blockId)
    {
        if (blockId === 0)
            this.world.removeBlock(x, y, z);
        else
            this.world.setBlock(x, y, z, blockId);

        this.multiplayer.sendBlockChange(x, y, z, blockId);
        this.queueChunkSaveAtBlock(x, y, z);
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
                this.applyLocalBlockChange(p.target.x, p.target.y, p.target.z, 0);
        }
        if (this.input.mouseButtonsClick[2])
        {
            const p = this.world.raycastVoxel(this.player.camera.position, this.player.camera.forward, 5);
            if (p != null)
                this.applyLocalBlockChange(p.previous.x, p.previous.y, p.previous.z, 1);
        }

        this.player.update(this.input, this.time);
        this.controller.update(this.player, this.world, this.time);

        this.world.update();

        this.multiplayer.sendLocalState(this.player);
        for (const Remote of this.multiplayer.remotePlayers.values())
            Remote.update(this.time.delta);

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
        this.renderer.FrameStart(this.player.camera);
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
