require('dotenv').config();
const Fs = require('fs');
const Path = require('path');
const Crypto = require('crypto');
const User = require('../models/User');
const Counter = require('../models/Counter');
const { ConnectMongo } = require('../db/connection');
const Storage = require('../storage');

const UsersFile = Path.join(__dirname, '..', 'data', 'users.json');
const WorldsFile = Path.join(__dirname, '..', 'data', 'worlds.json');
const LogsFile = Path.join(__dirname, '..', 'data', 'logs.json');
const EncryptionKeyRaw = process.env.STORAGE_KEY || 'webminecraft_encryption_key_2024';
const EncryptionKey = Buffer.from(EncryptionKeyRaw.padEnd(32, '0').substring(0, 32));

function DecryptUsers(EncryptedData)
{
  const [Iv, Content] = EncryptedData.split(':');
  const Decipher = Crypto.createDecipheriv('aes-256-cbc', EncryptionKey, Buffer.from(Iv, 'hex'));
  let Decrypted = Decipher.update(Content, 'hex', 'utf8');
  Decrypted += Decipher.final('utf8');
  return JSON.parse(Decrypted);
}

function ReadLegacyUsers()
{
  if (!Fs.existsSync(UsersFile))
    return [];

  const Raw = Fs.readFileSync(UsersFile, 'utf8').trim();
  if (!Raw)
    return [];

  if (Raw.startsWith('['))
    return JSON.parse(Raw);

  return DecryptUsers(Raw);
}

async function MigrateUsers()
{
  const Users = ReadLegacyUsers();
  if (Users.length === 0)
  {
    console.log('Users: nothing to migrate');
    return;
  }

  let Imported = 0;
  let MaxId = 0;

  for (const Entry of Users)
  {
    const Exists = await User.findOne({ username: Entry.username.toLowerCase() });
    if (Exists)
      continue;

    await User.create({
      id: Entry.id,
      username: Entry.username.toLowerCase(),
      email: Entry.email.toLowerCase(),
      password: Entry.password,
      webrtc_id: Entry.webrtc_id || `webrtc-${Entry.username}`,
      IsAdmin: Entry.IsAdmin === true,
      banned: Entry.banned === true,
      created_at: Entry.created_at ? new Date(Entry.created_at) : new Date(),
      last_login: Entry.last_login ? new Date(Entry.last_login) : null
    });

    if (Entry.id > MaxId)
      MaxId = Entry.id;

    Imported++;
  }

  if (MaxId > 0)
  {
    await Counter.findByIdAndUpdate(
      'userId',
      { $max: { seq: MaxId } },
      { upsert: true }
    );
  }

  console.log(`Users migrated: ${Imported}`);
}

async function MigrateWorlds()
{
  if (!Fs.existsSync(WorldsFile))
  {
    console.log('Worlds: nothing to migrate');
    return;
  }

  const Worlds = JSON.parse(Fs.readFileSync(WorldsFile, 'utf8'));
  let Imported = 0;

  for (const World of Worlds)
  {
    const Exists = await Storage.FindWorldById(World.id);
    if (Exists)
      continue;

    await Storage.InsertWorld(World);
    Imported++;
  }

  console.log(`Worlds migrated: ${Imported}`);
}

async function MigrateLogs()
{
  if (!Fs.existsSync(LogsFile))
  {
    console.log('Logs: nothing to migrate');
    return;
  }

  const Logs = JSON.parse(Fs.readFileSync(LogsFile, 'utf8'));
  let Imported = 0;

  for (const Entry of Logs)
  {
    await Storage.WriteLog(Entry.username, Entry.action);
    Imported++;
  }

  console.log(`Logs migrated: ${Imported}`);
}

async function Main()
{
  await ConnectMongo();
  await MigrateUsers();
  await MigrateWorlds();
  await MigrateLogs();
  console.log('Migration finished');
  process.exit(0);
}

Main().catch(Error =>
{
  console.error('Migration failed:', Error);
  process.exit(1);
});
