const Mongoose = require('mongoose');

const LogSchema = new Mongoose.Schema({
  username: { type: String, required: true },
  action: { type: String, required: true },
  time: { type: Date, default: Date.now, index: true }
});

module.exports = Mongoose.model('Log', LogSchema);
