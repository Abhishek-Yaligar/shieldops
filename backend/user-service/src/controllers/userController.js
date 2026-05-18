const User = require('../models/User');

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-__v').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    // Users can only fetch their own profile unless admin
    if (req.userRole !== 'admin' && req.userId !== id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const user = await User.findById(id).select('-__v');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.userRole !== 'admin' && req.userId !== id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const allowedUpdates = ['email', 'isActive'];
    if (req.userRole === 'admin') allowedUpdates.push('role');

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select('-__v');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Update failed.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed.' });
  }
};

module.exports = { getAllUsers, getUserById, updateUser, deleteUser };
