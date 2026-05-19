const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { verifyToken } = require('./middleware/auth');
const { zeroTrustCheck } = require('./middleware/zeroTrust');
const { requestLogger } = require('./middleware/logger');
const { anomalyDetector } = require('./middleware/anomalyDetector');

const app = express();

// Security headers
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://34.66.243.163:3001', credentials: true }));
// Body parser removed to allow proxy streaming
// app.use(express.json());

// Request logging for anomaly detection
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Strict rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts.' },
});

// Health check (public)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// Auth routes (public)
app.use('/auth', authLimiter, createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/auth': '' },
  on: {
    error: (err, req, res) => res.status(502).json({ error: 'Auth service unavailable' }),
  },
}));

// Anomaly detection runs before auth to capture unauthenticated attacks
app.use(anomalyDetector);

// All routes below require JWT + Zero Trust
app.use(verifyToken);
app.use(zeroTrustCheck);

// User service proxy
app.use('/users', createProxyMiddleware({
  target: process.env.USER_SERVICE_URL || 'http://user-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/users': '/users' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    },
    error: (err, req, res) => res.status(502).json({ error: 'User service unavailable' }),
  },
}));

// Data processing service proxy
app.use('/data', createProxyMiddleware({
  target: process.env.DATA_SERVICE_URL || 'http://data-service:3003',
  changeOrigin: true,
  pathRewrite: { '^/data': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    },
    error: (err, req, res) => res.status(502).json({ error: 'Data service unavailable' }),
  },
}));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(500).json({ error: 'Internal gateway error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));

module.exports = app;
