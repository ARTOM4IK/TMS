const Express = require('express');
const Jwt = require('jsonwebtoken');
const Bcrypt = require('bcryptjs');
const Nodemailer = require('nodemailer');
const
{
  HashPassword,
  VerifyPassword,
  GenerateToken,
  ValidateRegistration,
  ValidateLogin,
  FindUserByUsername,
  FindUserByEmail,
  InsertUser,
  UpdateLastLogin,
  FindUserById,
  GetAllUsers,
  JwtSecret
} = require('../auth');
const
{
  SetBanned,
  WriteLog,
  ReadLogs,
  IsUserAdmin,
  UpdateUserPassword,
  SaveResetCode,
  FindResetCode,
  DeleteResetCode,
  FindAllWorlds,
  FindWorldById,
  InsertWorld,
  UpdateWorld,
  DeleteWorld,
  DeleteAllWorlds,
  FindChunksInArea,
  FindChunk,
  SaveChunk,
  GetPlayerStateInWorld,
  SavePlayerStateInWorld
} = require('../storage');
const { CHUNK_FORMAT } = require('../chunkCodec');
const { ResolveRole } = require('../chatCommands');

const Router = Express.Router();
const JwtSecretFallback = JwtSecret || process.env.SESSION_SECRET || 'webminecraft_secret_key_2024';

function GetBearerToken(Req)
{
  const AuthHeader = Req.headers.authorization;
  return AuthHeader && AuthHeader.split(' ')[1];
}

async function GetUserFromToken(Token)
{
  const Decoded = Jwt.verify(Token, JwtSecretFallback);
  return FindUserById(Decoded.id);
}

function GetOnlinePlayerCount(WorldId)
{
  if (!global.io)
    return 0;
  const Room = global.io.sockets.adapter.rooms.get(WorldId);
  return Room ? Room.size : 0;
}

async function RequireAuth(Req, Res, Next)
{
  const Token = GetBearerToken(Req);
  if (!Token)
    return Res.status(401).json({ error: 'Token required' });

  try
  {
    const User = await GetUserFromToken(Token);
    if (!User)
      return Res.status(404).json({ error: 'User not found' });
    Req.user = User;
    Next();
  }
  catch (Error)
  {
    Res.status(401).json({ error: 'Invalid token' });
  }
}

function RequireAdmin(Req, Res, Next)
{
  if (!IsUserAdmin(Req.user))
    return Res.status(403).json({ error: 'Access denied. Admin only.' });
  Next();
}

Router.post('/register', async (Req, Res) =>
{
  const { username, email, password } = Req.body;
  const Errors = ValidateRegistration(username, email, password);
  if (Errors.length > 0)
    return Res.status(400).json({ errors: Errors });

  try
  {
    const Login = username.toLowerCase();
    if (await FindUserByUsername(Login))
      return Res.status(400).json({ error: 'Username already taken' });

    if (await FindUserByEmail(email.toLowerCase()))
      return Res.status(400).json({ error: 'Email already registered' });

    const Hashed = await HashPassword(password);
    const User = await InsertUser(
      Login,
      email.toLowerCase(),
      Hashed,
      `webrtc-${Login}-${Date.now().toString(36)}`
    );
    await WriteLog(Login, 'зарегистрировался');

    const Token = GenerateToken({ _id: User.id, username: User.username });
    Res.status(201).json({
      message: 'User registered successfully',
      token: Token,
      user: {
        id: User.id,
        username: User.username,
        webrtcId: User.webrtc_id,
        IsAdmin: IsUserAdmin(User),
        role: ResolveRole(User)
      }
    });
  }
  catch (Error)
  {
    console.error('Registration error:', Error);
    Res.status(500).json({ error: 'Registration failed' });
  }
});

Router.post('/login', async (Req, Res) =>
{
  const { username, password } = Req.body;
  const Errors = ValidateLogin(username, password);

  if (Errors.length > 0)
    return Res.status(400).json({ errors: Errors });

  try
  {
    const User = await FindUserByUsername(username.toLowerCase());
    if (!User)
      return Res.status(401).json({ error: 'Invalid username or password' });

    if (User.banned)
      return Res.status(403).json({ error: 'Вы заблокированы' });

    if (!(await VerifyPassword(password, User.password)))
      return Res.status(401).json({ error: 'Invalid username or password' });

    await UpdateLastLogin(User.id);
    await WriteLog(User.username, 'вошёл в аккаунт');

    const Token = GenerateToken({ _id: User.id, username: User.username });
    Res.json({
      message: 'Login successful',
      token: Token,
      user:
      {
        id: User.id,
        username: User.username,
        webrtcId: User.webrtc_id,
        lastLogin: User.last_login,
        IsAdmin: IsUserAdmin(User),
        role: ResolveRole(User)
      }
    });
  }
  catch (Error)
  {
    console.error('Login error:', Error);
    Res.status(500).json({ error: 'Login failed' });
  }
});

