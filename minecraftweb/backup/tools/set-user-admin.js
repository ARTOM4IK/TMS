require('dotenv').config();
const { ReadUsers, WriteUsers } = require('../storage');

const Username = process.argv[2];
const Flag = process.argv[3];

if (!Username || (Flag !== 'true' && Flag !== 'false'))
{
  console.error('Usage: node tools/set-user-admin.js <username> <true|false>');
  process.exit(1);
}

const Users = ReadUsers();
const User = Users.find(Entry => Entry.username === Username.toLowerCase());

if (!User)
{
  console.error('User not found:', Username);
  process.exit(1);
}

User.IsAdmin = Flag === 'true';
WriteUsers(Users);
console.log(`IsAdmin for ${User.username} set to ${User.IsAdmin}`);
