/***************************************************************
 * Copyright (C) 2026
 *    Computer Graphics Support Group of 30 Phys-Math Lyceum
 ***************************************************************/

/* FILE NAME   : webrtc.js
 * PURPOSE     : Minecraft Web.
 *               WebRTC signaling server.
 * PROGRAMMER  : CGSG'Sr'2025.
 *               Kochugueva Maria (MK3),
 *               Arsentev Artemy (AA4),
 *               Nechaev Vladimir (VN4).
 * LAST UPDATE : 05.06.2026
 * NOTE        : None.
 *
 * No part of this file may be changed without agreement of
 * Computer Graphics Support Group of 30 Phys-Math Lyceum
 */

const { Server } = require('socket.io');
let Io;

/*
 * Initialize Socket.IO event handlers.
 * ARGUMENTS:
 *   - Socket.IO server instance:
 *       object IoInstance;
 * RETURNS: None.
 */
function InitSocketHandlers(IoInstance)
{
  Io = IoInstance;
  Io.on('connection', (Socket) =>
  {
    console.log('New connection:', Socket.id);

    //join event
    Socket.on('p2p_join', (Data) => 
    {
      Socket.data.room = Data.room;
      Socket.data.name = Data.name;
      Socket.join(Data.room);

      const RoomSet = Io.sockets.adapter.rooms.get(Data.room) || new Set();
      const Peers = [];
      RoomSet.forEach(Sid => 
      {
        if (Sid !== Socket.id)
          Peers.push({ id: Sid, name: Io.sockets.sockets.get(Sid)?.data.name });
      });

      //exchange data with new user and old users
      Socket.emit('p2p_peers', Peers);
      Socket.to(Data.room).emit('p2p_new_peer', { id: Socket.id, name: Data.name });
    });

    //routing data from peer to peer
    Socket.on('p2p_signal', (Data) => 
    {
      Io.to(Data.to).emit('p2p_signal', { from: Socket.id, signal: Data.signal });
    });

    //disconnecting event
    Socket.on('disconnect', () => 
    {
      console.log('Disconnected:', Socket.id);
      if (Socket.data.room)
      {
        Socket.to(Socket.data.room).emit('p2p_peer_left', Socket.id);
      }
    });
  });
} /* End of 'InitSocketHandlers' function */

/*
 * Attach WebRTC signaling server to HTTP server.
 * ARGUMENTS:
 *   - HTTP server instance:
 *       object HttpServer;
 * RETURNS: None.
 */
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
} /* End of 'StartWebRTCServer' function */

module.exports = 
{
  StartWebRTCServer,
  get io() { return Io; }
};

/* END OF 'webrtc.js' FILE */
