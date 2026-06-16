/***************************************************************
 * Copyright (C) 2026
 *    Computer Graphics Support Group of 30 Phys-Math Lyceum
 ***************************************************************/

/* FILE NAME   : database.js
 * PURPOSE     : Minecraft Web.
 *               Database wrapper for file-based storage.
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

const 
{
  FindUserByUsername,
  FindUserByEmail,
  InsertUser,
  UpdateLastLogin,
  FindUserById,
  GetAllUsers,
  InitializeTestUsers,
  ReadUsers
} = require('./storage');

const TestUsers = 
[
  {
    username: 'steve',
    email: 'steve@minecraft.com',
    password: 'password123',
    webrtcId: 'webrtc-steve-001',
    IsAdmin: false
  },
  {
    username: 'alex',
    email: 'alex@minecraft.com',
    password: 'password123',
    webrtcId: 'webrtc-alex-002',
    IsAdmin: false
  },
  {
    username: 'creeper',
    email: 'creeper@minecraft.com',
    password: 'password123',
    webrtcId: 'webrtc-creeper-003',
    IsAdmin: false
  }
];

module.exports = 
{
  TestUsers,
  FindUserByUsername,
  FindUserByEmail,
  InsertUser,
  UpdateLastLogin,
  FindUserById,
  GetAllUsers,
  InitializeTestUsers,
  ReadUsers
};

/* END OF 'database.js' FILE */
