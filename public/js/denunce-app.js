const state = {
  data: null,
  activeCategory: 'all',
  search: '',
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2400);
}

function getCategoryMap() {
  const map = new Map();
  (state.data?.categories || []).forEach((cat) => map.set(cat.id, cat));
  return map;
}

function getFilteredClips() {
  const q = state.search.trim().toLowerCase();
  const categoryMap = getCategoryMap();

  return (state.data?.clips || []).filter((clip) => {
    if (state.activeCategory !== 'all' && clip.category !== state.activeCategory) {
      return false;
    }

    if (!q) return true;

    const categoryLabel = categoryMap.get(clip.category)?.label || clip.category;
    const haystack = `${clip.title} ${clip.fileName} ${categoryLabel} ${clip.dateHint || ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

function renderHero() {
  const site = state.data.site || {};
  document.getElementById('site-title').textContent = site.title || 'Denuncia Sociale';
  document.getElementById('hero-title').textContent = site.title || 'Denuncia Sociale';
  document.getElementById('hero-sub').textContent = site.subtitle || '';
  document.getElementById('hero-desc').textContent = site.description || '';
  document.getElementById('site-disclaimer').textContent = site.disclaimer || '';
  document.getElementById('generated-at').textContent = state.data.generatedAt
    ? `Aggiornato: ${formatDate(state.data.generatedAt)}`
    : '';

  const stats = document.getElementById('hero-stats');
  const topCategory = [...(state.data.categories || [])].sort((a, b) => b.count - a.count)[0];

  stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-num">${state.data.total || 0}</div>
      <div class="stat-label">Clip totali</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${state.data.categories?.length || 0}</div>
      <div class="stat-label">Sezioni</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${topCategory?.count || 0}</div>
      <div class="stat-label">${escapeHtml(topCategory?.label || 'Top categoria')}</div>
    </div>`;
}

function renderCategories() {
  const nav = document.getElementById('category-nav');
  const allCount = state.data.total || 0;

  const allCard = `
    <button type="button" class="category-card ${state.activeCategory === 'all' ? 'active' : ''}" data-category="all">
      <span class="category-icon">ALL</span>
      <div class="category-label">Tutte le clip</div>
      <div class="category-desc">Mostra l'intero archivio video disponibile.</div>
      <div class="category-count">${allCount} clip</div>
    </button>`;

  const cards = (state.data.categories || [])
    .map(
      (cat) => `
      <button type="button" class="category-card ${state.activeCategory === cat.id ? 'active' : ''}" data-category="${escapeHtml(cat.id)}">
        <span class="category-icon">${escapeHtml(cat.icon || cat.id.slice(0, 2).toUpperCase())}</span>
        <div class="category-label">${escapeHtml(cat.label)}</div>
        <div class="category-desc">${escapeHtml(cat.description || '')}</div>
        <div class="category-count">${cat.count || 0} clip</div>
      </button>`
    )
    .join('');

  nav.innerHTML = allCard + cards;

  nav.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      render();
      document.getElementById('clip-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderContentHead(count) {
  const categoryMap = getCategoryMap();
  const active = state.activeCategory === 'all'
    ? {
        label: 'Tutte le clip',
        description: "Esplora l'archivio completo.",
      }
    : categoryMap.get(state.activeCategory) || {
        label: 'Sezione',
        description: '',
      };

  document.getElementById('active-category-title').textContent = active.label;
  document.getElementById('active-category-desc').textContent = active.description || '';
  document.getElementById('result-count').textContent = `${count} risultat${count === 1 ? 'o' : 'i'}`;
}

function renderClips(clips) {
  const grid = document.getElementById('clip-grid');
  const empty = document.getElementById('empty-state');
  const categoryMap = getCategoryMap();

  if (!clips.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = clips
    .map((clip) => {
      const category = categoryMap.get(clip.category);
      return `
        <article class="clip-card" data-clip-id="${escapeHtml(clip.id)}" tabindex="0">
          <div class="clip-thumb" aria-hidden="true"></div>
          <div class="clip-body">
            <div class="clip-tag">${escapeHtml(category?.label || clip.category)}</div>
            <h4 class="clip-title">${escapeHtml(clip.title)}</h4>
            <p class="clip-meta">${escapeHtml(clip.dateHint || formatDate(clip.modifiedAt))} · ${formatBytes(clip.sizeBytes)}</p>
          </div>
        </article>`;
    })
    .join('');

  grid.querySelectorAll('.clip-card').forEach((card) => {
    const open = () => {
      const clip = clips.find((item) => item.id === card.dataset.clipId);
      if (clip) openClipModal(clip);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

function openClipModal(clip) {
  const categoryMap = getCategoryMap();
  const category = categoryMap.get(clip.category);
  const modal = document.getElementById('video-modal');
  const video = document.getElementById('modal-video');

  document.getElementById('modal-category').textContent = category?.label || clip.category;
  document.getElementById('modal-title').textContent = clip.title;
  document.getElementById('modal-meta').textContent = `${clip.dateHint || formatDate(clip.modifiedAt)} · ${formatBytes(clip.sizeBytes)}`;
  document.getElementById('modal-file').textContent = clip.fileName;

  video.pause();
  video.removeAttribute('src');
  video.load();
  video.src = clip.url;
  modal.classList.remove('hidden');
  video.play().catch(() => {});
}

function closeClipModal() {
  const modal = document.getElementById('video-modal');
  const video = document.getElementById('modal-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  modal.classList.add('hidden');
}

function render() {
  if (!state.data) return;
  const clips = getFilteredClips();
  renderHero();
  renderCategories();
  renderContentHead(clips.length);
  renderClips(clips);
}

async function loadData() {
  const res = await fetch('/api/denunce');
  if (!res.ok) throw new Error('Errore caricamento contenuti');
  state.data = await res.json();
}

function bindEvents() {
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
  });

  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    state.activeCategory = 'all';
    state.search = '';
    document.getElementById('search-input').value = '';
    render();
  });

  document.getElementById('modal-close').addEventListener('click', closeClipModal);
  document.getElementById('video-modal').addEventListener('click', (e) => {
    if (e.target.id === 'video-modal') closeClipModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeClipModal();
  });
}

async function init() {
  bindEvents();
  try {
    await loadData();
    render();
  } catch (err) {
    document.getElementById('hero-sub').textContent = 'Errore nel caricamento dei contenuti.';
    document.getElementById('hero-desc').textContent = err.message || 'Riprova più tardi.';
    toast('Impossibile caricare le clip');
  }
}

init();
