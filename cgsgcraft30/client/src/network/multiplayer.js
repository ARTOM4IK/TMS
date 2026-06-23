import { RemotePlayer } from '../entity/remotePlayer.js';

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const SEND_INTERVAL_MS = 50;

const COLORS = [
  [0.89, 0.29, 0.29, 1],
  [0.89, 0.64, 0.29, 1],
  [0.64, 0.89, 0.29, 1],
  [0.29, 0.89, 0.64, 1],
  [0.29, 0.64, 0.89, 1],
  [0.64, 0.29, 0.89, 1],
  [0.89, 0.29, 0.71, 1],
  [0.89, 0.89, 0.29, 1]
];

export class Multiplayer
{
  constructor()
  {
    this.remotePlayers = new Map();
    this.peers = {};
    this.pending = {};
    this.iceBuf = {};
    this.myId = null;
    this.socket = null;
    this.roomId = null;
    this.username = 'guest';
    this.roomPlayers = [];
    this.enabled = false;
    this.lastSend = 0;
    this.colorIndex = 0;
    this.localPlayer = null;
    this.onBlockChange = null;
    this.onChatEvent = null;
    this.onLaser = null;
    this.blockSeq = 0;
    this.seenBlockKeys = new Set();
  }

  bindChatHandler(Handler)
  {
    this.onChatEvent = Handler;
  }

  bindBlockHandler(Handler)
  {
    this.onBlockChange = Handler;
  }

  bindLaserHandler(Handler)
  {
    this.onLaser = Handler;
  }

  bindLocalPlayer(Player)
  {
    this.localPlayer = Player;
  }

  connect(WorldId, Username)
  {
    this.roomId = WorldId || 'default';
    this.username = Username || 'guest';

    if (typeof io === 'undefined')
    {
      console.warn('Multiplayer: socket.io не загружен, игра в одиночном режиме');
      return;
    }

    this.socket = io({ reconnection: true });
    this.enabled = true;

    this.socket.on('connect', () =>
    {
      this.myId = this.socket.id;
      this.socket.emit('p2p_join', { room: this.roomId, name: this.username });
    });

    this.socket.on('p2p_peers', (Peers) =>
    {
      Peers.forEach(Peer => this.createPeer(Peer.id, Peer.name));
    });

    this.socket.on('p2p_new_peer', (Data) =>
    {
      this.createPeer(Data.id, Data.name);
    });

    this.socket.on('p2p_signal', (Data) =>
    {
      if (!this.peers[Data.from] || !this.peers[Data.from].pc)
      {
        if (!this.pending[Data.from]) this.pending[Data.from] = [];
        this.pending[Data.from].push(Data.signal);
        return;
      }
      this.applySignal(Data.from, Data.signal);
    });

    this.socket.on('p2p_peer_left', (Id) =>
    {
      this.removePeer(Id);
    });

    this.socket.on('chat_broadcast', (Data) =>
    {
      if (this.onChatEvent)
        this.onChatEvent(Data);
    });

    this.socket.on('chat_players', (Data) =>
    {
      this.roomPlayers = Data.players || [];
    });
  }

  pickColor()
  {
    const Color = COLORS[this.colorIndex % COLORS.length];
    this.colorIndex++;
    return Color;
  }

  ensureRemotePlayer(PeerId, Name)
  {
    if (!this.remotePlayers.has(PeerId))
    {
      this.remotePlayers.set(PeerId, new RemotePlayer(PeerId, Name || 'player', this.pickColor()));
    }
    return this.remotePlayers.get(PeerId);
  }

  createPeer(PeerId, PeerName)
  {
    if (!this.myId || PeerId === this.myId || this.peers[PeerId])
      return;

    this.ensureRemotePlayer(PeerId, PeerName);

    const IsInitiator = this.myId < PeerId;
    const Pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers[PeerId] = { pc: Pc, dc: null, name: PeerName };

    Pc.onicecandidate = (Event) =>
    {
      if (Event.candidate)
      {
        this.socket.emit('p2p_signal', {
          to: PeerId,
          signal: { candidate: Event.candidate }
        });
      }
    };

    Pc.onconnectionstatechange = () =>
    {
      if (Pc.connectionState === 'failed' || Pc.connectionState === 'closed')
      {
        this.removePeer(PeerId);
      }
    };

    const SetupChannel = (Dc) =>
    {
      this.peers[PeerId].dc = Dc;
      Dc.onopen = () =>
      {
        this.lastSend = 0;
        if (this.localPlayer)
          this.sendLocalState(this.localPlayer, true);
      };
      Dc.onmessage = (Event) =>
      {
        try
        {
          const State = JSON.parse(Event.data);

          if (State.type === 'block')
          {
            const Key = `${PeerId}:${State.seq}`;
            if (this.seenBlockKeys.has(Key))
              return;

            this.seenBlockKeys.add(Key);
            if (this.seenBlockKeys.size > 4096)
              this.seenBlockKeys.clear();

            if (this.onBlockChange)
              this.onBlockChange(State.x, State.y, State.z, State.blockId);
            return;
          }

          if (State.type === 'laser')
          {
            if (this.onLaser)
              this.onLaser(State);
            return;
          }

          const Remote = this.ensureRemotePlayer(PeerId, State.name || PeerName);
          Remote.applyState(State);
        }
        catch (Error)
        {
          console.warn('Bad multiplayer packet', Error);
        }
      };
      Dc.onclose = () => this.removePeer(PeerId);
    };

    if (IsInitiator)
    {
      const Dc = Pc.createDataChannel('game');
      SetupChannel(Dc);
      Pc.createOffer()
        .then(Offer => Pc.setLocalDescription(Offer))
        .then(() =>
        {
          this.socket.emit('p2p_signal', {
            to: PeerId,
            signal: { type: 'offer', sdp: Pc.localDescription.sdp }
          });
        });
    }
    else
    {
      Pc.ondatachannel = (Event) => SetupChannel(Event.channel);
    }

    if (this.pending[PeerId])
    {
      this.pending[PeerId].forEach(Signal => this.applySignal(PeerId, Signal));
      delete this.pending[PeerId];
    }
  }