Router.get('/users', async (Req, Res) =>
{
  try
  {
    Res.json({ users: await GetAllUsers() });
  }
  catch (Error)
  {
    Res.status(500).json({ error: 'Failed to fetch users' });
  }
});

Router.get('/user/:id', async (Req, Res) =>
{
  try
  {
    const User = await FindUserById(Req.params.id);
    if (!User) return Res.status(404).json({ error: 'User not found' });
    Res.json({ user: User });
  }
  catch (Error)
  {
    Res.status(500).json({ error: 'Failed to fetch user' });
  }
});

Router.get('/verify-token', async (Req, Res) =>
{
  const Token = GetBearerToken(Req);
  if (!Token) return Res.status(401).json({ valid: false, error: 'Token required' });

  try
  {
    const User = await FindUserById(Jwt.verify(Token, JwtSecretFallback).id);
    if (!User) return Res.status(404).json({ valid: false, error: 'User not found' });
    if (User.banned)
      return Res.status(403).json({ valid: true, banned: true, message: 'User is banned' });

    Res.json({
      valid: true,
      user: { id: User.id, username: User.username, IsAdmin: IsUserAdmin(User), role: ResolveRole(User) }
    });
  }
  catch (Error)
  {
    console.error('Token verify error:', Error);
    Res.json({ valid: false, error: 'Invalid token' });
  }
});

Router.get('/logs', RequireAuth, RequireAdmin, async (Req, Res) =>
{
  Res.json({ logs: await ReadLogs() });
});

Router.post('/ban', RequireAuth, RequireAdmin, async (Req, Res) =>
{
  const { username } = Req.body;
  if (!username) return Res.status(400).json({ error: 'Username required' });

  const Target = await FindUserByUsername(username);
  if (Target && IsUserAdmin(Target))
    return Res.status(400).json({ error: 'Cannot ban admin' });

  if (!(await SetBanned(username, true)))
    return Res.status(404).json({ error: 'User not found' });

  await WriteLog(Req.user.username, `забанил пользователя ${username}`);
  Res.json({ message: `${username} заблокирован` });
});

Router.post('/unban', RequireAuth, RequireAdmin, async (Req, Res) =>
{
  const { username } = Req.body;
  if (!username)
    return Res.status(400).json({ error: 'Username required' });

  if (!(await SetBanned(username, false)))
    return Res.status(404).json({ error: 'User not found' });

  await WriteLog(Req.user.username, `разбанил пользователя ${username}`);
  Res.json({ message: `${username} разблокирован` });
});

Router.get('/worlds', RequireAuth, async (Req, Res) =>
{
  try
  {
    const Worlds = (await FindAllWorlds()).map(World => ({
      ...World,
      onlineCount: GetOnlinePlayerCount(World.id)
    }));
    Res.json({ worlds: Worlds });
  }
  catch (Error)
  {
    console.error('Error fetching worlds:', Error);
    Res.status(500).json({ error: 'Failed to fetch worlds' });
  }
});

Router.get('/worlds/:id', RequireAuth, async (Req, Res) =>
{
  try
  {
    const World = await FindWorldById(Req.params.id);
    if (!World)
      return Res.status(404).json({ error: 'World not found' });
    Res.json({ world: World });
  }
  catch (Error)
  {
    console.error('Error fetching world:', Error);
    Res.status(500).json({ error: 'Failed to fetch world' });
  }
});

Router.post('/worlds', RequireAuth, async (Req, Res) =>
{
  try
  {
    const { name, seed, worldType } = Req.body;
    if (!name || !name.trim())
      return Res.status(400).json({ error: 'World name is required' });

    const World =
    {
      id: `world-${Date.now()}`,
      name: name.trim(),
      seed: seed || Math.floor(Math.random() * 2147483647).toString(),
      worldType: worldType || 'default',
      creatorId: Req.user.id,
      creatorUsername: Req.user.username,
      players: [],
      createdAt: new Date().toISOString()
    };

    await InsertWorld(World);
    await WriteLog(Req.user.username, `создал мир "${World.name}"`);

    if (global.io)
      global.io.emit('world_created', { world: World });
    Res.status(201).json({ message: 'World created successfully', world: World });
  }
  catch (Error)
  {
    console.error('Error creating world:', Error);
    Res.status(500).json({ error: 'Failed to create world' });
  }
});

