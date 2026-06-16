const Bcrypt = require('bcryptjs');
const Jwt = require('jsonwebtoken');
const Storage = require('./storage');

const JwtSecret = process.env.SESSION_SECRET || 'webminecraft_secret_key_2024';

async function HashPassword(Password)
{
  const Salt = await Bcrypt.genSalt(10);
  return Bcrypt.hash(Password, Salt);
}

async function VerifyPassword(Password, HashedPassword)
{
  return Bcrypt.compare(Password, HashedPassword);
}

function GenerateToken(User)
{
  return Jwt.sign(
    { id: User._id || User.id, username: User.username },
    JwtSecret,
    { expiresIn: '24h' }
  );
}

function VerifyToken(Token)
{
  try
  {
    return Jwt.verify(Token, JwtSecret);
  }
  catch (Error)
  {
    return null;
  }
}

function ValidateRegistration(Username, Email, Password)
{
  const Errors = [];

  if (!Username || Username.length < 3)
    Errors.push('Username must be at least 3 characters');

  if (!Username || Username.length > 20)
    Errors.push('Username must be less than 20 characters');

  const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!Email || !EmailRegex.test(Email))
    Errors.push('Valid email is required');

  if (!Password || Password.length < 6)
    Errors.push('Password must be at least 6 characters');

  return Errors;
}

function ValidateLogin(Username, Password)
{
  const Errors = [];

  if (!Username)
    Errors.push('Username is required');

  if (!Password)
    Errors.push('Password is required');

  return Errors;
}

module.exports =
{
  HashPassword,
  VerifyPassword,
  GenerateToken,
  VerifyToken,
  ValidateRegistration,
  ValidateLogin,
  FindUserByUsername: Storage.FindUserByUsername,
  FindUserByEmail: Storage.FindUserByEmail,
  InsertUser: Storage.InsertUser,
  UpdateLastLogin: Storage.UpdateLastLogin,
  FindUserById: Storage.FindUserById,
  GetAllUsers: Storage.GetAllUsers,
  JwtSecret
};
