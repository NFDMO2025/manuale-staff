const state = {
  data: null,
  editing: false,
  search: '',
  searchFilters: { section: 'all', sanction: 'all' },
  viewMode: 'full',
  manualMeta: null,
  modal: null,
  user: null,
  saving: false,
  authTab: 'login',
  adminFilter: 'all',
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Errore ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function loadManual() {
  const result = await api('/api/manual');
  state.data = result.data;
  state.manualMeta = {
    updatedAt: result.updatedAt,
    updatedBy: result.updatedBy,
  };
  updateManualMeta();
  populateSectionFilter();
}

async function saveData() {
  if (state.saving || !state.data) return;
  state.saving = true;
  try {
    const result = await api('/api/manual', {
      method: 'PUT',
      body: JSON.stringify({ data: state.data }),
    });
    state.manualMeta = { updatedAt: result.updatedAt, updatedBy: result.updatedBy };
    updateManualMeta();
    toast(`Salvato sul server (${result.updatedBy || 'tu'})`);
  } catch (err) {
    toast(err.message || 'Errore salvataggio');
  } finally {
    state.saving = false;
  }
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pillClass(text) {
  const t = text.toUpperCase();
  if (t.includes('PERMABAN')) return 'pill-perm';
  if (t.includes('WARN')) return 'pill-g';
  if (t.includes('48H') || t.includes('24H') || t.includes('BAN')) return t.includes('3') || t.includes('7') ? 'pill-r' : 'pill-o';
  if (t.includes('WIPE') || t.includes('ANNULL') || t.includes('AZIONE')) return 'pill-b';
  if (t.includes('RICHIAMO')) return 'pill-gray';
  if (t.includes('PERMA') || t.includes('IRREVOC')) return 'pill-p';
  return 'pill-gray';
}

function renderPills(list) {
  if (!list?.length) return '—';
  return list
    .map((s) => `<span class="pill ${pillClass(s)}">${escapeHtml(s)}</span>`)
    .join('');
}

function highlightHtml(text, q) {
  if (!q) return escapeHtml(text);
  const escaped = escapeHtml(text);
  try {
    const re = new RegExp(`(${RuleUtils.escapeRegex(q)})`, 'gi');
    return escaped.replace(re, '<mark class="search-mark">$1</mark>');
  } catch {
    return escaped;
  }
}

function activeFilters() {
  return {
    query: state.search.trim().toLowerCase(),
    section: state.searchFilters.section,
    sanction: state.searchFilters.sanction,
  };
}

function hasActiveFilters(filters) {
  return Boolean(filters.query) || filters.section !== 'all' || filters.sanction !== 'all';
}

function ruleMatches(rule, section, si, filters) {
  return RuleUtils.matchesFilters(rule, section, si, filters);
}

function updateSearchCount() {
  const el = document.getElementById('search-count');
  if (!el || !state.data) return;
  const filters = activeFilters();
  if (!hasActiveFilters(filters)) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  const count = RuleUtils.countMatches(state.data, filters);
  el.textContent = `${count} risultat${count === 1 ? 'o' : 'i'}`;
  el.classList.remove('hidden');
}

function updateManualMeta() {
  const el = document.getElementById('manual-meta');
  if (!el || !state.manualMeta?.updatedAt) {
    el?.classList.add('hidden');
    return;
  }
  const when = new Date(state.manualMeta.updatedAt).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  el.textContent = `Ultimo aggiornamento: ${when} · @${state.manualMeta.updatedBy || 'system'}`;
  el.classList.remove('hidden');
}

function populateSectionFilter() {
  const select = document.getElementById('filter-section');
  if (!select || !state.data) return;
  const current = state.searchFilters.section;
  const options = ['<option value="all">Tutte le sezioni</option>']
    .concat(
      state.data.sections.map(
        (s, i) => `<option value="${i}">${escapeHtml(s.num)} — ${escapeHtml(s.title)}</option>`
      )
    )
    .join('');
  select.innerHTML = options;
  select.value = current;
}

function renderSanctionFilterPills() {
  const wrap = document.getElementById('filter-sanction-pills');
  if (!wrap) return;
  wrap.innerHTML = RuleUtils.SANCTION_FILTERS.map(
    (f) =>
      `<button type="button" class="filter-pill ${state.searchFilters.sanction === f.id ? 'active' : ''}" data-sanction="${f.id}">${f.label}</button>`
  ).join('');
  wrap.querySelectorAll('[data-sanction]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.searchFilters.sanction = btn.dataset.sanction;
      renderSanctionFilterPills();
      render();
    });
  });
}

