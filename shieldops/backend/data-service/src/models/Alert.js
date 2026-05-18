const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['RATE_SPIKE', 'SUSPICIOUS_PATH', 'SUSPICIOUS_AGENT', 'ANOMALY_DETECTED',
           'UNAUTHORIZED_ACCESS', 'BRUTE_FORCE', 'DATA_EXFILTRATION', 'UNUSUAL_PATTERN'],
  },
  severity: {
    type: String,
    required: true,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  },
  sourceIp:    { type: String },
  description: { type: String, required: true },
  service:     { type: String, required: true },
  userId:      { type: String },
  resolved:    { type: Boolean, default: false },
  resolvedAt:  { type: Date },
  resolvedBy:  { type: String },
  metadata:    { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

alertSchema.index({ createdAt: -1 });
alertSchema.index({ resolved: 1 });
alertSchema.index({ severity: 1 });

module.exports = mongoose.model('Alert', alertSchema);
