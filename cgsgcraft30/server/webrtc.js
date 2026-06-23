const { Server } = require('socket.io');
const { GetUserFromToken, ProcessChatCommand } = require('./chatCommands');

let Io;

function InitSocketHandlers(IoInstance)
{
  Io = IoInstance;

  Io.on('connection', (Socket) =>
  {
    console.log('New connection:', Socket.id);

    Socket.on('p2p_join', (Data) =>
    {
      Socket.data.room = Data.room;
      Socket.data.name = (Data.name || 'guest').toLowerCase();
      Socket.join(Data.room);

      const RoomSet = Io.sockets.adapter.rooms.get(Data.room) || new Set();
      const Peers = [];
      RoomSet.forEach(Sid =>
      {
        if (Sid !== Socket.id)
          Peers.push({ id: Sid, name: Io.sockets.sockets.get(Sid)?.data.name });
      });

      Socket.emit('p2p_peers', Peers);
      Socket.to(Data.room).emit('p2p_new_peer', { id: Socket.id, name: Data.name });
    });

    Socket.on('p2p_signal', (Data) =>
    {
      Io.to(Data.to).emit('p2p_signal', { from: Socket.id, signal: Data.signal });
    });

    Socket.on('chat_message', (Data) =>
    {
      const Room = Data.room || Socket.data.room;
      if (!Room || !Data.text)
        return;

      Io.to(Room).emit('chat_broadcast', {
        type: 'chat',
        username: Data.username || Socket.data.name || 'guest',
        text: String(Data.text).slice(0, 256)
      });
    });

    Socket.on('chat_command', async (Data) =>
    {
      const Room = Data.room || Socket.data.room;
      const User = await GetUserFromToken(Data.token);
      const Result = await ProcessChatCommand(User, Data.command || '', Io, Room);

      Socket.emit('chat_broadcast', {
        type: 'command_result',
        ok: Result.ok,
        text: Result.text,
        teleport: Result.teleport || null
      });

      if (Result.ok && Data.command?.startsWith('ban'))
      {
        Io.to(Room).emit('chat_broadcast', {
          type: 'system',
          text: Result.text
        });
      }
    });

    Socket.on('chat_players_request', (Data) =>
    {
      const Room = Data.room || Socket.data.room;
      if (!Room)
        return;

      const RoomSet = Io.sockets.adapter.rooms.get(Room) || new Set();
      const Players = [];
      RoomSet.forEach(Sid =>
      {
        const Name = Io.sockets.sockets.get(Sid)?.data.name;
        if (Name)
          Players.push(Name);
      });

      Socket.emit('chat_players', { players: Players });
    });

    Socket.on('player_position', (Data) =>
    {
      Socket.data.position = Data.position;
    });

    Socket.on('disconnect', () =>
    {
      console.log('Disconnected:', Socket.id);
      if (Socket.data.room)
        Socket.to(Socket.data.room).emit('p2p_peer_left', Socket.id);
    });
  });
}

function StartWebRTCServer(HttpServer)
{
  const IoInstance = new Server(HttpServer,
  {
    cors:
    {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling']
  });

  InitSocketHandlers(IoInstance);
  global.io = IoInstance;
}

module.exports =
{
  StartWebRTCServer,
  get io() { return Io; }
};