function scrollToFirstHit() {
  requestAnimationFrame(() => {
    const hit = document.querySelector('.search-hit');
    if (hit) hit.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function renderHeader() {
  const h = state.data.header;
  return `
    <div class="header">
      <div class="header-left">
        <div class="header-badge editable" data-edit="header-icon">${escapeHtml(h.icon)}</div>
        <div>
          <div class="header-title editable" data-edit="header-title">${escapeHtml(h.title)}</div>
          <div class="header-sub editable" data-edit="header-subtitle">${escapeHtml(h.subtitle)}</div>
        </div>
      </div>
      <div class="header-stamp editable" data-edit="header-stamp">${escapeHtml(h.stamp)}</div>
    </div>`;
}

function renderLegend() {
  const items = state.data.legend
    .map(
      (leg, i) => `
      <div class="leg leg-${leg.type}" data-legend="${i}">
        <button type="button" class="mini-btn danger item-del edit-only" data-del-legend="${i}" title="Elimina">X</button>
        <div class="leg-label editable" data-edit="legend-label-${i}">${escapeHtml(leg.label)}</div>
        <div class="leg-desc editable" data-edit="legend-desc-${i}">${escapeHtml(leg.desc)}</div>
      </div>`
    )
    .join('');
  return `
    <div class="legend-grid">${items}</div>
    <button type="button" class="add-row-btn edit-only" id="add-legend">+ Aggiungi voce legenda</button>`;
}

function renderRuleRow(rule, si, ri, filters) {
  const q = filters.query;
  const hit = ruleMatches(rule, state.data.sections[si], si, filters);
  if (hasActiveFilters(filters) && !hit) return '';
  const hl = (text) => (q ? highlightHtml(text, q) : escapeHtml(text));
  return `
    <tr class="${rule.highlight ? 'highlight' : ''} ${hit && q ? 'search-hit' : ''}" data-section="${si}" data-rule="${ri}" id="rule-${si}-${ri}">
      <td data-label="Regola"><span class="rule-code editable" data-edit="rule-code-${si}-${ri}">${hl(rule.code)}</span></td>
      <td data-label="Violazione"><span class="rule-name editable" data-edit="rule-name-${si}-${ri}">${hl(rule.name)}</span></td>
      <td data-label="Descrizione" class="rule-desc editable" data-edit="rule-desc-${si}-${ri}">${hl(rule.desc)}</td>
      <td data-label="Sanzione">${renderPills(rule.sanctions)}</td>
      <td data-label="Recidiva"><span class="rec-text editable" data-edit="rule-recidiva-${si}-${ri}">${hl(rule.recidiva)}</span></td>
      <td class="edit-only row-actions" data-label="">
        <button type="button" class="mini-btn" data-edit-rule="${si}-${ri}">Modifica</button>
        <button type="button" class="mini-btn danger" data-del-rule="${si}-${ri}" title="Elimina">X</button>
      </td>
    </tr>`;
}

function renderSection(section, si, filters) {
  const rows = section.rules.map((r, ri) => renderRuleRow(r, si, ri, filters)).join('');
  const visible = hasActiveFilters(filters)
    ? section.rules.some((r) => ruleMatches(r, section, si, filters))
    : true;
  if (!visible) return '';

  const alerts = (section.alerts || [])
    .map(
      (a, ai) => `
      <div class="alert alert-${a.type}" data-alert="${si}-${ai}">
        <button type="button" class="mini-btn danger item-del edit-only" data-del-alert="${si}-${ai}" title="Elimina">X</button>
        <div class="alert-title editable" data-edit="alert-title-${si}-${ai}">${escapeHtml(a.title)}</div>
        <div class="alert-body editable" data-edit="alert-body-${si}-${ai}">${escapeHtml(a.body)}</div>
      </div>`
    )
    .join('');

  return `
    <div class="section" data-section-index="${si}">
      <div class="section-head">
        <div class="section-num editable" data-edit="section-num-${si}">${escapeHtml(section.num)}</div>
        <div class="section-title editable" data-edit="section-title-${si}">${escapeHtml(section.title)}</div>
        <div class="section-line"></div>
        <div class="section-actions edit-only">
          <button type="button" class="mini-btn danger" data-del-section="${si}">Elimina sezione</button>
        </div>
      </div>
      <table class="rules-table">
        <thead><tr>
          <th>Regola</th><th>Violazione</th><th>Descrizione</th><th>Sanzione</th><th>Recidiva</th>
          <th class="edit-only">Azioni</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="rule-desc">Nessuna regola in questa sezione.</td></tr>`}</tbody>
      </table>
      <button type="button" class="add-row-btn edit-only" data-add-rule="${si}">+ Aggiungi regola</button>
      ${alerts}
      <button type="button" class="add-row-btn edit-only" data-add-alert="${si}">+ Aggiungi nota / alert</button>
    </div>`;
}

function renderChecklist() {
  const rows = state.data.checklist
    .map(
      (text, i) => `
      <div class="check-row" data-check="${i}">
        <div class="check-n">${i + 1}</div>
        <div class="check-t editable" data-edit="check-${i}">${escapeHtml(text)}</div>
        <button type="button" class="mini-btn danger item-del edit-only" data-del-check="${i}" title="Elimina">X</button>
      </div>`
    )
    .join('');
  return `
    <div class="section">
      <div class="section-head">
        <div class="section-num section-num-check">CL</div>
        <div class="section-title editable" data-edit="checklist-title">Checklist prima di sanzionare</div>
        <div class="section-line"></div>
      </div>
      <div class="checklist">${rows}</div>
      <button type="button" class="add-row-btn edit-only" id="add-check">+ Aggiungi punto checklist</button>
    </div>`;
}

function renderQuickView(filters) {
  const groups = state.data.sections
    .map((section, si) => {
      const rules = section.rules.filter((rule) => ruleMatches(rule, section, si, filters));
      if (!rules.length) return '';
      const rows = rules
        .map((rule) => {
          const sanctions = (rule.sanctions || []).join(' · ') || '—';
          return `
            <tr class="quick-row ${rule.highlight ? 'highlight' : ''}">
              <td><span class="rule-code">${escapeHtml(rule.code)}</span></td>
              <td><span class="rule-name">${escapeHtml(rule.name)}</span></td>
              <td>${renderPills(rule.sanctions)}</td>
              <td class="quick-rec">${escapeHtml(rule.recidiva || '—')}</td>
            </tr>`;
        })
        .join('');
      return `
        <div class="quick-section">
          <div class="quick-section-head">
            <span class="section-num">${escapeHtml(section.num)}</span>
            <span class="section-title">${escapeHtml(section.title)}</span>
          </div>
          <table class="quick-table">
            <thead><tr><th>Regola</th><th>Violazione</th><th>Sanzione</th><th>Recidiva</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .filter(Boolean)
    .join('');

  if (!groups) {
    return `<div class="search-empty">Nessun risultato con i filtri attivi.</div>`;
  }

  return `<div class="quick-view">${groups}</div>`;
}

function render() {
  if (!state.data) return;
  const filters = activeFilters();
  const root = document.getElementById('app-root');
  const quickBtn = document.getElementById('btn-view-quick');

  document.body.classList.toggle('view-quick', state.viewMode === 'quick');
  quickBtn?.classList.toggle('active', state.viewMode === 'quick');
  updateSearchCount();

  if (state.viewMode === 'quick') {
    root.innerHTML = renderQuickView(filters);
    return;
  }

  let sectionsHtml = state.data.sections.map((s, i) => renderSection(s, i, filters)).join('');
  if (hasActiveFilters(filters) && !sectionsHtml.trim()) {
    sectionsHtml = `<div class="search-empty">Nessun risultato con i filtri attivi.</div>`;
  }

  const hideExtras = hasActiveFilters(filters);

  root.innerHTML = `
    ${renderHeader()}
    ${hideExtras ? '' : renderLegend()}
    ${sectionsHtml}
    ${hideExtras ? '' : renderChecklist()}
    ${hideExtras ? '' : `<div class="footer editable" data-edit="footer">${escapeHtml(state.data.footer)}</div>`}
    ${hideExtras ? '' : `<button type="button" class="add-row-btn edit-only" id="add-section">+ Aggiungi sezione</button>`}
  `;

  bindEvents();
  if (filters.query) scrollToFirstHit();
}

function bindEvents() {
  document.querySelectorAll('.editable').forEach((el) => {
    el.addEventListener('click', onEditableClick);
  });

  document.querySelectorAll('[data-edit-rule]').forEach((btn) => {
    btn.addEventListener('click', () => openRuleModal(...btn.dataset.editRule.split('-').map(Number)));
  });
  document.querySelectorAll('[data-del-rule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [si, ri] = btn.dataset.delRule.split('-').map(Number);
      state.data.sections[si].rules.splice(ri, 1);
      render();
    });
  });
  document.querySelectorAll('[data-add-rule]').forEach((btn) => {
    btn.addEventListener('click', () => openRuleModal(Number(btn.dataset.addRule), null));
  });
  document.querySelectorAll('[data-add-alert]').forEach((btn) => {
    btn.addEventListener('click', () => openAlertModal(Number(btn.dataset.addAlert), null));
  });
  document.querySelectorAll('[data-del-alert]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [si, ai] = btn.dataset.delAlert.split('-').map(Number);
      state.data.sections[si].alerts.splice(ai, 1);
      render();
    });
  });
  document.querySelectorAll('[data-del-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Eliminare questa sezione?')) return;
      state.data.sections.splice(Number(btn.dataset.delSection), 1);
      render();
    });
  });
  document.querySelectorAll('[data-del-legend]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.data.legend.splice(Number(btn.dataset.delLegend), 1);
      render();
    });
  });
  document.querySelectorAll('[data-del-check]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.data.checklist.splice(Number(btn.dataset.delCheck), 1);
      render();
    });
  });

  document.getElementById('add-legend')?.addEventListener('click', () => {
    state.data.legend.push({ type: 'g', label: 'NUOVA', desc: 'Descrizione...' });
    render();
  });
  document.getElementById('add-check')?.addEventListener('click', () => {
    state.data.checklist.push('Nuovo punto checklist...');
    render();
  });
  document.getElementById('add-section')?.addEventListener('click', () => {
    state.data.sections.push({
      num: String(state.data.sections.length + 1),
      title: 'Nuova sezione',
      rules: [],
      alerts: [],
    });
    render();
  });
}