Router.post('/worlds/:id/join', RequireAuth, async (Req, Res) =>
{
  try
  {
    const World = await FindWorldById(Req.params.id);
    if (!World)
      return Res.status(404).json({ error: 'World not found' });

    const Existing = World.players.find(P => P.username === Req.user.username);

    if (!Existing)
    {
      World.players.push({
        id: Req.user.id,
        socket_id: Req.body.socketId || null,
        username: Req.user.username,
        joinedAt: new Date().toISOString()
      });
      await WriteLog(Req.user.username, `вошёл в мир "${World.name}" (${World.id})`);
    }
    else if (Req.body.socketId)
    {
      Existing.socket_id = Req.body.socketId;
    }

    await UpdateWorld(World.id, { players: World.players });

    if (global.io)
    {
      const LastPlayer = World.players.find(P => P.username === Req.user.username);
      global.io.emit('player_joined',
      {
        worldId: World.id,
        player:
        {
          id: LastPlayer.socket_id || LastPlayer.id,
          username: LastPlayer.username,
          socket_id: LastPlayer.socket_id
        }
      });
    }

    Res.json({ message: 'Successfully joined world', world: World });
  }
  catch (Error)
  {
    console.error('Error joining world:', Error);
    Res.status(500).json({ error: 'Failed to join world' });
  }
});

Router.get('/worlds/:id/chunks', RequireAuth, async (Req, Res) =>
{
  try
  {
    const World = await FindWorldById(Req.params.id);
    if (!World)
      return Res.status(404).json({ error: 'World not found' });

    const MinX = parseInt(Req.query.minX, 10);
    const MaxX = parseInt(Req.query.maxX, 10);
    const MinZ = parseInt(Req.query.minZ, 10);
    const MaxZ = parseInt(Req.query.maxZ, 10);

    if ([MinX, MaxX, MinZ, MaxZ].some(Value => Number.isNaN(Value)))
      return Res.status(400).json({ error: 'Query params minX, maxX, minZ, maxZ are required' });

    const Chunks = await FindChunksInArea(World.id, MinX, MaxX, MinZ, MaxZ);
    Res.json({ worldId: World.id, chunks: Chunks });
  }
  catch (Error)
  {
    console.error('Error fetching chunks:', Error);
    Res.status(500).json({ error: 'Failed to fetch chunks' });
  }
});

Router.get('/worlds/:id/chunks/:chunkX/:chunkZ', RequireAuth, async (Req, Res) =>
{
  try
  {
    const World = await FindWorldById(Req.params.id);
    if (!World)
      return Res.status(404).json({ error: 'World not found' });

    const ChunkX = parseInt(Req.params.chunkX, 10);
    const ChunkZ = parseInt(Req.params.chunkZ, 10);
    const ChunkData = await FindChunk(World.id, ChunkX, ChunkZ);

    if (!ChunkData)
      return Res.status(404).json({ error: 'Chunk not found' });

    Res.json({ chunk: ChunkData });
  }
  catch (Error)
  {
    console.error('Error fetching chunk:', Error);
    Res.status(500).json({ error: 'Failed to fetch chunk' });
  }
});

Router.put('/worlds/:id/chunks/:chunkX/:chunkZ', RequireAuth, async (Req, Res) =>
{
  try
  {
    const World = await FindWorldById(Req.params.id);
    if (!World)
      return Res.status(404).json({ error: 'World not found' });

    const ChunkX = parseInt(Req.params.chunkX, 10);
    const ChunkZ = parseInt(Req.params.chunkZ, 10);
    const { format, data } = Req.body;

    if (!data || typeof data !== 'string')
      return Res.status(400).json({ error: 'Field "data" (base64) is required' });

    if (format && format !== CHUNK_FORMAT)
      return Res.status(400).json({ error: `Unsupported chunk format: ${format}` });

    const CompressedBuffer = Buffer.from(data, 'base64');
    if (CompressedBuffer.length === 0)
      return Res.status(400).json({ error: 'Empty chunk payload' });

    await SaveChunk(World.id, ChunkX, ChunkZ, CompressedBuffer, format || CHUNK_FORMAT);
    Res.json({ message: 'Chunk saved', chunkX: ChunkX, chunkZ: ChunkZ, format: format || CHUNK_FORMAT });
  }
  catch (Error)
  {
    console.error('Error saving chunk:', Error);
    Res.status(500).json({ error: Error.message || 'Failed to save chunk' });
  }
});

