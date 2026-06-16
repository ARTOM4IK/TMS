/***************************************************************
 * Copyright (C) 2026
 *    Computer Graphics Support Group of 30 Phys-Math Lyceum
 ***************************************************************/

/* FILE NAME   : auth.js
 * PURPOSE     : Minecraft Web.
 *               Authentication utilities and middleware.
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

const Bcrypt = require('bcryptjs');
const Jwt = require('jsonwebtoken');
const Storage = require('./storage');

const JwtSecret = process.env.SESSION_SECRET || 'webminecraft_secret_key_2024';

/*
 * Hash password.
 * ARGUMENTS:
 *   - Plain text password:
 *       string Password;
 * RETURNS:
 *   (string) hashed password.
 */
async function HashPassword(Password)
{
  const Salt = await Bcrypt.genSalt(10);
  const HashedPassword = await Bcrypt.hash(Password, Salt);
  return HashedPassword;
} /* End of 'HashPassword' function */

/*
 * Verify password against hashed password.
 * ARGUMENTS:
 *   - Plain text password:
 *       string Password;
 *   - Stored hash:
 *       string HashedPassword;
 * RETURNS:
 *   (boolean) true if password matches.
 */
async function VerifyPassword(Password, HashedPassword)
{
  const IsMatch = await Bcrypt.compare(Password, HashedPassword);
  return IsMatch;
} /* End of 'VerifyPassword' function */

/*
 * Generate JWT token for user.
 * ARGUMENTS:
 *   - User record:
 *       object User;
 * RETURNS:
 *   (string) JWT token.
 */
function GenerateToken(User)
{
  const Token = Jwt.sign(
    { id: User._id || User.id, username: User.username },
    JwtSecret,
    { expiresIn: '24h' }
  );
  return Token;
} /* End of 'GenerateToken' function */

/*
 * Verify JWT token.
 * ARGUMENTS:
 *   - JWT token string:
 *       string Token;
 * RETURNS:
 *   (object|null) decoded token payload.
 */
function VerifyToken(Token)
{
  try
  {
    const Decoded = Jwt.verify(Token, JwtSecret);
    return Decoded;
  }
  catch (error)
  {
    return null;
  }
} /* End of 'VerifyToken' function */

/*
 * Validate registration input fields.
 * ARGUMENTS:
 *   - Username:
 *       string Username;
 *   - Email:
 *       string Email;
 *   - Password:
 *       string Password;
 * RETURNS:
 *   (array) list of validation errors.
 */
function ValidateRegistration(Username, Email, Password)
{
  const Errors = [];

  if (!Username || Username.length < 3)
  {
    Errors.push('Username must be at least 3 characters');
  }

  if (!Username || Username.length > 20)
  {
    Errors.push('Username must be less than 20 characters');
  }

  const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!Email || !EmailRegex.test(Email))
  {
    Errors.push('Valid email is required');
  }

  if (!Password || Password.length < 6)
  {
    Errors.push('Password must be at least 6 characters');
  }

  return Errors;
} /* End of 'ValidateRegistration' function */

/*
 * Validate login input fields.
 * ARGUMENTS:
 *   - Username:
 *       string Username;
 *   - Password:
 *       string Password;
 * RETURNS:
 *   (array) list of validation errors.
 */
function ValidateLogin(Username, Password)
{
  const Errors = [];

  if (!Username)
  {
    Errors.push('Username is required');
  }

  if (!Password)
  {
    Errors.push('Password is required');
  }

  return Errors;
} /* End of 'ValidateLogin' function */

/*
 * Find user by ID via storage layer.
 * ARGUMENTS:
 *   - User identifier:
 *       number|string UserId;
 * RETURNS:
 *   (object|undefined) user record.
 */
function FindUserById(UserId)
{
  const NumId = typeof UserId === 'string' ? parseInt(UserId, 10) : UserId;
  const Users = Storage.ReadUsers();
  return Users.find(User => User.id === NumId);
} /* End of 'FindUserById' function */

/*
 * Get all users without sensitive data.
 * ARGUMENTS: None.
 * RETURNS:
 *   (array) sanitized user list.
 */
function GetAllUsers()
{
  return Storage.GetAllUsers();
} /* End of 'GetAllUsers' function */

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
  FindUserById,
  GetAllUsers,
  JwtSecret
};

/* END OF 'auth.js' FILE */
