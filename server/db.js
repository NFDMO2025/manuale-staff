const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'manuale.db');

let db;

function getDefaultManual() {
  const jsPath = path.join(__dirname, '..', 'public', 'js', 'default-data.js');
  const js = fs.readFileSync(jsPath, 'utf8');
  const objLiteral = js.replace('window.DEFAULT_MANUAL = ', '').trim().replace(/;\s*$/, '');
  return new Function(`return (${objLiteral})`)();
}

function migrateUsersTable() {
  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (!cols.length) return;

  const hasPassword = cols.some((c) => c.name === 'password_hash');
  if (hasPassword) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      role TEXT NOT NULL DEFAULT 'editor',
      created_at INTEGER NOT NULL,
      updated_at INTEGER)
    );
  `);
  // Fix typo - let me rewrite migration properly
}

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);

  const cols = db.prepare("PRAGMA table_info(users)").all();
  const hasOldSchema = cols.some((c) => c.name === 'google_id');
  const hasNewSchema = cols.some((c) => c.name === 'password_hash');

  if (hasOldSchema && !hasNewSchema) {
    db.exec('DROP TABLE IF EXISTS users');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      role TEXT NOT NULL DEFAULT 'editor',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS manual (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      updated_by TEXT
    );
  `);

  const row = db.prepare('SELECT data FROM manual WHERE id = 1').get();
  if (!row) {
    const def = getDefaultManual();
    db.prepare('INSERT INTO manual (id, data, updated_at, updated_by) VALUES (1, ?, ?, ?)').run(
      JSON.stringify(def),
      Date.now(),
      'system'
    );
  }
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    status: row.status,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findUserById(id) {
  return mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

function findUserByUsername(username) {
  return mapUser(db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username));
}

function findUserWithPassword(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
}

function countUsers() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
}

function createUser({ username, passwordHash, name, status, role }) {
  const now = Date.now();
  const result = db.prepare(
    `INSERT INTO users (username, password_hash, name, status, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(username.toLowerCase(), passwordHash, name.trim(), status, role, now, now);
  return findUserById(result.lastInsertRowid);
}

function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(mapUser);
}

function updateUserAccess(id, { status, role }) {
  const user = findUserById(id);
  if (!user) return null;

  const newStatus = status ?? user.status;
  const newRole = role ?? user.role;
  const now = Date.now();

  db.prepare('UPDATE users SET status = ?, role = ?, updated_at = ? WHERE id = ?').run(
    newStatus,
    newRole,
    now,
    id
  );
  return findUserById(id);
}

function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND status = 'approved'").get().c;
}

function getManual() {
  const row = db.prepare('SELECT data, updated_at, updated_by FROM manual WHERE id = 1').get();
  return {
    data: JSON.parse(row.data),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function saveManual(data, updatedBy) {
  const now = Date.now();
  db.prepare('UPDATE manual SET data = ?, updated_at = ?, updated_by = ? WHERE id = 1').run(
    JSON.stringify(data),
    now,
    updatedBy
  );
  return { updatedAt: now, updatedBy };
}

function resetManual(updatedBy) {
  const def = getDefaultManual();
  return saveManual(def, updatedBy);
}

module.exports = {
  initDb,
  findUserById,
  findUserByUsername,
  findUserWithPassword,
  countUsers,
  createUser,
  listUsers,
  updateUserAccess,
  countAdmins,
  getManual,
  saveManual,
  resetManual,
  getDefaultManual,
};