  async applySignal(PeerId, Signal)
  {
    const Peer = this.peers[PeerId];
    if (!Peer || !Peer.pc) return;

    const Pc = Peer.pc;

    if (Signal.candidate)
    {
      if (Pc.remoteDescription)
      {
        await Pc.addIceCandidate(new RTCIceCandidate(Signal.candidate)).catch(() => {});
      }
      else
      {
        if (!this.iceBuf[PeerId]) this.iceBuf[PeerId] = [];
        this.iceBuf[PeerId].push(Signal.candidate);
      }
      return;
    }

    if (Signal.type === 'offer')
    {
      await Pc.setRemoteDescription({ type: 'offer', sdp: Signal.sdp });
      for (const Candidate of (this.iceBuf[PeerId] || []))
      {
        await Pc.addIceCandidate(new RTCIceCandidate(Candidate)).catch(() => {});
      }
      delete this.iceBuf[PeerId];
      const Answer = await Pc.createAnswer();
      await Pc.setLocalDescription(Answer);
      this.socket.emit('p2p_signal', {
        to: PeerId,
        signal: { type: 'answer', sdp: Pc.localDescription.sdp }
      });
    }

    if (Signal.type === 'answer')
    {
      await Pc.setRemoteDescription({ type: 'answer', sdp: Signal.sdp }).catch(() => {});
      for (const Candidate of (this.iceBuf[PeerId] || []))
      {
        await Pc.addIceCandidate(new RTCIceCandidate(Candidate)).catch(() => {});
      }
      delete this.iceBuf[PeerId];
    }
  }

  removePeer(PeerId)
  {
    if (this.peers[PeerId])
    {
      try { this.peers[PeerId].pc.close(); } catch (Error) {}
      delete this.peers[PeerId];
    }
    this.remotePlayers.delete(PeerId);
    delete this.pending[PeerId];
    delete this.iceBuf[PeerId];
  }

  sendLocalState(Player, ForceSend = false)
  {
    if (!this.enabled) return;

    const Now = performance.now();
    if (!ForceSend && Now - this.lastSend < SEND_INTERVAL_MS) return;
    this.lastSend = Now;

    const Packet = JSON.stringify({
      type: 'player',
      name: this.username,
      x: Player.camera.position[0],
      y: Player.camera.position[1],
      z: Player.camera.position[2],
      yaw: Player.camera.yaw,
      pitch: Player.camera.pitch
    });

    this.broadcast(Packet);
  }

  sendBlockChange(x, y, z, blockId)
  {
    if (!this.enabled)
      return;

    const Packet = JSON.stringify({
      type: 'block',
      x,
      y,
      z,
      blockId,
      seq: ++this.blockSeq,
      time: Date.now()
    });

    this.broadcast(Packet);
  }

  sendLaser(Origin, Direction, Length = 80)
  {
    if (!this.enabled)
      return;

    const Packet = JSON.stringify({
      type: 'laser',
      ox: Origin[0],
      oy: Origin[1],
      oz: Origin[2],
      dx: Direction[0],
      dy: Direction[1],
      dz: Direction[2],
      length: Length,
      time: Date.now()
    });

    this.broadcast(Packet);
  }

  sendChatMessage(Text)
  {
    if (!this.enabled || !this.socket)
      return;

    this.socket.emit('chat_message', {
      room: this.roomId,
      text: Text,
      username: this.username
    });
  }

  sendChatCommand(Command, Token)
  {
    if (!this.enabled || !this.socket)
      return;

    this.socket.emit('chat_command', {
      room: this.roomId,
      command: Command,
      token: Token
    });
  }

  requestPlayerList()
  {
    if (!this.enabled || !this.socket)
      return;

    this.socket.emit('chat_players_request', { room: this.roomId });
  }

  getRoomPlayerNames()
  {
    const Names = new Set([this.username]);
    for (const Remote of this.remotePlayers.values())
      Names.add(Remote.name);
    for (const Name of this.roomPlayers)
      Names.add(Name);
    return Array.from(Names).sort();
  }

  broadcast(Packet)
  {
    Object.values(this.peers).forEach(Peer =>
    {
      if (Peer.dc && Peer.dc.readyState === 'open')
        Peer.dc.send(Packet);
    });
  }

  getOnlineCount()
  {
    return this.remotePlayers.size + 1;
  }

  getConnectedPeerCount()
  {
    return Object.values(this.peers).filter(Peer => Peer.dc && Peer.dc.readyState === 'open').length;
  }

  disconnect()
  {
    Object.keys(this.peers).forEach(Id => this.removePeer(Id));
    if (this.socket)
    {
      this.socket.disconnect();
      this.socket = null;
    }
    this.enabled = false;
  }
}
