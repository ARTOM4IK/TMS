import { Renderer } from '../renderer/renderer.js';
import { Input } from './input.js';
import { Time } from './time.js';
import { World, resolveWorldSeed, getViewBounds } from '../world/world.js';
import { Player } from '../entity/player.js';
import { Controller } from '../physics/controller.js';
import { Camera } from '../renderer/camera.js';
import { Multiplayer } from '../network/multiplayer.js';
import { EntityRenderer } from '../renderer/entityRenderer.js';
import { WorldStorage, WORLD_CONFIG } from '../network/worldStorage.js';
import { loadBlockRegistry } from '../world/blocks.js';
import { canBreakBlock, canCollectBlock, canPlaceBlock } from '../world/blockInteraction.js';
import { EntityManager } from '../entity/EntityManager.js';
import { InventoryUI } from '../ui/inventoryUI.js';
import { ChatConsole } from '../ui/chatConsole.js';
import { PlayerListUI } from '../ui/playerListUI.js';
import { vec3 } from '../../node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js';

function setLoading(Visible, Text = 'Загрузка мира...', Percent = 0)
{
  const Overlay = document.getElementById('loadingOverlay');
  const Label = document.getElementById('loadingText');
  const Bar = document.getElementById('loadingBar');

  if (!Overlay)
    return;

  Overlay.classList.toggle('hidden', !Visible);
  if (Label)
    Label.textContent = Text;
  if (Bar)
    Bar.style.width = `${Math.min(100, Math.max(0, Percent))}%`;
}

export class Game
{
  constructor()
  {
    this.renderer = new Renderer();
    this.world = new World(this.renderer);
    this.ThirdCamera = new Camera();
    this.multiplayer = new Multiplayer();
    this.time = new Time();
    this.input = new Input(document.getElementById('gpuCanvas'));
    this.controller = new Controller();
    this.player = new Player();
    this.entityRenderer = null;
    this.entityManager = new EntityManager(this.world);
    this.worldStorage = null;
    this.worldId = null;
    this.lastPlayerSave = 0;
    this.token = null;
    this.inventoryUI = null;
    this.chatConsole = null;
    this.playerListUI = null;
    this.chatOpen = false;
  }

  async init()
  {
    setLoading(true, 'Инициализация GPU...', 5);

    await this.renderer.init(document.getElementById('gpuCanvas'));
    await loadBlockRegistry(this.renderer);

    setLoading(true, 'Загрузка данных мира...', 20);

    this.worldId = new URLSearchParams(window.location.search).get('worldId') || 'default';
    this.token = localStorage.getItem('ls_token');
    this.worldStorage = new WorldStorage(this.worldId, this.token);
    this.world.bindStorage(this.worldStorage);

    const [WorldMeta, UserProfile, SavedPlayerState] = await Promise.all([
      this.worldStorage.fetchWorldMeta(),
      this.worldStorage.fetchUserProfile(),
      this.worldStorage.fetchPlayerState()
    ]);

    this.world.setSeed(resolveWorldSeed(WorldMeta, this.worldId));
    this.world.setWorldType(WorldMeta?.worldType || 'default');

    this.world.onChunkGenerated = (ChunkX, ChunkZ) =>
    {
      this.entityManager.onChunkGenerated(ChunkX, ChunkZ, this.world.seed);
    };

    if (UserProfile?.role)
      this.player.setRole(UserProfile.role);

    if (SavedPlayerState)
      this.player.applyState(SavedPlayerState);

    this.player.camera.update(90, this.renderer.webgpu.canvas.width / this.renderer.webgpu.canvas.height);

    setLoading(true, 'Генерация местности...', 40);

    const Pos = this.player.camera.position;
    const Radius = WORLD_CONFIG.INITIAL_CHUNK_RADIUS;
    const CenterX = Math.floor(Pos[0] / WORLD_CONFIG.CHUNK_W);
    const CenterZ = Math.floor(Pos[2] / WORLD_CONFIG.CHUNK_D);

    this.world.generateArea(
      CenterX - Radius,
      CenterX + Radius,
      CenterZ - Radius,
      CenterZ + Radius
    );

    setLoading(true, 'Синхронизация изменений...', 55);

    const Bounds = getViewBounds(WORLD_CONFIG.VIEW_DISTANCE, Pos);
    this.world.generateArea(Bounds.minX, Bounds.maxX, Bounds.minZ, Bounds.maxZ);
    await this.world.loadModifiedChunksFromStorage(Bounds.minX, Bounds.maxX, Bounds.minZ, Bounds.maxZ);

    setLoading(true, 'Финализация...', 90);

    this.inventoryUI = new InventoryUI(this.player);
    this.chatConsole = new ChatConsole(this.multiplayer, this.token);
    this.playerListUI = new PlayerListUI();

    window.addEventListener('beforeunload', () =>
    {
      this.multiplayer.disconnect();
      this.worldStorage.savePlayerState(this.player.exportState());
      this.worldStorage.flush(this.world);
    });

    this.entityRenderer = new EntityRenderer(this.renderer);
    await this.entityRenderer.init();

    const Username = localStorage.getItem('ls_username') || 'guest';
    this.multiplayer.bindLocalPlayer(this.player);
    this.multiplayer.bindBlockHandler((x, y, z, blockId) =>
    {
      this.world.applyRemoteBlockChange(x, y, z, blockId);
    });
    this.multiplayer.bindLaserHandler((Data) =>
    {
      this.entityManager.addLaser(
        [Data.ox, Data.oy, Data.oz],
        [Data.dx, Data.dy, Data.dz],
        Data.length || 80
      );
    });
    this.multiplayer.bindChatHandler((Data) => this.onChatEvent(Data));
    this.multiplayer.connect(this.worldId, Username);

    setLoading(false, '', 100);
  }

