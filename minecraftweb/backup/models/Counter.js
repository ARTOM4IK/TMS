const Mongoose = require('mongoose');

const CounterSchema = new Mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

module.exports = Mongoose.model('Counter', CounterSchema);
