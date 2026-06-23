const Bcrypt = require('bcryptjs');
const Counter = require('./models/Counter');
const User = require('./models/User');
const World = require('./models/World');
const Chunk = require('./models/Chunk');
const Log = require('./models/Log');
const ResetCode = require('./models/ResetCode');
const
{
  CHUNK_BLOCK_COUNT,
  CHUNK_FORMAT,
  decompressChunkBlocks,
  normalizePlayerState,
  playerStateToClient
} = require('./chunkCodec');

const CHUNK_BLOCK_BYTES = CHUNK_BLOCK_COUNT * 4;

async function GetNextSequence(Name)
{
  const Doc = await Counter.findByIdAndUpdate(
    Name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return Doc.seq;
}

function UserToPlain(UserDoc)
{
  if (!UserDoc) return null;
  const Plain = UserDoc.toObject ? UserDoc.toObject() : UserDoc;
  return {
    id: Plain.id,
    username: Plain.username,
    email: Plain.email,
    password: Plain.password,
    webrtc_id: Plain.webrtc_id,
    IsAdmin: Plain.IsAdmin === true,
    role: Plain.role === 'homelander' || Plain.IsAdmin === true ? 'homelander' : 'player',
    banned: Plain.banned === true,
    created_at: Plain.created_at,
    last_login: Plain.last_login
  };
}

function WorldToPlain(WorldDoc)
{
  if (!WorldDoc) return null;
  const Plain = WorldDoc.toObject ? WorldDoc.toObject() : WorldDoc;
  return {
    id: Plain.worldId,
    name: Plain.name,
    seed: Plain.seed,
    worldType: Plain.worldType,
    creatorId: Plain.creatorId,
    creatorUsername: Plain.creatorUsername,
    players: Plain.players || [],
    createdAt: Plain.createdAt
  };
}

async function FindUserByUsername(Username)
{
  const UserDoc = await User.findOne({ username: Username.toLowerCase() });
  return UserToPlain(UserDoc);
}

async function FindUserByEmail(Email)
{
  const UserDoc = await User.findOne({ email: Email.toLowerCase() });
  return UserToPlain(UserDoc);
}

async function FindUserById(UserId)
{
  const NumId = typeof UserId === 'string' ? parseInt(UserId, 10) : UserId;
  const UserDoc = await User.findOne({ id: NumId });
  return UserToPlain(UserDoc);
}

async function InsertUser(Username, Email, HashedPassword, WebRtcId, IsAdmin = false)
{
  const NextId = await GetNextSequence('userId');
  const UserDoc = await User.create({
    id: NextId,
    username: Username.toLowerCase(),
    email: Email.toLowerCase(),
    password: HashedPassword,
    webrtc_id: WebRtcId,
    IsAdmin: IsAdmin === true,
    banned: false,
    created_at: new Date(),
    last_login: null
  });
  return UserToPlain(UserDoc);
}

async function UpdateLastLogin(UserId)
{
  const Result = await User.updateOne(
    { id: UserId },
    { $set: { last_login: new Date() } }
  );
  return Result.modifiedCount > 0;
}

async function UpdateUserPassword(Email, HashedPassword)
{
  const Result = await User.updateOne(
    { email: Email.toLowerCase() },
    { $set: { password: HashedPassword } }
  );
  return Result.modifiedCount > 0;
}

async function GetAllUsers()
{
  const Users = await User.find({}, { username: 1, email: 1, created_at: 1 }).lean();
  return Users.map(Entry => ({
    username: Entry.username,
    email: Entry.email,
    created_at: Entry.created_at
  }));
}

async function ReadUsers()
{
  const Users = await User.find().lean();
  return Users.map(UserToPlain);
}

function IsUserAdmin(User)
{
  return !!(User && User.IsAdmin === true);
}

async function SetUserRole(Username, Role)
{
  const Normalized = Role === 'homelander' ? 'homelander' : 'player';
  const Result = await User.updateOne(
    { username: Username.toLowerCase() },
    { $set: { role: Normalized } }
  );
  return Result.matchedCount > 0;
}

async function SetBanned(Username, Banned)
{
  const Result = await User.updateOne(
    { username: Username.toLowerCase() },
    { $set: { banned: Banned === true } }
  );
  return Result.matchedCount > 0;
}

async function SetUserAdmin(Username, IsAdminFlag)
{
  const Result = await User.updateOne(
    { username: Username.toLowerCase() },
    { $set: { IsAdmin: IsAdminFlag === true } }
  );
  return Result.matchedCount > 0;
}

async function WriteLog(Username, Action)
{
  await Log.create({ username: Username, action: Action, time: new Date() });
}

async function ReadLogs()
{
  const Logs = await Log.find().sort({ time: 1 }).lean();
  return Logs.map(Entry => ({
    username: Entry.username,
    action: Entry.action,
    time: Entry.time
  }));
}

async function SaveResetCode(Email, Code, ExpiresAt)
{
  await ResetCode.findOneAndUpdate(
    { email: Email.toLowerCase() },
    { code: Code, expires: ExpiresAt },
    { upsert: true, new: true }
  );
}

async function FindResetCode(Email)
{
  return ResetCode.findOne({ email: Email.toLowerCase() }).lean();
}

async function DeleteResetCode(Email)
{
  await ResetCode.deleteOne({ email: Email.toLowerCase() });
}

async function InitializeTestUsers(TestUsers)
{
  const Count = await User.countDocuments();
  if (Count > 0)
  {
    console.log(`Users already exist: ${Count} users`);
    return;
  }

  for (let Index = 0; Index < TestUsers.length; Index++)
  {
    const UserData = TestUsers[Index];
    await InsertUser(
      UserData.username,
      UserData.email,
      await Bcrypt.hash(UserData.password, 10),
      UserData.webrtcId,
      UserData.IsAdmin === true
    );
  }

  console.log(`Test users initialized: ${TestUsers.length} users`);
}

async function FindAllWorlds()
{
  const Worlds = await World.find().sort({ createdAt: -1 }).lean();
  return Worlds.map(WorldToPlain);
}

async function FindWorldById(WorldId)
{
  const WorldDoc = await World.findOne({ worldId: WorldId }).lean();
  return WorldToPlain(WorldDoc);
}

async function InsertWorld(WorldData)
{
  await World.create({
    worldId: WorldData.id,
    name: WorldData.name,
    seed: WorldData.seed,
    worldType: WorldData.worldType || 'default',
    creatorId: WorldData.creatorId,
    creatorUsername: WorldData.creatorUsername,
    players: WorldData.players || [],
    createdAt: WorldData.createdAt ? new Date(WorldData.createdAt) : new Date()
  });
  return WorldData;
}

async function UpdateWorld(WorldId, UpdateData)
{
  const WorldDoc = await World.findOneAndUpdate(
    { worldId: WorldId },
    { $set: UpdateData },
    { new: true }
  ).lean();
  return WorldToPlain(WorldDoc);
}

async function DeleteWorld(WorldId)
{
  const Result = await World.deleteOne({ worldId: WorldId });
  await Chunk.deleteMany({ worldId: WorldId });
  return Result.deletedCount > 0;
}

async function DeleteAllWorlds()
{
  await World.deleteMany({});
  await Chunk.deleteMany({});
}

async function FindChunksInArea(WorldId, MinX, MaxX, MinZ, MaxZ)
{
  const Chunks = await Chunk.find({
    worldId: WorldId,
    chunkX: { $gte: MinX, $lte: MaxX },
    chunkZ: { $gte: MinZ, $lte: MaxZ }
  }).lean();

  return Chunks.map(Entry => ({
    chunkX: Entry.chunkX,
    chunkZ: Entry.chunkZ,
    format: Entry.format || CHUNK_FORMAT,
    data: Entry.blocks.toString('base64'),
    updatedAt: Entry.updatedAt
  }));
}

async function FindChunk(WorldId, ChunkX, ChunkZ)
{
  const ChunkDoc = await Chunk.findOne({ worldId: WorldId, chunkX: ChunkX, chunkZ: ChunkZ }).lean();
  if (!ChunkDoc) return null;

  return {
    chunkX: ChunkDoc.chunkX,
    chunkZ: ChunkDoc.chunkZ,
    format: ChunkDoc.format || CHUNK_FORMAT,
    data: ChunkDoc.blocks.toString('base64'),
    updatedAt: ChunkDoc.updatedAt
  };
}

async function SaveChunk(WorldId, ChunkX, ChunkZ, CompressedBuffer, Format = CHUNK_FORMAT)
{
  if (!CompressedBuffer || !Buffer.isBuffer(CompressedBuffer) || CompressedBuffer.length === 0)
    throw new Error('Invalid compressed chunk payload');

  await decompressChunkBlocks(CompressedBuffer);

  await Chunk.findOneAndUpdate(
    { worldId: WorldId, chunkX: ChunkX, chunkZ: ChunkZ },
    {
      worldId: WorldId,
      chunkX: ChunkX,
      chunkZ: ChunkZ,
      blocks: CompressedBuffer,
      format: Format,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
}

async function GetPlayerStateInWorld(WorldId, Username)
{
  const WorldDoc = await World.findOne({ worldId: WorldId }).lean();
  if (!WorldDoc)
    return null;

  const PlayerEntry = (WorldDoc.players || []).find(P => P.username === Username);
  if (!PlayerEntry || !PlayerEntry.state)
    return null;

  return playerStateToClient(PlayerEntry.state);
}

async function SavePlayerStateInWorld(WorldId, Username, UserId, PlayerState)
{
  const Normalized = normalizePlayerState(PlayerState);
  if (!Normalized)
    throw new Error('Invalid player state');

  const WorldDoc = await World.findOne({ worldId: WorldId });
  if (!WorldDoc)
    return null;

  let PlayerEntry = WorldDoc.players.find(P => P.username === Username);

  if (!PlayerEntry)
  {
    PlayerEntry =
    {
      id: UserId,
      username: Username,
      socket_id: null,
      joinedAt: new Date(),
      state: Normalized
    };
    WorldDoc.players.push(PlayerEntry);
  }
  else
  {
    PlayerEntry.state = Normalized;
  }

  WorldDoc.markModified('players');
  await WorldDoc.save();

  return playerStateToClient(Normalized);
}

module.exports = {
  FindUserByUsername,
  FindUserByEmail,
  FindUserById,
  InsertUser,
  UpdateLastLogin,
  UpdateUserPassword,
  GetAllUsers,
  ReadUsers,
  IsUserAdmin,
  SetBanned,
  SetUserRole,
  SetUserAdmin,
  WriteLog,
  ReadLogs,
  SaveResetCode,
  FindResetCode,
  DeleteResetCode,
  InitializeTestUsers,
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
  SavePlayerStateInWorld,
  CHUNK_BLOCK_BYTES
};
