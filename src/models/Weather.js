const mongoose = require('mongoose');

const weatherSchema = new mongoose.Schema({
  city: { type: String, required: true, index: true },
  temperature: { type: Number, required: true },
  tempMax: { type: Number },
  tempMin: { type: Number },
  humidity: { type: Number, required: true },
  condition: { type: String, required: true },
  description: { type: String },
  windSpeed: { type: Number, required: true },
  date: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('Weather', weatherSchema);
