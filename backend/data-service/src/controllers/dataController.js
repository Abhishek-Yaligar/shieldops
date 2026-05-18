const crypto = require('crypto');
const ProcessedData = require('../models/ProcessedData');
const Alert = require('../models/Alert');

// POST /process
const processData = async (req, res) => {
  const startTime = Date.now();
  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'No data provided for processing.' });
  }

  try {
    // Validate: reject payloads larger than 1 MB
    const inputStr = typeof data === 'string' ? data : JSON.stringify(data);
    if (Buffer.byteLength(inputStr, 'utf8') > 1024 * 1024) {
      return res.status(413).json({ error: 'Payload too large (max 1 MB).' });
    }

    // Simulate processing: parse, sanitise, transform
    let parsed;
    try {
      parsed = typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      return res.status(400).json({ error: 'Invalid JSON in data field.' });
    }

    // --- Deep Packet Inspection (DPI) ---
    const maliciousPatterns = [/etc\/passwd/i, /\.\.\//, /<script>/i, /union.*select/i];
    const dataStr = JSON.stringify(parsed);
    if (maliciousPatterns.some(p => p.test(dataStr))) {
      console.warn(`[DPI Anomaly] Malicious pattern detected in payload body from User: ${req.userId}`);
      // --- Direct Alert Injection ---
      // We save directly to the DB to avoid internal loopback header issues
      Alert.create({
        type: 'UNUSUAL_PATTERN',
        severity: 'HIGH',
        sourceIp: req.ip || 'internal',
        description: `Malicious pattern detected in JSON payload body`,
        service: 'data-service',
        userId: req.userId,
        metadata: { matchedPattern: maliciousPatterns.find(p => p.test(dataStr)).toString() }
      }).catch(err => console.error('[DPI] Failed to save alert:', err));
    }

    // Remove sensitive-looking keys
    const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'api_key', 'ssn', 'creditCard'];
    const sanitise = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      const out = Array.isArray(obj) ? [] : {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = sensitiveKeys.some(sk => k.toLowerCase().includes(sk))
          ? '[REDACTED]'
          : sanitise(v);
      }
      return out;
    };
    const sanitised = sanitise(parsed);

    const result = {
      processed: true,
      sanitisedData: sanitised,
      fieldCount: Object.keys(sanitised).length,
      processedAt: new Date().toISOString(),
      processingMs: Date.now() - startTime,
    };

    // Persist audit record
    await ProcessedData.create({
      userId: req.userId,
      inputHash: crypto.createHash('sha256').update(inputStr).digest('hex'),
      inputSize: Buffer.byteLength(inputStr, 'utf8'),
      outputSize: Buffer.byteLength(JSON.stringify(result), 'utf8'),
      processingMs: result.processingMs,
      status: 'success',
    });

    res.json(result);
  } catch (err) {
    console.error('Process error:', err);

    await ProcessedData.create({
      userId: req.userId || 'unknown',
      inputSize: 0,
      processingMs: Date.now() - startTime,
      status: 'failed',
      errorMessage: err.message,
    }).catch(() => { });

    res.status(500).json({ error: 'Processing failed.' });
  }
};

// GET /stats
const getStats = async (req, res) => {
  try {
    const [
      totalRequests,
      successCount,
      anomaliesDetected,
      blockedRequests,
      successfulAuths,
    ] = await Promise.all([
      ProcessedData.countDocuments(),
      ProcessedData.countDocuments({ status: 'success' }),
      Alert.countDocuments({ resolved: false }),
      Alert.countDocuments({ type: { $in: ['RATE_SPIKE', 'SUSPICIOUS_AGENT'] } }),
      ProcessedData.countDocuments({ status: 'success' }),
    ]);

    res.json({
      totalRequests,
      successCount,
      anomaliesDetected,
      blockedRequests,
      successfulAuths,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
};

module.exports = { processData, getStats };