function onEditableClick(e) {
  if (!state.editing) return;
  const key = e.currentTarget.dataset.edit;
  if (!key) return;
  openTextModal(key, e.currentTarget.textContent);
}

function setByEditKey(key, value) {
  const d = state.data;
  if (key === 'header-title') d.header.title = value;
  else if (key === 'header-subtitle') d.header.subtitle = value;
  else if (key === 'header-icon') d.header.icon = value;
  else if (key === 'header-stamp') d.header.stamp = value;
  else if (key === 'footer') d.footer = value;
  else if (key.startsWith('legend-label-')) d.legend[Number(key.split('-')[2])].label = value;
  else if (key.startsWith('legend-desc-')) d.legend[Number(key.split('-')[2])].desc = value;
  else if (key.startsWith('section-num-')) d.sections[Number(key.split('-')[2])].num = value;
  else if (key.startsWith('section-title-')) d.sections[Number(key.split('-')[2])].title = value;
  else if (key.startsWith('rule-code-')) {
    const p = key.split('-');
    d.sections[Number(p[2])].rules[Number(p[3])].code = value;
  } else if (key.startsWith('rule-name-')) {
    const p = key.split('-');
    d.sections[Number(p[2])].rules[Number(p[3])].name = value;
  } else if (key.startsWith('rule-desc-')) {
    const p = key.split('-');
    d.sections[Number(p[2])].rules[Number(p[3])].desc = value;
  } else if (key.startsWith('rule-recidiva-')) {
    const p = key.split('-');
    d.sections[Number(p[2])].rules[Number(p[3])].recidiva = value;
  } else if (key.startsWith('alert-title-')) {
    const p = key.split('-');
    d.sections[Number(p[2])].alerts[Number(p[3])].title = value;
  } else if (key.startsWith('alert-body-')) {
    const p = key.split('-');
    d.sections[Number(p[2])].alerts[Number(p[3])].body = value;
  } else if (key.startsWith('check-')) d.checklist[Number(key.split('-')[1])] = value;
}

