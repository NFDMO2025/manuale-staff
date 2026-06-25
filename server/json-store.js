const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function localPath(filename) {
  return path.join(DATA_DIR, filename);
}

function readLocal(filename) {
  const file = localPath(filename);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeLocal(filename, data) {
  ensureDataDir();
  fs.writeFileSync(localPath(filename), JSON.stringify(data, null, 2), 'utf8');
}

function getGithubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'NFDMO2025/manuale-staff';
  if (!token) return null;
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  return { token, owner, name };
}

async function readGithub(filename) {
  const cfg = getGithubConfig();
  if (!cfg) return null;

  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.name}/contents/data/${filename}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub read ${filename}: ${err}`);
  }

  const payload = await res.json();
  const content = Buffer.from(payload.content, payload.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  return { data: JSON.parse(content), sha: payload.sha };
}

async function writeGithub(filename, data, sha) {
  const cfg = getGithubConfig();
  if (!cfg) return false;

  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.name}/contents/data/${filename}`;
  const body = {
    message: `Aggiorna ${filename}`,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub write ${filename}: ${err}`);
  }
  return true;
}

async function loadJson(filename, fallback) {
  ensureDataDir();

  try {
    const remote = await readGithub(filename);
    if (remote?.data) {
      writeLocal(filename, remote.data);
      return remote.data;
    }
  } catch (err) {
    console.warn(`GitHub non disponibile per ${filename}:`, err.message);
  }

  const local = readLocal(filename);
  if (local) return local;
  return fallback;
}

async function saveJson(filename, data) {
  writeLocal(filename, data);

  try {
    let sha;
    try {
      const remote = await readGithub(filename);
      sha = remote?.sha;
    } catch {
      /* nuovo file su GitHub */
    }
    const ok = await writeGithub(filename, data, sha);
    if (ok) console.log(`Salvato su GitHub: data/${filename}`);
  } catch (err) {
    console.warn(`Salvataggio GitHub fallito per ${filename}:`, err.message);
  }
}

function getStorageInfo() {
  const hasGithub = Boolean(process.env.GITHUB_TOKEN);
  const hasEnvUsers = Boolean(process.env.PERSISTENT_USERS || process.env.STAFF_USERS);
  const isProduction = process.env.NODE_ENV === 'production';

  if (hasGithub) {
    return { mode: 'github', ephemeral: false, label: 'GitHub (persistente)' };
  }
  if (hasEnvUsers) {
    return { mode: 'env', ephemeral: false, label: 'Variabili ambiente (persistente)' };
  }
  if (isProduction) {
    return { mode: 'local', ephemeral: true, label: 'Temporaneo (si resetta al riavvio)' };
  }
  return { mode: 'local', ephemeral: false, label: 'File locale' };
}

module.exports = {
  loadJson,
  saveJson,
  getStorageInfo,
  readLocal,
  writeLocal,
};
