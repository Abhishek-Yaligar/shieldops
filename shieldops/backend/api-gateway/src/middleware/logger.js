const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || '/var/log/shieldops';

// Ensure log directory exists (best-effort in container)
try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (_) {}

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: Date.now() - start,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id || 'anonymous',
      userRole: req.user?.role || 'none',
    };

    const line = JSON.stringify(logEntry);
    console.log(line);

    // Write to log file for AI anomaly detection
    try {
      const logFile = path.join(LOG_DIR, 'access.log');
      fs.appendFileSync(logFile, line + '\n');
    } catch (_) {}
  });

  next();
};

module.exports = { requestLogger };