function openTextModal(key, current) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3>Modifica testo</h3>
      <label>Contenuto</label>
      <textarea id="modal-text">${escapeHtml(current)}</textarea>
      <div class="modal-actions">
        <button type="button" class="tb-btn tb-btn-ghost" id="modal-cancel">Annulla</button>
        <button type="button" class="tb-btn tb-btn-primary" id="modal-ok">Applica</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  state.modal = backdrop;
  backdrop.querySelector('#modal-cancel').onclick = closeModal;
  backdrop.querySelector('#modal-ok').onclick = () => {
    setByEditKey(key, backdrop.querySelector('#modal-text').value.trim());
    closeModal();
    render();
  };
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeModal();
  });
}

function openRuleModal(si, ri) {
  closeModal();
  const isNew = ri === null;
  const rule = isNew
    ? { code: '', name: '', desc: '', sanctions: ['WARN 1°'], recidiva: '—', highlight: false }
    : clone(state.data.sections[si].rules[ri]);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3>${isNew ? 'Nuova regola' : 'Modifica regola'}</h3>
      <label>Codice regola</label>
      <input id="m-code" value="${escapeHtml(rule.code)}">
      <label>Violazione</label>
      <input id="m-name" value="${escapeHtml(rule.name)}">
      <label>Descrizione</label>
      <textarea id="m-desc">${escapeHtml(rule.desc)}</textarea>
      <label>Sanzioni (una per riga)</label>
      <textarea id="m-sanctions">${escapeHtml((rule.sanctions || []).join('\n'))}</textarea>
      <label>Recidiva</label>
      <input id="m-recidiva" value="${escapeHtml(rule.recidiva)}">
      <label><input type="checkbox" id="m-highlight" ${rule.highlight ? 'checked' : ''}> Evidenzia riga (viola)</label>
      <div class="modal-actions">
        <button type="button" class="tb-btn tb-btn-ghost" id="modal-cancel">Annulla</button>
        <button type="button" class="tb-btn tb-btn-primary" id="modal-ok">Salva regola</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  state.modal = backdrop;
  backdrop.querySelector('#modal-cancel').onclick = closeModal;
  backdrop.querySelector('#modal-ok').onclick = () => {
    const updated = {
      code: backdrop.querySelector('#m-code').value.trim(),
      name: backdrop.querySelector('#m-name').value.trim(),
      desc: backdrop.querySelector('#m-desc').value.trim(),
      sanctions: backdrop.querySelector('#m-sanctions').value.split('\n').map((s) => s.trim()).filter(Boolean),
      recidiva: backdrop.querySelector('#m-recidiva').value.trim() || '—',
      highlight: backdrop.querySelector('#m-highlight').checked,
    };
    if (isNew) state.data.sections[si].rules.push(updated);
    else state.data.sections[si].rules[ri] = updated;
    closeModal();
    render();
  };
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeModal();
  });
}

function openAlertModal(si, ai) {
  closeModal();
  const isNew = ai === null;
  const alert = isNew ? { type: 'b', title: '', body: '' } : clone(state.data.sections[si].alerts[ai]);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3>${isNew ? 'Nuova nota' : 'Modifica nota'}</h3>
      <label>Tipo</label>
      <select id="m-type">
        <option value="r" ${alert.type === 'r' ? 'selected' : ''}>Rosso</option>
        <option value="o" ${alert.type === 'o' ? 'selected' : ''}>Arancione</option>
        <option value="b" ${alert.type === 'b' ? 'selected' : ''}>Blu</option>
      </select>
      <label>Titolo</label>
      <input id="m-title" value="${escapeHtml(alert.title)}">
      <label>Testo</label>
      <textarea id="m-body">${escapeHtml(alert.body)}</textarea>
      <div class="modal-actions">
        <button type="button" class="tb-btn tb-btn-ghost" id="modal-cancel">Annulla</button>
        <button type="button" class="tb-btn tb-btn-primary" id="modal-ok">Salva</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  state.modal = backdrop;
  backdrop.querySelector('#modal-cancel').onclick = closeModal;
  backdrop.querySelector('#modal-ok').onclick = () => {
    const updated = {
      type: backdrop.querySelector('#m-type').value,
      title: backdrop.querySelector('#m-title').value.trim(),
      body: backdrop.querySelector('#m-body').value.trim(),
    };
    if (!state.data.sections[si].alerts) state.data.sections[si].alerts = [];
    if (isNew) state.data.sections[si].alerts.push(updated);
    else state.data.sections[si].alerts[ai] = updated;
    closeModal();
    render();
  };
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeModal();
  });
}

function closeModal() {
  state.modal?.remove();
  state.modal = null;
}

function toggleEdit() {
  if (!canEditManual()) {
    toast('Il tuo ruolo consente solo la visualizzazione');
    return;
  }
  state.editing = !state.editing;
  document.body.classList.toggle('editing', state.editing);
  document.getElementById('toolbar').classList.toggle('editing', state.editing);
  document.getElementById('btn-save').classList.toggle('hidden', !state.editing);
  document.getElementById('btn-edit').textContent = state.editing ? 'Fine modifica' : 'Modifica';
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'manuale_sanzioni_staff.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('JSON esportato');
}

