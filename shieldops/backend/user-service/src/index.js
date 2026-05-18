const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const { getAllUsers, getUserById, updateUser, deleteUser } = require('./controllers/userController');
const { requireRole } = require('./middleware/rbac');

const app = express();
app.use(helmet());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/shieldops-users')
  .then(() => console.log('User Service: MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Trust headers from API Gateway
app.use((req, res, next) => {
  req.userId   = req.headers['x-user-id'];
  req.userRole = req.headers['x-user-role'];
  if (!req.userId) return res.status(401).json({ error: 'Missing user context from gateway.' });
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-service' }));

app.get('/users',             requireRole('admin'), getAllUsers);
app.get('/users/:id',         getUserById);
app.put('/users/:id',         updateUser);
app.delete('/users/:id',      requireRole('admin'), deleteUser);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`User Service running on port ${PORT}`));

module.exports = app;
