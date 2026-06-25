const { loadJson, saveJson, getStorageInfo } = require('./json-store');

const MANUAL_FILE = 'manual.json';

function getDefaultManual() {
  const fs = require('fs');
  const path = require('path');
  const jsPath = path.join(__dirname, '..', 'public', 'js', 'default-data.js');
  const js = fs.readFileSync(jsPath, 'utf8');
  const objLiteral = js.replace('window.DEFAULT_MANUAL = ', '').trim().replace(/;\s*$/, '');
  return new Function(`return (${objLiteral})`)();
}

let manualCache = null;

async function initManual() {
  const def = getDefaultManual();
  const fallback = {
    data: def,
    updated_at: Date.now(),
    updated_by: 'system',
  };
  manualCache = await loadJson(MANUAL_FILE, fallback);
  if (!manualCache?.data) {
    manualCache = fallback;
    await saveJson(MANUAL_FILE, manualCache);
  }
}

function getStorageMode() {
  return getStorageInfo().mode;
}

async function getManual() {
  if (!manualCache) await initManual();
  return {
    data: manualCache.data,
    updatedAt: manualCache.updated_at,
    updatedBy: manualCache.updated_by,
  };
}

async function saveManual(data, updatedBy) {
  manualCache = {
    data,
    updated_at: Date.now(),
    updated_by: updatedBy,
  };
  await saveJson(MANUAL_FILE, manualCache);
  return { updatedAt: manualCache.updated_at, updatedBy: manualCache.updated_by };
}

async function resetManual(updatedBy) {
  const def = getDefaultManual();
  return saveManual(def, updatedBy);
}

async function initDb() {
  await initManual();
}

module.exports = {
  initDb,
  getStorageMode,
  getStorageInfo,
  getManual,
  saveManual,
  resetManual,
  getDefaultManual,
};
