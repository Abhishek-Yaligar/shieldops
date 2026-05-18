const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided.' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'shieldops-secret-key');
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = { verifyToken };
