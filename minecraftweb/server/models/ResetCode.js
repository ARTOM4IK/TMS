const Mongoose = require('mongoose');

const ResetCodeSchema = new Mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  code: { type: String, required: true },
  expires: { type: Date, required: true }
});

module.exports = Mongoose.model('ResetCode', ResetCodeSchema);
