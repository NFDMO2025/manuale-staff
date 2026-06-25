const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { findUserById } = require('./db');

const SALT_ROUNDS = 10;

function getAdminUsernames() {
  return (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminUsername(username) {
  return getAdminUsernames().includes(username.toLowerCase());
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signSession(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role, status: user.status },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.session;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = findUserById(payload.userId);
    if (!user) {
      req.user = null;
      return next();
    }
    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      status: user.status,
      role: user.role,
    };
    next();
  } catch {
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  next();
}

function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  if (req.user.status !== 'approved') {
    return res.status(403).json({ error: 'Accesso non approvato', status: req.user.status });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin' || req.user.status !== 'approved') {
    return res.status(403).json({ error: 'Solo gli admin possono fare questa operazione' });
  }
  next();
}

function setSessionCookie(res, token) {
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });
}

function clearSessionCookie(res) {
  res.clearCookie('session');
}

function validateUsername(username) {
  if (!username || username.length < 3 || username.length > 32) {
    return 'Username: minimo 3, massimo 32 caratteri';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username: solo lettere, numeri e underscore';
  }
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 6) {
    return 'Password: minimo 6 caratteri';
  }
  return null;
}

function validateName(name) {
  if (!name || name.trim().length < 2 || name.trim().length > 64) {
    return 'Nome: minimo 2, massimo 64 caratteri';
  }
  return null;
}

module.exports = {
  isAdminUsername,
  hashPassword,
  verifyPassword,
  signSession,
  authMiddleware,
  requireAuth,
  requireApproved,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  validateUsername,
  validatePassword,
  validateName,
};
