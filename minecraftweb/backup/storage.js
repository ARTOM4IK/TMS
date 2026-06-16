/***************************************************************
 * Copyright (C) 2026
 *    Computer Graphics Support Group of 30 Phys-Math Lyceum
 ***************************************************************/

/* FILE NAME   : storage.js
 * PURPOSE     : Minecraft Web.
 *               File-based storage with encryption.
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

const Fs = require('fs');
const Path = require('path');
const Crypto = require('crypto');

const StorageFile = Path.join(__dirname, 'data', 'users.json');
const EncryptionKeyRaw = process.env.STORAGE_KEY || 'webminecraft_encryption_key_2024';
const EncryptionKey = Buffer.from(EncryptionKeyRaw.padEnd(32, '0').substring(0, 32));
const LogsFile = Path.join(__dirname, 'data', 'logs.json');

/*
 * Ensure data directory exists.
 * ARGUMENTS: None.
 * RETURNS: None.
 */
function EnsureDirectory()
{
  const DataDir = Path.dirname(StorageFile);

  if (!Fs.existsSync(DataDir))
    Fs.mkdirSync(DataDir, { recursive: true });
} /* End of 'EnsureDirectory' function */

/*
 * Encrypt data.
 * ARGUMENTS:
 *   - Data to encrypt:
 *       object Data;
 * RETURNS:
 *   (string) encrypted data string.
 */
function Encrypt(Data)
{
  //initial vector to differ same encyptions
  const Iv = Crypto.randomBytes(16);
  const Cipher = Crypto.createCipheriv('aes-256-cbc', EncryptionKey, Iv);
  let Encrypted = Cipher.update(JSON.stringify(Data), 'utf8', 'hex');
  Encrypted += Cipher.final('hex');
  return Iv.toString('hex') + ':' + Encrypted;
} /* End of 'Encrypt' function */

/*
 * Decrypt data.
 * ARGUMENTS:
 *   - Encrypted data string:
 *       string EncryptedData;
 * RETURNS:
 *   (object) decrypted data object.
 */
function Decrypt(EncryptedData)
{
  const [Iv, Content] = EncryptedData.split(':');
  const Decipher = Crypto.createDecipheriv('aes-256-cbc', EncryptionKey, Buffer.from(Iv, 'hex'));
  let Decrypted = Decipher.update(Content, 'hex', 'utf8');
  Decrypted += Decipher.final('utf8');
  return JSON.parse(Decrypted);
} /* End of 'Decrypt' function */

/*
 * Read users from encrypted file.
 * ARGUMENTS: None.
 * RETURNS:
 *   (array) list of user records.
 */
function ReadUsers()
{
  try
  {
    EnsureDirectory();

    if (!Fs.existsSync(StorageFile))
      return [];

    const Encrypted = Fs.readFileSync(StorageFile, 'utf8');
    return Decrypt(Encrypted);
  }
  catch (error)
  {
    console.error('Error reading storage:', error.message);
    return [];
  }
} /* End of 'ReadUsers' function */

/*
 * Write users to encrypted file.
 * ARGUMENTS:
 *   - Users array to save:
 *       array Users;
 * RETURNS: None.
 */
function WriteUsers(Users)
{
  try
  {
    EnsureDirectory();
    const Encrypted = Encrypt(Users);
    Fs.writeFileSync(StorageFile, Encrypted, 'utf8');
  }
  catch (error)
  {
    console.error('Error writing storage:', error.message);
    throw error;
  }
} /* End of 'WriteUsers' function */

/*
 * Find user by username.
 * ARGUMENTS:
 *   - Username to search:
 *       string Username;
 * RETURNS:
 *   (object|undefined) user record.
 */
function FindUserByUsername(Username)
{
  const Users = ReadUsers();
  return Users.find(User => User.username === Username.toLowerCase());
} /* End of 'FindUserByUsername' function */

/*
 * Find user by email.
 * ARGUMENTS:
 *   - Email to search:
 *       string Email;
 * RETURNS:
 *   (object|undefined) user record.
 */
function FindUserByEmail(Email)
{
  const Users = ReadUsers();
  return Users.find(User => User.email === Email.toLowerCase());
} /* End of 'FindUserByEmail' function */

/*
 * Insert new user into storage.
 * ARGUMENTS:
 *   - Username:
 *       string Username;
 *   - Email:
 *       string Email;
 *   - Hashed password:
 *       string HashedPassword;
 *   - WebRTC identifier:
 *       string WebRtcId;
 * RETURNS:
 *   (object) created user record.
 */