async function importJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      state.data = JSON.parse(reader.result);
      await saveData();
      render();
      toast('Import completato');
    } catch {
      toast('File JSON non valido');
    }
  };
  reader.readAsText(file);
}

async function resetData() {
  if (!confirm('Ripristinare il manuale originale? Tutti vedranno la versione predefinita.')) return;
  try {
    const result = await api('/api/manual/reset', { method: 'POST' });
    state.data = result.data;
    state.manualMeta = { updatedAt: result.updatedAt, updatedBy: result.updatedBy };
    updateManualMeta();
    render();
    toast('Manuale ripristinato');
  } catch (err) {
    toast(err.message || 'Solo gli admin possono ripristinare');
  }
}

function toggleQuickView() {
  state.viewMode = state.viewMode === 'quick' ? 'full' : 'quick';
  const btn = document.getElementById('btn-view-quick');
  if (btn) {
    btn.textContent = state.viewMode === 'quick' ? 'Manuale completo' : 'Consultazione rapida';
  }
  render();
}

function openCalculatorModal() {
  closeModal();
  const codes = RuleUtils.flattenRules(state.data).map(({ rule }) => rule.code);
  const datalist = codes.map((c) => `<option value="${escapeHtml(c)}">`).join('');

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal calc-modal">
      <h3>Calcolatore recidiva</h3>
      <p class="calc-intro">Inserisci codice regola e numero infrazione per ottenere la sanzione suggerita.</p>
      <form id="calc-form" class="admin-create-form">
        <div class="admin-create-grid">
          <div>
            <label>Codice regola</label>
            <input name="code" list="rule-codes" required placeholder="Es. 1.11">
            <datalist id="rule-codes">${datalist}</datalist>
          </div>
          <div>
            <label>Numero infrazione</label>
            <input name="offense" type="number" min="1" max="20" value="1" required>
          </div>
        </div>
        <button type="submit" class="tb-btn tb-btn-primary">Calcola sanzione</button>
      </form>
      <div id="calc-result" class="calc-result hidden"></div>
      <div class="modal-actions">
        <button type="button" class="tb-btn tb-btn-soft" id="modal-cancel">Chiudi</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  state.modal = backdrop;

  backdrop.querySelector('#modal-cancel').onclick = closeModal;
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeModal();
  });

  backdrop.querySelector('#calc-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const code = String(fd.get('code') || '').trim();
    const offense = fd.get('offense');
    const found = RuleUtils.findRuleByCode(state.data, code);
    const resultEl = backdrop.querySelector('#calc-result');

    if (!found) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `<div class="calc-error">Regola "${escapeHtml(code)}" non trovata.</div>`;
      return;
    }

    const calc = RuleUtils.calculateSanction(found.rule, found.section, offense);
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="calc-card">
        <div class="calc-rule">${escapeHtml(found.rule.code)} — ${escapeHtml(found.rule.name)}</div>
        <div class="calc-sanction">${renderPills([calc.sanction])}</div>
        <div class="calc-meta">
          <span>Infrazione ${calc.level}ª</span>
          <span>${escapeHtml(calc.source)}</span>
        </div>
        ${calc.note ? `<p class="calc-note">${escapeHtml(calc.note)}</p>` : ''}
        ${calc.next ? `<p class="calc-next">Prossima: <strong>${escapeHtml(calc.next)}</strong></p>` : ''}
        <button type="button" class="tb-btn tb-btn-soft calc-goto" data-si="${found.si}" data-ri="${found.ri}">Vai alla regola</button>
      </div>`;

    resultEl.querySelector('.calc-goto')?.addEventListener('click', () => {
      closeModal();
      state.viewMode = 'full';
      document.getElementById('btn-view-quick').textContent = 'Consultazione rapida';
      state.search = found.rule.code;
      document.getElementById('search-input').value = found.rule.code;
      render();
    });
  };
}

async function openHistoryModal() {
  closeModal();
  let entries = [];
  try {
    const result = await api('/api/manual/history');
    entries = result.entries || [];
  } catch (err) {
    toast(err.message || 'Errore caricamento storico');
    return;
  }

  const canRestore = canEditManual();
  const rows = entries.length
    ? entries
        .map((entry) => {
          const when = new Date(entry.updatedAt || entry.savedAt).toLocaleString('it-IT', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          return `
            <tr>
              <td class="history-date">${when}</td>
              <td>@${escapeHtml(entry.updatedBy || 'system')}</td>
              <td class="history-actions">
                ${canRestore ? `<button type="button" class="tb-btn tb-btn-soft" data-restore="${entry.id}">Ripristina</button>` : ''}
              </td>
            </tr>`;
        })
        .join('')
    : `<tr><td colspan="3" class="admin-empty">Nessuna versione salvata ancora.</td></tr>`;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal history-modal">
      <h3>Storico modifiche</h3>
      <p class="admin-intro">Ultime ${entries.length} versioni del manuale. Ogni salvataggio crea una voce.</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Data</th><th>Modificato da</th><th>Azioni</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="modal-actions">
        <button type="button" class="tb-btn tb-btn-soft" id="modal-cancel">Chiudi</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  state.modal = backdrop;

  backdrop.querySelector('#modal-cancel').onclick = closeModal;
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeModal();
  });

  backdrop.querySelectorAll('[data-restore]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Ripristinare questa versione del manuale?')) return;
      btn.disabled = true;
      try {
        const result = await api(`/api/manual/history/${btn.dataset.restore}/restore`, { method: 'POST' });
        state.data = result.data;
        state.manualMeta = { updatedAt: result.updatedAt, updatedBy: result.updatedBy };
        updateManualMeta();
        closeModal();
        render();
        toast('Versione ripristinata');
      } catch (err) {
        toast(err.message || 'Ripristino fallito');
        btn.disabled = false;
      }
    });
  });
}

/* ── Auth ── */

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

function setAuthView(mode) {
  const authScreen = document.getElementById('auth-screen');
  const mainApp = document.getElementById('main-app');
  const authForms = document.getElementById('auth-forms');
  const pending = document.getElementById('auth-user-pending');
  const denied = document.getElementById('auth-user-denied');
  const authMsg = document.getElementById('auth-message');

  document.body.classList.toggle('auth-mode', mode !== 'app');

  if (mode === 'app') {
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    return;
  }

  authScreen.classList.remove('hidden');
  mainApp.classList.add('hidden');
  authForms.classList.toggle('hidden', mode !== 'login' && mode !== 'register');
  pending.classList.toggle('hidden', mode !== 'pending');
  denied.classList.toggle('hidden', mode !== 'denied');

  if (mode === 'login' || mode === 'register') {
    authMsg.textContent = mode === 'login' ? 'Accedi al manuale staff' : 'Crea un account staff';
    showAuthError('');
    setAuthTab(mode);
  } else if (mode === 'pending') {
    authMsg.textContent = 'Accesso in attesa';
    document.getElementById('pending-username').textContent = `@${state.user?.username || ''}`;
  } else if (mode === 'denied') {
    authMsg.textContent = 'Accesso negato';
    document.getElementById('denied-username').textContent = `@${state.user?.username || ''}`;
  }
}

function setAuthTab(tab) {
  state.authTab = tab;
  document.querySelectorAll('.auth-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
}

function updateUserChip() {
  const chip = document.getElementById('user-chip');
  if (!state.user) {
    chip.innerHTML = '';
    return;
  }
  chip.innerHTML = `<span>@${escapeHtml(state.user.username)}</span>`;
  chip.title = state.user.name;
}

function canEditManual() {
  return state.user?.status === 'approved'
    && (state.user.role === 'admin' || state.user.role === 'editor');
}

function roleLabel(role) {
  if (role === 'admin') return 'Amministratore';
  if (role === 'watcher') return 'Watcher';
  return 'Editor';
}

function updateAdminUi() {
  const isAdmin = state.user?.role === 'admin' && state.user?.status === 'approved';
  const canEdit = canEditManual();

  document.getElementById('btn-admin').classList.toggle('hidden', !isAdmin);
  document.getElementById('btn-reset').classList.toggle('hidden', !isAdmin);
  document.getElementById('btn-edit').classList.toggle('hidden', !canEdit);
  document.getElementById('btn-import').classList.toggle('hidden', !canEdit);

  if (!canEdit && state.editing) {
    state.editing = false;
    document.body.classList.remove('editing');
    document.getElementById('toolbar').classList.remove('editing');
    document.getElementById('btn-save').classList.add('hidden');
    document.getElementById('btn-edit').textContent = 'Modifica';
  }
}

async function submitLogin(e) {
  e.preventDefault();
  showAuthError('');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    state.user = result.user;
    await applyUserState();
  } catch (err) {
    showAuthError(err.message || 'Login fallito');
  }
}

async function submitRegister(e) {
  e.preventDefault();
  showAuthError('');
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  try {
    const result = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, password }),
    });
    state.user = result.user;
    await applyUserState();
  } catch (err) {
    showAuthError(err.message || 'Registrazione fallita');
  }
}

async function refreshSession() {
  try {
    const result = await api('/api/auth/me');
    state.user = result.user;
    return true;
  } catch {
    state.user = null;
    return false;
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  state.user = null;
  state.data = null;
  state.editing = false;
  setAuthView('login');
}

async function applyUserState() {
  if (!state.user) {
    setAuthView('login');
    return;
  }

  if (state.user.status === 'approved') {
    updateUserChip();
    updateAdminUi();
    setAuthView('app');
    await loadManual();
    render();
    return;
  }

  if (state.user.status === 'pending') {
    setAuthView('pending');
    return;
  }

  setAuthView('denied');
}

async function patchUser(id, body) {
  return api(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function accessSummary(user) {
  if (user.status === 'approved') {
    if (user.role === 'admin') {
      return { label: 'Accesso attivo', sub: 'Amministratore', class: 'access-full' };
    }
    if (user.role === 'watcher') {
      return { label: 'Accesso attivo', sub: 'Solo lettura', class: 'access-readonly' };
    }
    return { label: 'Accesso attivo', sub: 'Editor', class: 'access-yes' };
  }
  if (user.status === 'pending') {
    return { label: 'In attesa', sub: 'Non ancora approvato', class: 'access-pending' };
  }
  return { label: 'Nessun accesso', sub: 'Account bloccato', class: 'access-no' };
}

function userMatchesFilter(user, filter) {
  if (filter === 'all') return true;
  if (filter === 'active') return user.status === 'approved';
  if (filter === 'pending') return user.status === 'pending';
  if (filter === 'blocked') return user.status === 'denied';
  if (filter === 'admin') return user.role === 'admin' && user.status === 'approved';
  if (filter === 'watcher') return user.role === 'watcher' && user.status === 'approved';
  if (filter === 'editor') return user.role === 'editor' && user.status === 'approved';
  return true;
}

function buildUserActions(u, currentUserId) {
  const isSelf = u.id === currentUserId;
  const actions = [
    `<button type="button" class="tb-btn tb-btn-primary" data-action="edit" data-id="${u.id}">Modifica</button>`,
  ];

  if (u.status === 'pending') {
    actions.push(`<button type="button" class="tb-btn tb-btn-success" data-action="approve" data-id="${u.id}">Approva</button>`);
    actions.push(`<button type="button" class="tb-btn tb-btn-danger" data-action="deny" data-id="${u.id}">Nega</button>`);
  } else if (u.status === 'approved' && !isSelf) {
    actions.push(`<button type="button" class="tb-btn tb-btn-danger" data-action="deny" data-id="${u.id}">Rimuovi accesso</button>`);
  } else if (u.status === 'denied') {
    actions.push(`<button type="button" class="tb-btn tb-btn-soft" data-action="approve" data-id="${u.id}">Ripristina</button>`);
  }

  return actions;
}

function openEditUserModal(user, onSaved) {
  const isSelf = user.id === state.user.id;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop modal-backdrop-top';
  backdrop.innerHTML = `
    <div class="modal admin-edit-modal">
      <h3>Modifica utente</h3>
      <p class="admin-edit-sub">@${escapeHtml(user.username)}${isSelf ? ' <span class="admin-you">(tu)</span>' : ''}</p>
      <form id="edit-user-form" class="admin-create-form">
        <div class="admin-create-grid">
          <div>
            <label>Nome visualizzato</label>
            <input name="name" required maxlength="64" value="${escapeHtml(user.name)}">
          </div>
          <div>
            <label>Ruolo</label>
            <select name="role">
              <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
              <option value="watcher" ${user.role === 'watcher' ? 'selected' : ''}>Watcher (solo lettura)</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Amministratore</option>
            </select>
          </div>
          <div>
            <label>Accesso al sito</label>
            <select name="status" ${isSelf ? 'disabled' : ''}>
              <option value="approved" ${user.status === 'approved' ? 'selected' : ''}>Approvato</option>
              <option value="pending" ${user.status === 'pending' ? 'selected' : ''}>In attesa</option>
              <option value="denied" ${user.status === 'denied' ? 'selected' : ''}>Negato</option>
            </select>
          </div>
          <div>
            <label>Nuova password</label>
            <input name="password" type="password" minlength="6" placeholder="Lascia vuoto per non cambiare" autocomplete="new-password">
          </div>
        </div>
        <label class="admin-check">
          <input type="checkbox" name="permanent" ${user.permanent ? 'checked' : ''}>
          Segna come utente permanente
        </label>
        <div class="modal-actions">
          <button type="button" class="tb-btn tb-btn-soft" id="edit-cancel">Annulla</button>
          <button type="submit" class="tb-btn tb-btn-primary">Salva modifiche</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  backdrop.querySelector('#edit-cancel').onclick = close;
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });

  backdrop.querySelector('#edit-user-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      name: fd.get('name'),
      role: fd.get('role'),
      status: isSelf ? user.status : fd.get('status'),
      permanent: fd.get('permanent') === 'on',
    };
    const password = String(fd.get('password') || '');
    if (password) body.password = password;

    try {
      await patchUser(user.id, body);
      toast('Utente aggiornato');
      close();
      onSaved?.();
    } catch (err) {
      toast(err.message || 'Errore salvataggio');
    }
  };
}

