const Mongoose = require('mongoose');

const ChunkSchema = new Mongoose.Schema({
  worldId: { type: String, required: true, index: true },
  chunkX: { type: Number, required: true },
  chunkZ: { type: Number, required: true },
  blocks: { type: Buffer, required: true },
  updatedAt: { type: Date, default: Date.now }
});

ChunkSchema.index({ worldId: 1, chunkX: 1, chunkZ: 1 }, { unique: true });

module.exports = Mongoose.model('Chunk', ChunkSchema);
