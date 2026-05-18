const Alert = require('../models/Alert');

// GET /alerts
const getAlerts = async (req, res) => {
  try {
    const { resolved, severity, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (resolved !== undefined) filter.resolved = resolved === 'true';
    if (severity) filter.severity = severity.toUpperCase();

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v');

    const total = await Alert.countDocuments(filter);

    res.json({ alerts, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
};

// POST /alerts  — called internally by gateway anomaly detector
const createAlert = async (req, res) => {
  try {
    const { type, severity, sourceIp, description, service, userId, metadata } = req.body;

    if (!type || !description || !service) {
      return res.status(400).json({ error: 'type, description, and service are required.' });
    }

    const alert = await Alert.create({ type, severity, sourceIp, description, service, userId, metadata });
    console.warn(`[ALERT] ${severity} | ${type} | ${service} | ${sourceIp || 'unknown'} — ${description}`);
    res.status(201).json({ alert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create alert.' });
  }
};

// POST /alerts/:id/resolve
const resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date(), resolvedBy: req.userId },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found.' });
    res.json({ alert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve alert.' });
  }
};

module.exports = { getAlerts, createAlert, resolveAlert };
