const Mongoose = require('mongoose');

const PlayerEntrySchema = new Mongoose.Schema({
  id: { type: Number, required: true },
  username: { type: String, required: true },
  socket_id: { type: String, default: null },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const WorldSchema = new Mongoose.Schema({
  worldId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  seed: { type: String, required: true },
  worldType: { type: String, default: 'default' },
  creatorId: { type: Number, required: true },
  creatorUsername: { type: String, required: true },
  players: { type: [PlayerEntrySchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = Mongoose.model('World', WorldSchema);
