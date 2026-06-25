const bcrypt = require('bcryptjs');
const { loadJson, saveJson } = require('./json-store');

const USERS_FILE = 'users.json';

let state = {
  users: [],
  nextId: 1,
};

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    status: row.status,
    role: row.role,
    permanent: Boolean(row.permanent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserWithPassword(row) {
  if (!row) return null;
  return { ...mapUser(row), password_hash: row.password_hash };
}

function isBcrypt(hash) {
  return typeof hash === 'string' && hash.startsWith('$2');
}

function parseEnvUsers() {
  const raw = process.env.PERSISTENT_USERS || process.env.STAFF_USERS || '';
  if (!raw.trim()) return [];

  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    console.error('PERSISTENT_USERS non è JSON valido');
    return [];
  }
}

async function mergeEnvUsers() {
  const envUsers = parseEnvUsers();
  if (!envUsers.length) return;

  for (const entry of envUsers) {
    const username = String(entry.username || '').trim().toLowerCase();
    if (!username) continue;

    let passwordHash = entry.password_hash || entry.passwordHash || '';
    if (entry.password && !isBcrypt(String(entry.password))) {
      passwordHash = await bcrypt.hash(String(entry.password), 10);
    } else if (entry.password && isBcrypt(String(entry.password))) {
      passwordHash = entry.password;
    }

    if (!passwordHash) continue;

    const existing = state.users.find((u) => u.username.toLowerCase() === username);
    const now = Date.now();
    const record = {
      id: existing?.id || state.nextId++,
      username,
      password_hash: passwordHash,
      name: String(entry.name || username).trim(),
      status: entry.status || 'approved',
      role: entry.role || 'editor',
      permanent: true,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    if (existing) {
      Object.assign(existing, record);
    } else {
      state.users.push(record);
    }
  }

  state.nextId = Math.max(state.nextId, ...state.users.map((u) => u.id + 1), 1);
  await persistUsers();
}

async function loadUsers() {
  const fallback = { users: [], nextId: 1 };
  const data = await loadJson(USERS_FILE, fallback);
  state.users = data.users || [];
  state.nextId = data.nextId || 1;
  await mergeEnvUsers();
}

async function persistUsers() {
  await saveJson(USERS_FILE, { users: state.users, nextId: state.nextId });
}

async function initUsers() {
  await loadUsers();
}

async function findUserById(id) {
  return mapUser(state.users.find((u) => u.id === Number(id)));
}

async function findUserByUsername(username) {
  return mapUser(state.users.find((u) => u.username.toLowerCase() === username.toLowerCase()));
}

async function findUserWithPassword(username) {
  return mapUserWithPassword(
    state.users.find((u) => u.username.toLowerCase() === username.toLowerCase())
  );
}

async function countUsers() {
  return state.users.length;
}

async function createUser({ username, passwordHash, name, status, role, permanent = false }) {
  const normalized = username.toLowerCase();
  if (state.users.some((u) => u.username.toLowerCase() === normalized)) {
    throw new Error('Username già in uso');
  }

  const now = Date.now();
  const user = {
    id: state.nextId++,
    username: normalized,
    password_hash: passwordHash,
    name: name.trim(),
    status,
    role,
    permanent: Boolean(permanent),
    created_at: now,
    updated_at: now,
  };

  state.users.push(user);
  await persistUsers();
  return findUserById(user.id);
}

async function listUsers() {
  return state.users
    .slice()
    .sort((a, b) => b.created_at - a.created_at)
    .map(mapUser);
}

async function updateUser(id, { status, role, permanent, name, passwordHash }) {
  const user = state.users.find((u) => u.id === Number(id));
  if (!user) return null;

  if (status !== undefined) user.status = status;
  if (role !== undefined) user.role = role;
  if (permanent !== undefined) user.permanent = Boolean(permanent);
  if (name !== undefined) user.name = name.trim();
  if (passwordHash !== undefined) user.password_hash = passwordHash;
  user.updated_at = Date.now();

  await persistUsers();
  return findUserById(id);
}

async function deleteUser(id) {
  const idx = state.users.findIndex((u) => u.id === Number(id));
  if (idx === -1) return false;
  if (state.users[idx].permanent && process.env.PERSISTENT_USERS) {
    throw new Error('Utente permanente da env: rimuovilo da PERSISTENT_USERS su Render');
  }
  state.users.splice(idx, 1);
  await persistUsers();
  return true;
}

async function countAdmins() {
  return state.users.filter((u) => u.role === 'admin' && u.status === 'approved').length;
}

function exportPersistentUsersJson() {
  const permanent = state.users.filter((u) => u.permanent || u.status === 'approved');
  return JSON.stringify(
    permanent.map((u) => ({
      username: u.username,
      name: u.name,
      status: u.status,
      role: u.role,
      password_hash: u.password_hash,
    })),
    null,
    2
  );
}

module.exports = {
  initUsers,
  findUserById,
  findUserByUsername,
  findUserWithPassword,
  countUsers,
  createUser,
  listUsers,
  updateUser,
  deleteUser,
  countAdmins,
  exportPersistentUsersJson,
  reloadUsers: loadUsers,
};
