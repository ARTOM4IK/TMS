const { ConnectMongo } = require('./db/connection');
const Storage = require('./storage');

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
  ConnectMongo,
  TestUsers,
  ...Storage
};
