const mongoose = require('mongoose');

const processedDataSchema = new mongoose.Schema({
  userId:       { type: String, required: true },
  inputHash:    { type: String },           // SHA-256 of raw input
  inputSize:    { type: Number },
  outputSize:   { type: Number },
  processingMs: { type: Number },
  status:       { type: String, enum: ['success', 'failed'], default: 'success' },
  errorMessage: { type: String },
}, { timestamps: true });

processedDataSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ProcessedData', processedDataSchema);
