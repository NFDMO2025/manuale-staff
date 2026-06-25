require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDb, getStorageInfo, getManual, saveManual, resetManual } = require('./db');
const {
  initUsers,
  createUser,
  findUserWithPassword,
  findUserByUsername,
  countUsers,
  listUsers,
  updateUser,
  findUserById,
  countAdmins,
  exportPersistentUsersJson,
} = require('./users');
const {
  isAdminUsername,
  hashPassword,
  verifyPassword,
  signSession,
  authMiddleware,
  requireApproved,
  requireEditor,
  requireAdmin,
  normalizeRole,
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
  console.error('JWT_SECRET mancante — aggiungilo alle variabili d\'ambiente (Render: Environment)');
  process.exit(1);
}

async function ensureDefaultAdmin() {
  const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!username || !password) return;

  if (await findUserByUsername(username)) return;

  const passwordHash = await hashPassword(password);
  await createUser({
    username,
    passwordHash,
    name: process.env.ADMIN_NAME || 'Admin',
    status: 'approved',
    role: 'admin',
    permanent: true,
  });
  console.log(`Account admin creato: ${username}`);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    status: user.status,
    role: user.role,
    permanent: user.permanent,
    createdAt: user.createdAt,
  };
}

async function resolveNewUserRole(username) {
  const total = await countUsers();
  const isFirstUser = total === 0;
  const isAdmin = isFirstUser || isAdminUsername(username);
  return {
    status: isAdmin ? 'approved' : 'pending',
    role: isAdmin ? 'admin' : 'editor',
  };
}

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

    if (await findUserByUsername(username)) {
      return res.status(409).json({ error: 'Username già in uso' });
    }

    const { status, role } = await resolveNewUserRole(username);
    const passwordHash = await hashPassword(password);
    const user = await createUser({ username, passwordHash, name, status, role, permanent: false });

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

    const row = await findUserWithPassword(username);
    if (!row) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const user = await findUserById(row.id);
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

app.get('/api/manual', requireApproved, async (_req, res) => {
  res.json(await getManual());
});

app.put('/api/manual', requireEditor, async (req, res) => {
  if (!req.body?.data) {
    return res.status(400).json({ error: 'Dati manuale mancanti' });
  }
  const result = await saveManual(req.body.data, req.user.username);
  res.json(result);
});

app.post('/api/manual/reset', requireAdmin, async (req, res) => {
  const result = await resetManual(req.user.username);
  const manual = await getManual();
  res.json({ ...result, data: manual.data });
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  const users = await listUsers();
  const storage = getStorageInfo();
  res.json({
    users,
    meta: {
      storage: storage.mode,
      storageLabel: storage.label,
      ephemeral: storage.ephemeral,
      total: users.length,
      hasGithub: Boolean(process.env.GITHUB_TOKEN),
      hasEnvUsers: Boolean(process.env.PERSISTENT_USERS || process.env.STAFF_USERS),
    },
  });
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim();
    const role = normalizeRole(req.body.role) || 'editor';
    const status = req.body.status === 'pending' ? 'pending' : 'approved';
    const permanent = req.body.permanent !== false;

    const userErr = validateUsername(username);
    if (userErr) return res.status(400).json({ error: userErr });
    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ error: passErr });
    const nameErr = validateName(name);
    if (nameErr) return res.status(400).json({ error: nameErr });

    if (await findUserByUsername(username)) {
      return res.status(409).json({ error: 'Username già in uso' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      username,
      passwordHash,
      name,
      status,
      role,
      permanent,
    });

    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Creazione utente fallita' });
  }
});

app.get('/api/admin/users/export', requireAdmin, (_req, res) => {
  res.type('application/json').send(exportPersistentUsersJson());
});

app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, role, permanent, name, password } = req.body;

  const target = await findUserById(id);
  if (!target) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  if (name !== undefined) {
    const nameErr = validateName(name);
    if (nameErr) return res.status(400).json({ error: nameErr });
  }

  if (password) {
    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ error: passErr });
  }

  if (target.role === 'admin' && status === 'denied' && target.id === req.user.id) {
    return res.status(400).json({ error: 'Non puoi negare l\'accesso a te stesso' });
  }

  const demotingAdmin = role && role !== 'admin' && target.role === 'admin';
  if (demotingAdmin && target.id === req.user.id) {
    return res.status(400).json({ error: 'Non puoi rimuovere il tuo ruolo admin' });
  }

  if (demotingAdmin && (await countAdmins()) <= 1) {
    return res.status(400).json({ error: 'Deve restare almeno un amministratore' });
  }

  let newStatus = status ?? target.status;
  let newRole = role ?? target.role;

  if (role && !normalizeRole(role)) {
    return res.status(400).json({ error: 'Ruolo non valido' });
  }

  if (role === 'admin') {
    newRole = 'admin';
    newStatus = 'approved';
  }

  let passwordHash;
  if (password) {
    passwordHash = await hashPassword(password);
  }

  const updated = await updateUser(id, {
    status: newStatus,
    role: newRole,
    permanent: permanent === true ? true : permanent === false ? false : undefined,
    name: name !== undefined ? String(name).trim() : undefined,
    passwordHash,
  });

  res.json(publicUser(updated));
});

app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function start() {
  await initDb();
  await initUsers();
  await ensureDefaultAdmin();

  const storage = getStorageInfo();
  console.log(`Storage: ${storage.label}`);

  app.listen(PORT, () => {
    console.log(`Manuale Staff -> http://localhost:${PORT}`);
    console.log(`Admin: ${process.env.ADMIN_USERNAME || '(primo registrato)'}`);
  });
}

start().catch((err) => {
  console.error('Avvio fallito:', err);
  process.exit(1);
});
