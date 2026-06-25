require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const {
  initDb,
  createUser,
  findUserWithPassword,
  findUserByUsername,
  countUsers,
  listUsers,
  updateUserAccess,
  findUserById,
  getManual,
  saveManual,
  resetManual,
  countAdmins,
} = require('./db');
const {
  isAdminUsername,
  hashPassword,
  verifyPassword,
  signSession,
  authMiddleware,
  requireApproved,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  validateUsername,
  validatePassword,
  validateName,
} = require('./auth');

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET mancante — aggiungilo alle variabili d\'ambiente (Render: Environment)');
  process.exit(1);
}

initDb();

async function ensureDefaultAdmin() {
  const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!username || !password) return;

  if (findUserByUsername(username)) return;

  const passwordHash = await hashPassword(password);
  createUser({
    username,
    passwordHash,
    name: process.env.ADMIN_NAME || 'Admin',
    status: 'approved',
    role: 'admin',
  });
  console.log(`✅ Account admin creato: ${username}`);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    status: user.status,
    role: user.role,
  };
}

function resolveNewUserRole(username) {
  const isFirstUser = countUsers() === 0;
  const isAdmin = isFirstUser || isAdminUsername(username);
  return {
    status: isAdmin ? 'approved' : 'pending',
    role: isAdmin ? 'admin' : 'editor',
  };
}

ensureDefaultAdmin().catch((err) => console.error('Errore creazione admin:', err.message));

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(authMiddleware);

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim();

    const userErr = validateUsername(username);
    if (userErr) return res.status(400).json({ error: userErr });
    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ error: passErr });
    const nameErr = validateName(name);
    if (nameErr) return res.status(400).json({ error: nameErr });

    if (findUserByUsername(username)) {
      return res.status(409).json({ error: 'Username già in uso' });
    }

    const { status, role } = resolveNewUserRole(username);
    const passwordHash = await hashPassword(password);
    const user = createUser({ username, passwordHash, name, status, role });

    const token = signSession(user);
    setSessionCookie(res, token);

    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registrazione fallita' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password obbligatori' });
    }

    const row = findUserWithPassword(username);
    if (!row) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const user = findUserById(row.id);
    const token = signSession(user);
    setSessionCookie(res, token);

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login fallito' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/manual', requireApproved, (_req, res) => {
  res.json(getManual());
});

app.put('/api/manual', requireApproved, (req, res) => {
  if (!req.body?.data) {
    return res.status(400).json({ error: 'Dati manuale mancanti' });
  }
  const result = saveManual(req.body.data, req.user.username);
  res.json(result);
});

app.post('/api/manual/reset', requireAdmin, (req, res) => {
  const result = resetManual(req.user.username);
  res.json({ ...result, data: getManual().data });
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  res.json(listUsers());
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, role } = req.body;

  const target = findUserById(id);
  if (!target) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  if (target.role === 'admin' && status === 'denied' && target.id === req.user.id) {
    return res.status(400).json({ error: 'Non puoi negare l\'accesso a te stesso' });
  }

  if (role === 'editor' && target.role === 'admin' && target.id === req.user.id) {
    return res.status(400).json({ error: 'Non puoi rimuovere il tuo ruolo admin' });
  }

  if (role === 'editor' && target.role === 'admin' && countAdmins() <= 1) {
    return res.status(400).json({ error: 'Deve restare almeno un amministratore' });
  }

  let newStatus = status ?? target.status;
  let newRole = role ?? target.role;

  if (role === 'admin') {
    newRole = 'admin';
    newStatus = 'approved';
  }

  const updated = updateUserAccess(id, {
    status: newStatus,
    role: newRole,
  });

  res.json(updated);
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Manuale Staff → http://localhost:${PORT}`);
  const adminUser = process.env.ADMIN_USERNAME || '(primo registrato diventa admin)';
  console.log(`👑 Admin: ${adminUser}`);
});
