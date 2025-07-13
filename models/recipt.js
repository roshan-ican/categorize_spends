const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  }
});

const ReceiptSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  items: [ItemSchema],
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Receipt', ReceiptSchema);