async function openAdminPanel(filter) {
  if (filter) state.adminFilter = filter;
  closeModal();
  let users;
  let meta = {};
  try {
    const result = await api('/api/admin/users');
    users = result.users || result;
    meta = result.meta || {};
  } catch (err) {
    toast(err.message || 'Errore caricamento utenti');
    return;
  }

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'approved').length,
    admins: users.filter((u) => u.role === 'admin' && u.status === 'approved').length,
    editors: users.filter((u) => u.role === 'editor' && u.status === 'approved').length,
    watchers: users.filter((u) => u.role === 'watcher' && u.status === 'approved').length,
    pending: users.filter((u) => u.status === 'pending').length,
    blocked: users.filter((u) => u.status === 'denied').length,
  };

  const filtered = users.filter((u) => userMatchesFilter(u, state.adminFilter));

  const rows = filtered
    .map((u) => {
      const access = accessSummary(u);
      const actions = buildUserActions(u, state.user.id);
      const you = u.id === state.user.id ? ' <span class="admin-you">(tu)</span>' : '';

      return `
        <tr class="admin-row admin-row-${u.status}">
          <td>
            <div class="admin-user-name">${escapeHtml(u.name)}${you}${u.permanent ? ' <span class="admin-permanent">permanente</span>' : ''}</div>
            <div class="admin-user-handle">@${escapeHtml(u.username)}</div>
          </td>
          <td>
            <span class="access-badge ${access.class}">${access.label}</span>
            <div class="admin-access-sub">${access.sub}</div>
          </td>
          <td>
            <span class="role-badge role-${u.role}">${roleLabel(u.role)}</span>
          </td>
          <td class="admin-date">${formatDate(u.createdAt)}</td>
          <td class="admin-actions">${actions.join('') || '<span class="admin-no-action">—</span>'}</td>
        </tr>`;
    })
    .join('');

  const filters = [
    { id: 'all', label: 'Tutti', count: stats.total },
    { id: 'active', label: 'Con accesso', count: stats.active },
    { id: 'admin', label: 'Amministratori', count: stats.admins },
    { id: 'editor', label: 'Editor', count: stats.editors },
    { id: 'watcher', label: 'Watcher', count: stats.watchers },
    { id: 'pending', label: 'In attesa', count: stats.pending },
    { id: 'blocked', label: 'Senza accesso', count: stats.blocked },
  ];

  const filterHtml = filters
    .map(
      (f) =>
        `<button type="button" class="admin-filter-btn ${state.adminFilter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label} <span class="admin-filter-count">${f.count}</span></button>`
    )
    .join('');

  let storageNotice = '';
  if (meta.ephemeral) {
    storageNotice = `<div class="admin-warning">
      Su Render gli utenti possono sparire al riavvio del server.
      Dopo aver modificato un account, usa <strong>Esporta JSON</strong> e incolla il risultato in
      <code>PERSISTENT_USERS</code> su Render, oppure configura <code>GITHUB_TOKEN</code> per salvare automaticamente.
    </div>`;
  } else if (meta.hasGithub) {
    storageNotice = `<div class="admin-info">Salvataggio persistente attivo via GitHub.</div>`;
  } else if (meta.hasEnvUsers) {
    storageNotice = `<div class="admin-info">Utenti permanenti caricati da PERSISTENT_USERS.</div>`;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal admin-modal">
      <h3>Gestione accessi</h3>
      <p class="admin-intro">
        Elenco completo degli account (${meta.total ?? users.length} totali).
        Clicca <strong>Modifica</strong> per cambiare nome, ruolo, accesso o password.
      </p>
      ${storageNotice}

      <div class="admin-stats">
        <div class="admin-stat">
          <span class="admin-stat-num">${stats.active}</span>
          <span class="admin-stat-label">Con accesso</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-num">${stats.admins}</span>
          <span class="admin-stat-label">Amministratori</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-num">${stats.pending}</span>
          <span class="admin-stat-label">In attesa</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-num">${stats.blocked}</span>
          <span class="admin-stat-label">Bloccati</span>
        </div>
      </div>

      <div class="admin-filters">${filterHtml}</div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Utente</th>
              <th>Accesso al sito</th>
              <th>Ruolo</th>
              <th>Registrato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="5" class="admin-empty">Nessun utente in questa categoria</td></tr>`}</tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button type="button" class="tb-btn tb-btn-soft" id="btn-export-users">Esporta JSON</button>
        <button type="button" class="tb-btn tb-btn-soft" id="modal-cancel">Chiudi</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  state.modal = backdrop;

  backdrop.querySelector('#modal-cancel').onclick = closeModal;
  backdrop.querySelector('#btn-export-users').onclick = async () => {
    try {
      const res = await fetch('/api/admin/users/export', { credentials: 'include' });
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast('JSON copiato — incollalo in PERSISTENT_USERS su Render');
    } catch {
      toast('Errore export');
    }
  };
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeModal();
  });

  backdrop.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAdminPanel(btn.dataset.filter);
    });
  });

  backdrop.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      const name = users.find((u) => u.id === id)?.name || 'utente';

      if (action === 'deny' && !confirm(`Rimuovere l'accesso a ${name}? Non potrà più usare il manuale.`)) {
        return;
      }

      btn.disabled = true;
      try {
        if (action === 'edit') {
          const u = users.find((x) => x.id === id);
          if (u) openEditUserModal(u, () => openAdminPanel(state.adminFilter));
          btn.disabled = false;
          return;
        }
        if (action === 'approve') await patchUser(id, { status: 'approved' });
        else if (action === 'deny') await patchUser(id, { status: 'denied' });
        toast('Utente aggiornato');
        openAdminPanel(state.adminFilter);
      } catch (err) {
        toast(err.message || 'Errore aggiornamento');
        btn.disabled = false;
      }
    });
  });
}

