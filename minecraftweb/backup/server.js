/***************************************************************
 * Copyright (C) 2026
 *    Computer Graphics Support Group of 30 Phys-Math Lyceum
 ***************************************************************/

/* FILE NAME   : server.js
 * PURPOSE     : Minecraft Web.
 *               Main server file.
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

require('dotenv').config();
const Http = require('http');
const Express = require('express');
const Cors = require('cors');
const Path = require('path');
const { ConnectMongo, InitializeTestUsers, TestUsers } = require('./database');
const { StartWebRTCServer } = require('./webrtc');

const App = Express();
const HttpServer = Http.createServer(App);

//data to req.body
App.use(Cors());
App.use(Express.json());
App.use(Express.urlencoded({ extended: true }));

/*
 * Log incoming HTTP requests.
 * ARGUMENTS:
 *   - Express request:
 *       object Req;
 *   - Express response:
 *       object Res;
 *   - Next middleware:
 *       function Next;
 * RETURNS: None.
 */
function RequestLogger(Req, Res, Next)
{
  console.log(`${Req.method} ${Req.url}`);
  Next();
} /* End of 'RequestLogger' function */

App.use(RequestLogger);
App.use('/api', require('./routes/api'));
const TmsRoot = Path.join(__dirname, '..', 'TMS');

/*
 * Send HTML page for clean URL route.
 * ARGUMENTS:
 *   - HTML file name:
 *       string FileName;
 * RETURNS:
 *   (function) Express route handler.
 */
function ServePage(FileName)
{
  return (Req, Res) =>
  {
    Res.sendFile(Path.join(__dirname, 'public', FileName));
  };
} /* End of 'ServePage' function */

//connect pages
App.get('/', ServePage('index.html'));
App.get('/menu', ServePage('menu.html'));
App.get('/create-world', ServePage('create-world.html'));
App.get('/world', (Req, Res) =>
{
  Res.sendFile(Path.join(TmsRoot, 'index.html'));
});
App.get('/register', ServePage('register.html'));
App.get('/forgot', ServePage('forgot.html'));

//connect other additional files
App.use(Express.static(Path.join(__dirname, 'public')));
App.use(Express.static(TmsRoot));

/*
 * Main server initialization.
 * ARGUMENTS: None.
 * RETURNS: None.
 */
async function StartServer()
{
  try
  {
    await ConnectMongo();
    await InitializeTestUsers(TestUsers);
    StartWebRTCServer(HttpServer);

    const Port = process.env.PORT || 3000;
    HttpServer.listen(Port, () =>
    {
      console.log(`Minecraft Web Server running on http://localhost:${Port}`);
    });
  }
  catch (error)
  {
    console.error('Server startup error:', error.message);
    process.exit(1);
  }
} /* End of 'StartServer' function */

StartServer();

/* END OF 'server.js' FILE */
