const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const { register, login, refreshToken, getProfile } = require('./controllers/authController');
const { verifyToken } = require('./middleware/auth');

const app = express();
app.use(helmet());
app.use(express.json());

// DB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/shieldops-auth')
  .then(() => console.log('Auth Service: MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Routes
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }));
app.post('/register', register);
app.post('/login', login);
app.post('/refresh', refreshToken);
app.get('/profile', verifyToken, getProfile);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));

module.exports = app;
