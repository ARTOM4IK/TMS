const Mongoose = require('mongoose');

const UserSchema = new Mongoose.Schema({
  id: { type: Number, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  webrtc_id: { type: String, required: true },
  IsAdmin: { type: Boolean, default: false },
  role: { type: String, enum: ['player', 'homelander'], default: 'player' },
  banned: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  last_login: { type: Date, default: null }
});

module.exports = Mongoose.model('User', UserSchema);
