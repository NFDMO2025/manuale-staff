const { loadJson, saveJson } = require('./json-store');

const HISTORY_FILE = 'manual-history.json';
const MAX_ENTRIES = 40;

async function loadHistoryStore() {
  return loadJson(HISTORY_FILE, { entries: [], nextId: 1 });
}

async function saveHistoryStore(store) {
  await saveJson(HISTORY_FILE, store);
}

async function pushManualHistory(snapshot) {
  if (!snapshot?.data) return;

  const store = await loadHistoryStore();
  const entry = {
    id: store.nextId++,
    data: snapshot.data,
    updated_at: snapshot.updated_at || Date.now(),
    updated_by: snapshot.updated_by || 'system',
    saved_at: Date.now(),
  };

  store.entries.unshift(entry);
  if (store.entries.length > MAX_ENTRIES) {
    store.entries.length = MAX_ENTRIES;
  }

  await saveHistoryStore(store);
}

async function listManualHistory() {
  const store = await loadHistoryStore();
  return store.entries.map((entry) => ({
    id: entry.id,
    updatedAt: entry.updated_at,
    updatedBy: entry.updated_by,
    savedAt: entry.saved_at,
  }));
}

async function getManualHistoryEntry(id) {
  const store = await loadHistoryStore();
  return store.entries.find((entry) => entry.id === Number(id)) || null;
}

module.exports = {
  pushManualHistory,
  listManualHistory,
  getManualHistoryEntry,
};
