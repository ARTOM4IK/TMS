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
    this.enabled = false;
    this.lastSend = 0;
    this.colorIndex = 0;
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
      //this.remotePlayers.set(this.myId, new RemotePlayer(this.myId, this.username, this.pickColor()));      
      this.socket.emit('p2p_join', { room: this.roomId, name: this.username });
    });

    this.socket.on('p2p_peers', (Peers) =>
    {
      Peers.forEach(Peer => this.createPeer(Peer.id, Peer.name, true));
    });

    this.socket.on('p2p_new_peer', (Data) =>
    {
      this.createPeer(Data.id, Data.name, false);
      console.log('Multiplayer: New peer connected', Data.id, 'Name:', Data.name);
      console.log('Multiplayer: Total peers:', Object.keys(this.peers).length);
      
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

  createPeer(PeerId, PeerName, IsInitiator)
  {
    if (PeerId === this.myId || this.peers[PeerId])
    {
      console.warn('Multiplayer: Peer already exists or is self', PeerId);return;

    }

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
      Dc.onmessage = (Event) =>
      {
        try
        {
          const State = JSON.parse(Event.data);
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

  sendLocalState(Player)
  {
    if (!this.enabled) return;

    const Now = performance.now();
    if (Now - this.lastSend < SEND_INTERVAL_MS) return;
    this.lastSend = Now;

    const Packet = JSON.stringify({
      name: this.username,
      x: Player.camera.position[0],
      y: Player.camera.position[1],
      z: Player.camera.position[2],
      yaw: Player.camera.yaw,
      pitch: Player.camera.pitch
    });

    Object.values(this.peers).forEach(Peer =>
    {
      if (Peer.dc && Peer.dc.readyState === 'open')
      {
        Peer.dc.send(Packet);
      }
    });
  }

  getOnlineCount()
  {
    return this.remotePlayers.size + (this.enabled ? 1 : 1);
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