async function init() {
  renderSanctionFilterPills();
  document.getElementById('btn-edit').addEventListener('click', toggleEdit);
  document.getElementById('btn-save').addEventListener('click', saveData);
  document.getElementById('btn-export').addEventListener('click', exportJson);
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importJson(file);
    e.target.value = '';
  });
  document.getElementById('btn-reset').addEventListener('click', resetData);
  document.getElementById('btn-view-quick').addEventListener('click', toggleQuickView);
  document.getElementById('btn-calculator').addEventListener('click', openCalculatorModal);
  document.getElementById('btn-history').addEventListener('click', openHistoryModal);
  document.getElementById('filter-section').addEventListener('change', (e) => {
    state.searchFilters.section = e.target.value;
    render();
  });
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
  });
  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('btn-logout-pending').addEventListener('click', logout);
  document.getElementById('btn-logout-denied').addEventListener('click', logout);
  document.getElementById('btn-check-pending').addEventListener('click', async () => {
    if (await refreshSession()) await applyUserState();
    else toast('Sessione scaduta — accedi di nuovo');
  });
  document.getElementById('btn-admin').addEventListener('click', openAdminPanel);
  document.getElementById('form-login').addEventListener('submit', submitLogin);
  document.getElementById('form-register').addEventListener('submit', submitRegister);
  document.querySelectorAll('.auth-tab').forEach((btn) => {
    btn.addEventListener('click', () => setAuthView(btn.dataset.tab));
  });

  const loggedIn = await refreshSession();
  if (loggedIn) {
    await applyUserState();
  } else {
    setAuthView('login');
  }
}

init();
