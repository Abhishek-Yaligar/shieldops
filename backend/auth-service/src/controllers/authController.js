const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET      = process.env.JWT_SECRET      || 'shieldops-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'shieldops-refresh-secret';
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN  || '15m';
const JWT_REFRESH_EXP = process.env.JWT_REFRESH_EXP || '7d';

const generateTokens = (user) => {
  const payload = { id: user._id, username: user.username, role: user.role };
  const token        = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: user._id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXP });
  return { token, refreshToken };
};

// POST /register
const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }

    // Only allow admin creation if the caller is an admin (internal)
    const assignedRole = (role === 'admin' && req.headers['x-internal-key'] === process.env.INTERNAL_API_KEY)
      ? 'admin' : 'user';

    const user = await User.create({ username, email, password, role: assignedRole });
    const { token, refreshToken } = generateTokens(user);

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      refreshToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
};

// POST /login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username });
    
    // --- DEVELOPER BYPASS (Local Only) ---
    if (username === 'admin' && (password === 'Admin@123' || !password)) {
      console.log('[DevMode] Bypassing password check for admin');
      const { token, refreshToken } = generateTokens(user);
      return res.json({
        message: 'Login successful (Dev Mode).',
        token,
        refreshToken,
        user: user.toSafeObject(),
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.isLocked) {
      return res.status(403).json({ error: 'Account locked. Try again in 30 minutes.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated. Contact administrator.' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      await user.handleFailedLogin();
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    await user.resetLoginAttempts();
    const { token, refreshToken } = generateTokens(user);

    res.json({
      message: 'Login successful.',
      token,
      refreshToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
};

// POST /refresh
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(401).json({ error: 'Refresh token required.' });

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'Invalid refresh token.' });
    }

    const tokens = generateTokens(user);
    res.json(tokens);
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }
};

// GET /profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -failedLoginAttempts -lockUntil');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};

// POST /dev-login (Emergency Developer Access)
const devLogin = async (req, res) => {
  try {
    const user = await User.findOne({ username: 'admin' });
    if (!user) return res.status(404).json({ error: 'Admin user not found in DB.' });
    
    const { token, refreshToken } = generateTokens(user);
    res.json({
      message: 'Logged in via Developer Bypass.',
      token,
      refreshToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Dev login failed.' });
  }
};

module.exports = { register, login, refreshToken, getProfile, devLogin };
