require('dotenv').config();
const express = require('express');
const path = require('path');
const { buildDenuncePayload, VIDEO_DIR } = require('./denunce');

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.get('/api/denunce', (_req, res) => {
  try {
    res.json(buildDenuncePayload());
  } catch (err) {
    console.error('Denunce API error:', err.message);
    res.status(500).json({ error: 'Impossibile caricare i contenuti' });
  }
});

app.use('/Video', express.static(VIDEO_DIR, {
  setHeaders(res, filePath) {
    if (/\.(mp4|webm|mkv|mov)$/i.test(filePath)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

app.use(express.static(PUBLIC_DIR, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Denuncia Sociale -> http://localhost:${PORT}`);
  console.log(`Video folder -> ${VIDEO_DIR}`);
});
