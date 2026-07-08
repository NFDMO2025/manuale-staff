const fs = require('fs');
const path = require('path');

const VIDEO_DIR = path.join(__dirname, '..', 'Video');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'denunce-config.json');
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mkv', '.mov']);

const DEFAULT_CONFIG = {
  site: {
    title: 'Denuncia Sociale',
    subtitle: 'Archivio pubblico di prove e clip',
    description: '',
    disclaimer: '',
  },
  categories: [
    {
      id: 'altro',
      label: 'Altri episodi',
      icon: 'AE',
      description: 'Clip e registrazioni varie.',
      keywords: [],
    },
  ],
  defaultCategory: 'altro',
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'clip';
}

function humanizeFileName(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractDateHint(fileName) {
  const match = String(fileName).match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function categorize(fileName, config) {
  const lower = fileName.toLowerCase();
  const categories = config.categories || [];
  const fallbackId = config.defaultCategory || 'altro';

  for (const cat of categories) {
    if (cat.id === fallbackId) continue;
    const keywords = cat.keywords || [];
    if (keywords.some((kw) => lower.includes(String(kw).toLowerCase()))) {
      return cat.id;
    }
  }

  return fallbackId;
}

function listVideoFiles() {
  if (!fs.existsSync(VIDEO_DIR)) return [];

  return fs
    .readdirSync(VIDEO_DIR)
    .filter((name) => VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .map((fileName) => {
      const fullPath = path.join(VIDEO_DIR, fileName);
      const stat = fs.statSync(fullPath);
      return { fileName, stat };
    })
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
}

function buildDenuncePayload() {
  const config = loadConfig();
  const files = listVideoFiles();

  const clips = files.map(({ fileName, stat }, index) => {
    const categoryId = categorize(fileName, config);
    const title = humanizeFileName(fileName);
    const id = `${slugify(fileName)}-${index}`;

    return {
      id,
      fileName,
      title,
      category: categoryId,
      dateHint: extractDateHint(fileName),
      modifiedAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
      url: `/Video/${encodeURIComponent(fileName)}`,
    };
  });

  const categories = (config.categories || []).map((cat) => ({
    ...cat,
    count: clips.filter((clip) => clip.category === cat.id).length,
  }));

  return {
    site: config.site,
    categories,
    clips,
    total: clips.length,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildDenuncePayload,
  VIDEO_DIR,
};
