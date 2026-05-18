/**
 * Zero Trust Middleware
 * Every request is verified regardless of origin.
 * No implicit trust between services.
 */

// Route → required roles map
const routePermissions = {
  'GET /users':       ['admin'],
  'DELETE /users':    ['admin'],
  'PUT /users':       ['admin', 'user'],
  'POST /data/process': ['admin', 'user'],
  'GET /data/stats':  ['admin', 'user'],
  'GET /data/alerts': ['admin'],
  'POST /data/alerts': ['admin'],
};

const zeroTrustCheck = (req, res, next) => {
  const { method, path: reqPath, user } = req;

  if (!user) {
    return res.status(401).json({ error: 'Zero Trust: identity not established.' });
  }

  // Build a normalised key e.g. "GET /users"
  const routeKey = `${method} ${reqPath.replace(/\/[a-f0-9]{24}/gi, '').replace(/\/$/, '') || '/'}`;

  // Find matching permission rule
  const matchedKey = Object.keys(routePermissions).find(k => routeKey.startsWith(k));

  if (matchedKey) {
    const allowedRoles = routePermissions[matchedKey];
    if (!allowedRoles.includes(user.role)) {
      console.warn(`[ZeroTrust] BLOCKED: user=${user.id} role=${user.role} tried ${routeKey}`);
      return res.status(403).json({
        error: 'Access denied. Insufficient privileges.',
        required: allowedRoles,
        current: user.role,
      });
    }
  }

  // Attach trust context for downstream services
  req.headers['X-Zero-Trust-Verified'] = 'true';
  req.headers['X-Request-Time'] = Date.now().toString();

  next();
};

module.exports = { zeroTrustCheck };
