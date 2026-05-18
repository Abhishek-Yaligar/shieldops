const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const { processData, getStats } = require('./controllers/dataController');
const { getAlerts, createAlert, resolveAlert } = require('./controllers/alertController');

const app = express();
app.use(helmet());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/shieldops-data')
  .then(() => console.log('Data Service: MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Trust headers from gateway
app.use((req, res, next) => {
  req.userId   = req.headers['x-user-id'];
  req.userRole = req.headers['x-user-role'];
  req.isInternal = req.headers['x-internal-key'] === (process.env.INTERNAL_API_KEY || 'internal-secret');
  if (!req.userId && !req.isInternal) {
    return res.status(401).json({ error: 'Missing user context.' });
  }
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'data-service' }));

// Data endpoints
app.post('/process', processData);
app.get('/stats',    getStats);

// Alert endpoints (also used by gateway anomaly detector)
app.get('/alerts',          getAlerts);
app.post('/alerts',         createAlert);
app.post('/alerts/:id/resolve', resolveAlert);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Data Service running on port ${PORT}`));

module.exports = app;
