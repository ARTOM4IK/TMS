require('dotenv').config();
const { ConnectMongo, DisconnectMongo } = require('../db/connection');
const { SetUserAdmin, FindUserByUsername } = require('../storage');

async function Main()
{
  const Username = process.argv[2];
  const Flag = process.argv[3];

  if (!Username || (Flag !== 'true' && Flag !== 'false'))
  {
    console.error('Usage: node tools/set-user-admin.js <username> <true|false>');
    process.exit(1);
  }

  await ConnectMongo();

  const User = await FindUserByUsername(Username);
  if (!User)
  {
    console.error('User not found:', Username);
    process.exit(1);
  }

  await SetUserAdmin(User.username, Flag === 'true');
  console.log(`IsAdmin for ${User.username} set to ${Flag === 'true'}`);
  await DisconnectMongo();
}

Main().catch(Error =>
{
  console.error(Error);
  process.exit(1);
});
