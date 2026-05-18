// mongo-init.js — runs once when the container is first created
db = db.getSiblingDB('shieldops-auth');
db.createCollection('users');

db = db.getSiblingDB('shieldops-users');
db.createCollection('users');

db = db.getSiblingDB('shieldops-data');
db.createCollection('processeddatas');
db.createCollection('alerts');

// Seed an initial admin user (password: Admin@123 — bcrypt hash)
// Run `node scripts/hash-password.js` to regenerate for a new password.
db = db.getSiblingDB('shieldops-auth');
db.users.insertOne({
  username: 'admin',
  email: 'admin@shieldops.local',
  // bcrypt hash of 'Admin@123' with salt rounds=12
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/o.k9kBHvS',
  role: 'admin',
  isActive: true,
  failedLoginAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

print('ShieldOps databases initialised.');
