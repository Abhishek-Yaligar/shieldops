/**
 * Lightweight in-process anomaly detector.
 * For production, this forwards logs to the Python AI module via HTTP.
 */

const axios = require('axios');

// Sliding-window counters per IP
const requestWindows = new Map();
const WINDOW_MS = 60 * 1000;   // 1 minute
const SPIKE_THRESHOLD = 60;    // requests per window

// Suspicious patterns
const SUSPICIOUS_PATHS = [/\.env/, /\/admin\//, /\/etc\/passwd/, /\.\.\//];
const SUSPICIOUS_UA    = [/sqlmap/i, /nikto/i, /nmap/i, /masscan/i];

const anomalyDetector = async (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  // ── 1. Request-rate spike detection ──────────────────────────────────────
  if (!requestWindows.has(ip)) requestWindows.set(ip, []);
  const window = requestWindows.get(ip).filter(t => now - t < WINDOW_MS);
  window.push(now);
  requestWindows.set(ip, window);

  if (window.length > SPIKE_THRESHOLD) {
    console.warn(`[Anomaly] Rate spike detected from IP: ${ip} (${window.length} req/min)`);
    await reportAnomaly({
      type: 'RATE_SPIKE',
      severity: 'HIGH',
      sourceIp: ip,
      description: `${window.length} requests/min exceeds threshold of ${SPIKE_THRESHOLD}`,
      service: 'api-gateway',
      userId: req.user?.id,
    });
    return res.status(429).json({ error: 'Anomalous request rate detected. Request blocked.' });
  }

  // ── 2. Suspicious path detection ─────────────────────────────────────────
  if (SUSPICIOUS_PATHS.some(p => p.test(req.path))) {
    console.warn(`[Anomaly] Suspicious path from IP ${ip}: ${req.path}`);
    await reportAnomaly({
      type: 'SUSPICIOUS_PATH',
      severity: 'MEDIUM',
      sourceIp: ip,
      description: `Suspicious path accessed: ${req.path}`,
      service: 'api-gateway',
      userId: req.user?.id,
    });
  }

  // ── 3. Suspicious user-agent detection ───────────────────────────────────
  const ua = req.headers['user-agent'] || '';
  if (SUSPICIOUS_UA.some(p => p.test(ua))) {
    console.warn(`[Anomaly] Suspicious user-agent from IP ${ip}: ${ua}`);
    await reportAnomaly({
      type: 'SUSPICIOUS_AGENT',
      severity: 'HIGH',
      sourceIp: ip,
      description: `Suspicious user-agent: ${ua}`,
      service: 'api-gateway',
      userId: req.user?.id,
    });
    return res.status(403).json({ error: 'Request blocked: suspicious client detected.' });
  }

  // ── 4. Forward to Python AI module (async, non-blocking) ─────────────────
  const payload = {
    timestamp: new Date().toISOString(),
    ip,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    userRole: req.user?.role,
    userAgent: ua,
  };

  const aiUrl = process.env.AI_MODULE_URL || 'http://ai-module:5000';
  axios.post(`${aiUrl}/analyze`, payload).catch(() => {
    // AI module is non-blocking; log but don't fail the request
  });

  next();
};

async function reportAnomaly(data) {
  const dataServiceUrl = process.env.DATA_SERVICE_URL || 'http://data-service:3003';
  try {
    await axios.post(`${dataServiceUrl}/alerts`, data, {
      headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY || 'internal-secret' },
    });
  } catch (err) {
    console.error('[Anomaly] Failed to store alert:', err.message);
  }
}

module.exports = { anomalyDetector };
