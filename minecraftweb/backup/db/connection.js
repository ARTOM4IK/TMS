const Mongoose = require('mongoose');

let IsConnected = false;

async function ConnectMongo()
{
  const Uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/minecraftweb';

  if (IsConnected)
    return;

  Mongoose.set('strictQuery', true);
  await Mongoose.connect(Uri);
  IsConnected = true;
  console.log('MongoDB connected:', Uri);
}

async function DisconnectMongo()
{
  if (!IsConnected)
    return;

  await Mongoose.disconnect();
  IsConnected = false;
}

module.exports = { ConnectMongo, DisconnectMongo };
