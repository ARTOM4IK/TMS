const Mongoose = require('mongoose');

const PlayerStateSchema = new Mongoose.Schema({
  position:
  {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 55 },
    z: { type: Number, default: 0 }
  },
  yaw: { type: Number, default: 0 },
  pitch: { type: Number, default: 0 },
  target: { type: [Number], default: [0, 0] },
  inventory: { type: Mongoose.Schema.Types.Mixed, default: () => ({ slots: [], selectedSlot: 0 }) },
  role: { type: String, enum: ['player', 'homelander'], default: 'player' },
  lastSavedAt: { type: Date, default: null }
}, { _id: false });

const PlayerEntrySchema = new Mongoose.Schema({
  id: { type: Number, required: true },
  username: { type: String, required: true },
  socket_id: { type: String, default: null },
  joinedAt: { type: Date, default: Date.now },
  state: { type: PlayerStateSchema, default: () => ({}) }
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