  onChatEvent(Data)
  {
    if (Data.type === 'command_result' && Data.teleport)
    {
      vec3.set(Data.teleport[0], Data.teleport[1], Data.teleport[2], this.player.camera.position);
    }

    if (this.chatConsole)
      this.chatConsole.onMessage(Data);
  }

  handleUiInput()
  {
    if (this.chatConsole)
      this.chatOpen = this.chatConsole.open;

    const UiActive = this.chatOpen || this.player.inventory.isOpen;
    this.input.uiCapture = UiActive;

    if (this.input.keysClick['e'])
    {
      this.inventoryUI.toggle();
      this.input.keysClick['e'] = false;
    }

    if (this.input.keysClick['`'] || this.input.keysClick['ё'])
    {
      this.chatConsole.toggle();
      this.input.keysClick['`'] = false;
      this.input.keysClick['ё'] = false;
    }

    if (this.input.keys['tab'])
    {
      if (!this.input.tabHeld)
      {
        this.multiplayer.requestPlayerList();
        this.playerListUI.show(this.multiplayer.getRoomPlayerNames());
        this.input.tabHeld = true;
      }
    }
    else
    {
      if (this.input.tabHeld)
        this.playerListUI.hide();
      this.input.tabHeld = false;
    }

    if (!UiActive)
    {
      for (let I = 1; I <= 9; I++)
      {
        if (this.input.keysClick[String(I)])
          this.player.inventory.selectSlot(I - 1);
      }

      if (this.input.wheelDelta > 0)
        this.player.inventory.selectNext();
      else if (this.input.wheelDelta < 0)
        this.player.inventory.selectPrev();
    }
  }

  handleBlockInteraction()
  {
    if (this.input.uiCapture || this.chatOpen || this.player.inventory.isOpen)
      return;

    const Reach = 5;

    if (this.input.mouseButtonsClick[0])
    {
      const Hit = this.world.raycastVoxel(this.player.camera.position, this.player.camera.forward, Reach);
      if (Hit == null)
        return;

      const BlockId = this.world.getBlock(Hit.target.x, Hit.target.y, Hit.target.z);
      if (!canBreakBlock(BlockId))
        return;

      const Changed = this.world.applyLocalBlockChange(
        Hit.target.x,
        Hit.target.y,
        Hit.target.z,
        globalThis.Blocks.AIR,
        (x, y, z, id) => this.multiplayer.sendBlockChange(x, y, z, id)
      );

      if (Changed && canCollectBlock(BlockId))
        this.player.inventory.addBlock(BlockId, 1);
    }

    if (this.input.mouseButtonsClick[2])
    {
      const PlaceId = this.player.inventory.getSelectedBlockId();
      if (PlaceId === globalThis.Blocks.AIR)
        return;

      const Hit = this.world.raycastVoxel(this.player.camera.position, this.player.camera.forward, Reach);
      if (Hit == null)
        return;

      const Px = Hit.previous.x;
      const Py = Hit.previous.y;
      const Pz = Hit.previous.z;

      if (this.player.blockOverlapsPlayer(Px, Py, Pz))
        return;

      if (!canPlaceBlock(this.world, Px, Py, Pz, PlaceId))
        return;

      const Changed = this.world.applyLocalBlockChange(
        Px, Py, Pz,
        PlaceId,
        (x, y, z, id) => this.multiplayer.sendBlockChange(x, y, z, id)
      );

      if (Changed)
        this.player.inventory.consumeSelected(1);
    }
  }