Router.get('/worlds/:id/players/me', RequireAuth, async (Req, Res) =>
{
  try
  {
    const World = await FindWorldById(Req.params.id);
    if (!World)
      return Res.status(404).json({ error: 'World not found' });

    const PlayerState = await GetPlayerStateInWorld(World.id, Req.user.username);
    Res.json({ worldId: World.id, playerState: PlayerState });
  }
  catch (Error)
  {
    console.error('Error fetching player state:', Error);
    Res.status(500).json({ error: 'Failed to fetch player state' });
  }
});

Router.put('/worlds/:id/players/me', RequireAuth, async (Req, Res) =>
{
  try
  {
    const World = await FindWorldById(Req.params.id);
    if (!World)
      return Res.status(404).json({ error: 'World not found' });

    const SavedState = await SavePlayerStateInWorld(
      World.id,
      Req.user.username,
      Req.user.id,
      Req.body.playerState
    );

    Res.json({ message: 'Player state saved', playerState: SavedState });
  }
  catch (Error)
  {
    console.error('Error saving player state:', Error);
    Res.status(500).json({ error: Error.message || 'Failed to save player state' });
  }
});

Router.delete('/worlds', RequireAuth, RequireAdmin, async (Req, Res) =>
{
  try
  {
    await DeleteAllWorlds();
    await WriteLog(Req.user.username, 'удалил все миры');
    if (global.io)
      global.io.emit('world_deleted', {});
    Res.json({ message: 'Все миры удалены' });
  }
  catch (Error)
  {
    Res.status(500).json({ error: 'Failed to delete all worlds' });
  }
});

Router.delete('/worlds/:id', RequireAuth, RequireAdmin, async (Req, Res) =>
{
  try
  {
    const World = await FindWorldById(Req.params.id);
    if (!World)
      return Res.status(404).json({ error: 'World not found' });

    await DeleteWorld(World.id);
    await WriteLog(Req.user.username, `удалил мир "${Req.params.id}"`);

    if (global.io)
      global.io.emit('world_deleted', { worldId: Req.params.id });
    Res.json({ message: 'World deleted successfully' });
  }
  catch (Error)
  {
    console.error('Error deleting world:', Error);
    Res.status(500).json({ error: 'Failed to delete world' });
  }
});

Router.post('/forgot-password', async (Req, Res) =>
{
  const { email } = Req.body;

  try
  {
    const User = await FindUserByEmail(email);
    if (!User)
      return Res.status(404).json({ error: 'Email не найден' });

    const Code = Math.floor(100000 + Math.random() * 900000).toString();
    await SaveResetCode(email, Code, new Date(Date.now() + 600000));

    if (process.env.EMAIL_USER)
    {
      const Transporter = Nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });
      await Transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Minecraft Web - Код сброса пароля',
        html: `<div style="font-family:monospace;background:#1a1a1a;color:#55ff55;padding:20px;">
          <h2>Сброс пароля</h2>
          <p>Ваш код подтверждения:</p>
          <h1 style="color:#ffffff;letter-spacing:8px">${Code}</h1>
          <p>Код действителен 10 минут.</p>
        </div>`
      });
      console.log(`Email sent to ${email}`);
    }
    else
    {
      console.log(`[DEV] Email to ${email} — code: ${Code}`);
    }

    Res.json({ message: 'Код подтверждения отправлен' });
  }
  catch (Error)
  {
    console.error('Forgot password error:', Error);
    Res.status(500).json({ error: 'Ошибка сервера' });
  }
});

Router.post('/reset-password', async (Req, Res) =>
{
  const { email, code, password } = Req.body;

  try
  {
    const Temp = await FindResetCode(email);
    if (!Temp)
      return Res.status(400).json({ error: 'Код не найден. Повторите запрос.' });
    if (Date.now() > new Date(Temp.expires).getTime())
    {
      await DeleteResetCode(email);
      return Res.status(400).json({ error: 'Код истек' });
    }
    if (Temp.code !== code)
      return Res.status(400).json({ error: 'Неверный код подтверждения' });
    if (!password || password === 'temp')
      return Res.json({ message: 'Код верифицирован' });

    const Updated = await UpdateUserPassword(email, await Bcrypt.hash(password, 10));
    if (!Updated)
      return Res.status(404).json({ error: 'Email не найден' });

    await DeleteResetCode(email);
    Res.json({ message: 'Пароль успешно изменен' });
  }
  catch (Error)
  {
    console.error('Reset password error:', Error);
    Res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = Router;
