const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');

const DB_PATH = path.join(__dirname, '..', 'data', 'manuale.db');

let sqlite;
let turso;
let mode = 'sqlite';

const USERS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    role TEXT NOT NULL DEFAULT 'editor',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

const MANUAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS manual (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT
  )
`;

function getDefaultManual() {
  const jsPath = path.join(__dirname, '..', 'public', 'js', 'default-data.js');
  const js = fs.readFileSync(jsPath, 'utf8');
  const objLiteral = js.replace('window.DEFAULT_MANUAL = ', '').trim().replace(/;\s*$/, '');
  return new Function(`return (${objLiteral})`)();
}

function getStorageMode() {
  return mode;
}

async function execSql(sql, args = []) {
  if (mode === 'turso') {
    return turso.execute({ sql, args });
  }
  if (args.length) return sqlite.prepare(sql).run(...args);
  return sqlite.exec(sql);
}

async function queryOne(sql, args = []) {
  if (mode === 'turso') {
    const result = await turso.execute({ sql, args });
    return result.rows[0] || null;
  }
  return sqlite.prepare(sql).get(...args) || null;
}

async function queryAll(sql, args = []) {
  if (mode === 'turso') {
    const result = await turso.execute({ sql, args });
    return result.rows;
  }
  return sqlite.prepare(sql).all(...args);
}

function rowVal(row, key) {
  if (!row) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  return row[key.toUpperCase()];
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: Number(rowVal(row, 'id')),
    username: rowVal(row, 'username'),
    name: rowVal(row, 'name'),
    status: rowVal(row, 'status'),
    role: rowVal(row, 'role'),
    createdAt: Number(rowVal(row, 'created_at')),
    updatedAt: Number(rowVal(row, 'updated_at')),
  };
}

function mapUserWithPassword(row) {
  if (!row) return null;
  return {
    ...mapUser(row),
    password_hash: rowVal(row, 'password_hash'),
  };
}

async function initDb() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    turso = createClient({ url: tursoUrl, authToken: tursoToken });
    mode = 'turso';
    console.log('Database: Turso (persistente)');
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    sqlite = new Database(DB_PATH);
    mode = 'sqlite';

    const cols = sqlite.prepare('PRAGMA table_info(users)').all();
    const hasOldSchema = cols.some((c) => c.name === 'google_id');
    const hasNewSchema = cols.some((c) => c.name === 'password_hash');
    if (hasOldSchema && !hasNewSchema) {
      sqlite.exec('DROP TABLE IF EXISTS users');
    }
    console.log('Database: SQLite locale (file data/manuale.db)');
    if (process.env.NODE_ENV === 'production') {
      console.warn('ATTENZIONE: senza Turso i dati utenti possono perdersi al riavvio del server.');
    }
  }

  await execSql(USERS_SCHEMA);
  await execSql(MANUAL_SCHEMA);

  const row = await queryOne('SELECT data FROM manual WHERE id = 1');
  if (!row) {
    const def = getDefaultManual();
    await execSql(
      'INSERT INTO manual (id, data, updated_at, updated_by) VALUES (1, ?, ?, ?)',
      [JSON.stringify(def), Date.now(), 'system']
    );
  }
}

async function findUserById(id) {
  return mapUser(await queryOne('SELECT * FROM users WHERE id = ?', [id]));
}

async function findUserByUsername(username) {
  return mapUser(await queryOne('SELECT * FROM users WHERE lower(username) = lower(?)', [username]));
}

async function findUserWithPassword(username) {
  return mapUserWithPassword(
    await queryOne('SELECT * FROM users WHERE lower(username) = lower(?)', [username])
  );
}

async function countUsers() {
  const row = await queryOne('SELECT COUNT(*) AS c FROM users');
  return Number(rowVal(row, 'c') || 0);
}

async function createUser({ username, passwordHash, name, status, role }) {
  const now = Date.now();
  const result = await execSql(
    `INSERT INTO users (username, password_hash, name, status, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [username.toLowerCase(), passwordHash, name.trim(), status, role, now, now]
  );

  const newId = mode === 'turso' ? Number(result.lastInsertRowid) : Number(result.lastInsertRowid);
  return findUserById(newId);
}

async function listUsers() {
  const rows = await queryAll('SELECT * FROM users ORDER BY created_at DESC');
  return rows.map(mapUser);
}

async function updateUserAccess(id, { status, role }) {
  const user = await findUserById(id);
  if (!user) return null;

  const newStatus = status ?? user.status;
  const newRole = role ?? user.role;
  const now = Date.now();

  await execSql('UPDATE users SET status = ?, role = ?, updated_at = ? WHERE id = ?', [
    newStatus,
    newRole,
    now,
    id,
  ]);
  return findUserById(id);
}

async function countAdmins() {
  const row = await queryOne("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND status = 'approved'");
  return Number(rowVal(row, 'c') || 0);
}

async function getManual() {
  const row = await queryOne('SELECT data, updated_at, updated_by FROM manual WHERE id = 1');
  return {
    data: JSON.parse(rowVal(row, 'data')),
    updatedAt: Number(rowVal(row, 'updated_at')),
    updatedBy: rowVal(row, 'updated_by'),
  };
}

async function saveManual(data, updatedBy) {
  const now = Date.now();
  await execSql('UPDATE manual SET data = ?, updated_at = ?, updated_by = ? WHERE id = 1', [
    JSON.stringify(data),
    now,
    updatedBy,
  ]);
  return { updatedAt: now, updatedBy };
}

async function resetManual(updatedBy) {
  const def = getDefaultManual();
  return saveManual(def, updatedBy);
}

module.exports = {
  initDb,
  getStorageMode,
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