  handleHomelanderLaser()
  {
    if (!this.player.isHomelander() || this.input.uiCapture)
      return;

    if (this.input.keysClick['f'] && this.player.laserCooldown <= 0)
    {
      const Fwd = this.player.camera.forward;
      const Pos = this.player.camera.position;
      const Origin = [
        Pos[0] + Fwd[0] * 0.35,
        Pos[1] + Fwd[1] * 0.35,
        Pos[2] + Fwd[2] * 0.35
      ];
      const Dir = [...Fwd];
      const Length = 80;

      this.entityManager.addLaser(Origin, Dir, Length);
      this.multiplayer.sendLaser(Origin, Dir, Length);
      this.entityManager.damageMobsAlongRay(Origin, Dir);
      this.player.laserCooldown = 0.5;
      this.input.keysClick['f'] = false;
    }
  }

  async update()
  {
    this.input.update();
    this.time.update();

    this.handleUiInput();

    if (!this.input.uiCapture)
    {
      this.handleBlockInteraction();
      this.handleHomelanderLaser();
    }

    this.player.update(this.input, this.time);
    this.controller.update(this.player, this.world, this.time);

    await this.world.update(this.player);

    this.entityManager.update(this.player, this.time.delta);
    this.entityManager.unloadFarFrom(this.player);

    if (this.multiplayer.socket?.connected)
    {
      this.multiplayer.socket.emit('player_position', {
        room: this.worldId,
        position: [
          this.player.camera.position[0],
          this.player.camera.position[1],
          this.player.camera.position[2]
        ]
      });
    }

    this.multiplayer.sendLocalState(this.player);
    for (const Remote of this.multiplayer.remotePlayers.values())
      Remote.update(this.time.delta);

    this.savePlayerStateIfNeeded();
    if (this.inventoryUI)
      this.inventoryUI.update();

    document.getElementById('fps').textContent = `FPS: ${this.time.fps}`;
    document.getElementById('position').textContent =
      `Pos: ${Math.floor(this.player.camera.position[0])}, ${Math.floor(this.player.camera.position[1])}, ${Math.floor(this.player.camera.position[2])}`;

    const RoleEl = document.getElementById('role');
    if (RoleEl)
      RoleEl.textContent = this.player.isHomelander() ? 'HOMELANDER' : 'Игрок';

    const OnlineEl = document.getElementById('online');
    if (OnlineEl)
    {
      const PeerCount = this.multiplayer.getConnectedPeerCount();
      OnlineEl.textContent = `P2P: ${PeerCount} | В мире: ${PeerCount + 1}`;
    }
  }

  savePlayerStateIfNeeded()
  {
    if (!this.worldStorage)
      return;

    const Now = performance.now();
    if (Now - this.lastPlayerSave < WORLD_CONFIG.PLAYER_SAVE_INTERVAL_MS)
      return;

    this.lastPlayerSave = Now;
    this.worldStorage.savePlayerState(this.player.exportState());
  }

  async loop()
  {
    await this.update();
    this.render();
    this.input.postUpdate();
    requestAnimationFrame(this.loop.bind(this));
  }

  start()
  {
    requestAnimationFrame(this.loop.bind(this));
  }

  render()
  {
    this.renderer.FrameStart(this.player.camera);
    this.renderer.renderSky();
    this.renderer.renderWorld(this.world.chunks, this.player.camera);

    if (this.entityRenderer)
    {
      this.entityRenderer.render(
        this.multiplayer.remotePlayers,
        this.entityManager,
        this.player.camera,
        this.renderer.commandEncoder,
        this.renderer.CurrentImage,
        this.renderer.depthView
      );
    }

    this.renderer.FrameEnd();
  }
}