function InsertUser(Username, Email, HashedPassword, WebRtcId, IsAdmin = false)
{
  const Users = ReadUsers();
  const NewUser = 
  {
    id: Users.length + 1,
    username: Username.toLowerCase(),
    email: Email.toLowerCase(),
    password: HashedPassword,
    webrtc_id: WebRtcId,
    IsAdmin: IsAdmin === true,
    created_at: new Date().toISOString(),
    last_login: null
  };
  Users.push(NewUser);
  WriteUsers(Users);
  return NewUser;
} /* End of 'InsertUser' function */

/*
 * Check if user is admin.
 * ARGUMENTS:
 *   - User record:
 *       object User;
 * RETURNS:
 *   (boolean) admin status.
 */
function IsUserAdmin(User)
{
  return !!(User && User.IsAdmin === true);
} /* End of 'IsUserAdmin' function */

/*
 * Update last login.
 * ARGUMENTS:
 *   - User identifier:
 *       number UserId;
 * RETURNS:
 *   (boolean) success status.
 */
function UpdateLastLogin(UserId)
{
  const Users = ReadUsers();
  const User = Users.find(U => U.id === UserId);

  if (User)
  {
    User.last_login = new Date().toISOString();
    WriteUsers(Users);
    return true;
  }

  return false;
} /* End of 'UpdateLastLogin' function */

/*
 * Find user by ID.
 * ARGUMENTS:
 *   - User identifier:
 *       number|string UserId;
 * RETURNS:
 *   (object|undefined) user record.
 */
function FindUserById(UserId)
{
  const Users = ReadUsers();
  const NumId = typeof UserId === 'string' ? parseInt(UserId, 10) : UserId;
  return Users.find(User => User.id === NumId);
} /* End of 'FindUserById' function */

/*
 * Get all users without sensitive fields.
 * ARGUMENTS: None.
 * RETURNS:
 *   (array) sanitized user list.
 */
function GetAllUsers()
{
  const Users = ReadUsers();
  return Users.map(U => ({
    username: U.username,
    email: U.email,
    created_at: U.created_at
  }));
} /* End of 'GetAllUsers' function */

/*
 * Initialize test users if storage is empty.
 * ARGUMENTS:
 *   - Test users data:
 *       array TestUsers;
 * RETURNS: None.
 */
async function InitializeTestUsers(TestUsers)
{
  const Users = ReadUsers();

  if (Users.length === 0)
  {
    const Bcrypt = require('bcryptjs');
    const InitializedUsers = await Promise.all(TestUsers.map(async (UserData, Index) => ({
      id: Index + 1,
      username: UserData.username.toLowerCase(),
      email: UserData.email.toLowerCase(),
      password: await Bcrypt.hash(UserData.password, 10),
      webrtc_id: UserData.webrtcId,
      IsAdmin: UserData.IsAdmin === true,
      created_at: new Date().toISOString(),
      last_login: null
    })));
    WriteUsers(InitializedUsers);
    console.log(`Test users initialized: ${TestUsers.length} users`);
  }
  else
    console.log(`Users already exist: ${Users.length} users`);
} /* End of 'InitializeTestUsers' function */

/*
 * Set banned status for user.
 * ARGUMENTS:
 *   - Username:
 *       string Username;
 *   - Banned flag:
 *       boolean Banned;
 * RETURNS:
 *   (boolean) success status.
 */
function SetBanned(Username, Banned)
{
  const Users = ReadUsers();
  const User = Users.find(U => U.username === Username.toLowerCase());
  if (!User)
    return false;
  User.banned = Banned;
  WriteUsers(Users);
  return true;
} /* End of 'SetBanned' function */

/*
 * Append action entry to logs file.
 * ARGUMENTS:
 *   - Username:
 *       string Username;
 *   - Action description:
 *       string Action;
 * RETURNS: None.
 */
function WriteLog(Username, Action)
{
  EnsureDirectory();
  let Logs = [];

  if (Fs.existsSync(LogsFile))
    Logs = JSON.parse(Fs.readFileSync(LogsFile, 'utf8'));

  Logs.push({ username: Username, action: Action, time: new Date().toISOString() });
  Fs.writeFileSync(LogsFile, JSON.stringify(Logs, null, 2));
} /* End of 'WriteLog' function */

/*
 * Read all log entries.
 * ARGUMENTS: None.
 * RETURNS:
 *   (array) log entries.
 */
function ReadLogs()
{
  if (!Fs.existsSync(LogsFile)) return [];
  return JSON.parse(Fs.readFileSync(LogsFile, 'utf8'));
} /* End of 'ReadLogs' function */

module.exports = 
{
  FindUserByUsername,
  FindUserByEmail,
  InsertUser,
  UpdateLastLogin,
  FindUserById,
  GetAllUsers,
  InitializeTestUsers,
  ReadUsers,
  WriteUsers,
  SetBanned,
  WriteLog,
  ReadLogs,
  IsUserAdmin
};

/* END OF 'storage.js' FILE */
