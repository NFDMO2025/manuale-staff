const state = {
  data: null,
  editing: false,
  search: '',
  modal: null,
  user: null,
  saving: false,
  authTab: 'login',
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
}

async function saveData() {
  if (state.saving || !state.data) return;
  state.saving = true;
  try {
    const result = await api('/api/manual', {
      method: 'PUT',
      body: JSON.stringify({ data: state.data }),
    });
    toast(`Salvato sul server ✓ (${result.updatedBy || 'tu'})`);
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

function matchesSearch(rule, q) {
  if (!q) return true;
  const hay = [rule.code, rule.name, rule.desc, ...(rule.sanctions || []), rule.recidiva]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
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
        <button type="button" class="mini-btn danger item-del edit-only" data-del-legend="${i}">✕</button>
        <div class="leg-label editable" data-edit="legend-label-${i}">${escapeHtml(leg.label)}</div>
        <div class="leg-desc editable" data-edit="legend-desc-${i}">${escapeHtml(leg.desc)}</div>
      </div>`
    )
    .join('');
  return `
    <div class="legend-grid">${items}</div>
    <button type="button" class="add-row-btn edit-only" id="add-legend">+ Aggiungi voce legenda</button>`;
}

function renderRuleRow(rule, si, ri, q) {
  const hit = matchesSearch(rule, q);
  if (q && !hit) return '';
  return `
    <tr class="${rule.highlight ? 'highlight' : ''} ${hit && q ? 'search-hit' : ''}" data-section="${si}" data-rule="${ri}">
      <td data-label="Regola"><span class="rule-code editable" data-edit="rule-code-${si}-${ri}">${escapeHtml(rule.code)}</span></td>
      <td data-label="Violazione"><span class="rule-name editable" data-edit="rule-name-${si}-${ri}">${escapeHtml(rule.name)}</span></td>
      <td data-label="Descrizione" class="rule-desc editable" data-edit="rule-desc-${si}-${ri}">${escapeHtml(rule.desc)}</td>
      <td data-label="Sanzione">${renderPills(rule.sanctions)}</td>
      <td data-label="Recidiva"><span class="rec-text editable" data-edit="rule-recidiva-${si}-${ri}">${escapeHtml(rule.recidiva)}</span></td>
      <td class="edit-only row-actions" data-label="">
        <button type="button" class="mini-btn" data-edit-rule="${si}-${ri}">Modifica</button>
        <button type="button" class="mini-btn danger" data-del-rule="${si}-${ri}">✕</button>
      </td>
    </tr>`;
}

function renderSection(section, si, q) {
  const rows = section.rules.map((r, ri) => renderRuleRow(r, si, ri, q)).join('');
  const visible = q ? section.rules.some((r) => matchesSearch(r, q)) : true;
  if (!visible) return '';

  const alerts = (section.alerts || [])
    .map(
      (a, ai) => `
      <div class="alert alert-${a.type}" data-alert="${si}-${ai}">
        <button type="button" class="mini-btn danger item-del edit-only" data-del-alert="${si}-${ai}">✕</button>
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
        <button type="button" class="mini-btn danger item-del edit-only" data-del-check="${i}">✕</button>
      </div>`
    )
    .join('');
  return `
    <div class="section">
      <div class="section-head">
        <div class="section-num">✓</div>
        <div class="section-title editable" data-edit="checklist-title">Checklist prima di sanzionare</div>
        <div class="section-line"></div>
      </div>
      <div class="checklist">${rows}</div>
      <button type="button" class="add-row-btn edit-only" id="add-check">+ Aggiungi punto checklist</button>
    </div>`;
}

function render() {
  if (!state.data) return;
  const q = state.search.trim().toLowerCase();
  const root = document.getElementById('app-root');

  let sectionsHtml = state.data.sections.map((s, i) => renderSection(s, i, q)).join('');
  if (q && !sectionsHtml.trim()) {
    sectionsHtml = `<div class="search-empty">Nessun risultato per "<strong>${escapeHtml(q)}</strong>"</div>`;
  }

  root.innerHTML = `
    ${renderHeader()}
    ${q ? '' : renderLegend()}
    ${sectionsHtml}
    ${q ? '' : renderChecklist()}
    ${q ? '' : `<div class="footer editable" data-edit="footer">${escapeHtml(state.data.footer)}</div>`}
    ${q ? '' : `<button type="button" class="add-row-btn edit-only" id="add-section">+ Aggiungi sezione</button>`}
  `;

  bindEvents();
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
  state.editing = !state.editing;
  document.body.classList.toggle('editing', state.editing);
  document.getElementById('toolbar').classList.toggle('editing', state.editing);
  document.getElementById('btn-save').classList.toggle('hidden', !state.editing);
  document.getElementById('btn-edit').textContent = state.editing ? '✓ Fine modifica' : '✏️ Modifica';
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
      toast('Import completato ✓');
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
    render();
    toast('Manuale ripristinato');
  } catch (err) {
    toast(err.message || 'Solo gli admin possono ripristinare');
  }
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

function updateAdminUi() {
  const isAdmin = state.user?.role === 'admin' && state.user?.status === 'approved';
  document.getElementById('btn-admin').classList.toggle('hidden', !isAdmin);
  document.getElementById('btn-reset').classList.toggle('hidden', !isAdmin);
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

function statusLabel(status) {
  if (status === 'approved') return 'Approvato';
  if (status === 'denied') return 'Negato';
  return 'In attesa';
}

function statusClass(status) {
  if (status === 'approved') return 'status-approved';
  if (status === 'denied') return 'status-denied';
  return 'status-pending';
}

async function patchUser(id, body) {
  return api(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

async function openAdminPanel() {
  closeModal();
  let users;
  try {
    users = await api('/api/admin/users');
  } catch (err) {
    toast(err.message || 'Errore caricamento utenti');
    return;
  }

  const rows = users
    .map((u) => {
      const isSelf = u.id === state.user.id;
      const actions = [];

      if (u.status === 'pending') {
        actions.push(`<button type="button" class="tb-btn tb-btn-success" data-action="approve" data-id="${u.id}">Approva</button>`);
        actions.push(`<button type="button" class="tb-btn tb-btn-danger" data-action="deny" data-id="${u.id}">Nega</button>`);
      } else if (u.status === 'approved') {
        actions.push(`<button type="button" class="tb-btn tb-btn-danger" data-action="deny" data-id="${u.id}" ${isSelf ? 'disabled' : ''}>Revoca</button>`);
      } else if (u.status === 'denied') {
        actions.push(`<button type="button" class="tb-btn tb-btn-primary" data-action="approve" data-id="${u.id}">Riapprova</button>`);
      }
      if (u.role !== 'admin') {
        actions.push(`<button type="button" class="tb-btn tb-btn-primary" data-action="admin" data-id="${u.id}">Promuovi admin</button>`);
      } else if (!isSelf) {
        actions.push(`<button type="button" class="tb-btn tb-btn-ghost" data-action="demote" data-id="${u.id}">Rimuovi admin</button>`);
      }

      return `
        <tr>
          <td>${escapeHtml(u.name)}<br><span style="color:var(--muted);font-size:11px">@${escapeHtml(u.username)}</span></td>
          <td><span class="status-pill ${statusClass(u.status)}">${statusLabel(u.status)}</span></td>
          <td>${u.role === 'admin' ? '👑 Admin' : 'Editor'}</td>
          <td class="admin-actions">${actions.join('') || '—'}</td>
        </tr>`;
    })
    .join('');

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:720px">
      <h3>Gestione accessi</h3>
      <p style="color:var(--muted);font-size:12px;margin-bottom:16px">
        Approva, nega o promuovi altri utenti ad amministratore.
      </p>
      <table class="admin-table">
        <thead><tr><th>Utente</th><th>Stato</th><th>Ruolo</th><th>Azioni</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Nessun utente</td></tr>'}</tbody>
      </table>
      <div class="modal-actions">
        <button type="button" class="tb-btn tb-btn-ghost" id="modal-cancel">Chiudi</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  state.modal = backdrop;

  backdrop.querySelector('#modal-cancel').onclick = closeModal;
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeModal();
  });

  backdrop.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      btn.disabled = true;
      try {
        if (action === 'approve') await patchUser(id, { status: 'approved' });
        else if (action === 'deny') await patchUser(id, { status: 'denied' });
        else if (action === 'admin') await patchUser(id, { role: 'admin', status: 'approved' });
        else if (action === 'demote') await patchUser(id, { role: 'editor' });
        toast('Utente aggiornato ✓');
        closeModal();
        openAdminPanel();
      } catch (err) {
        toast(err.message || 'Errore aggiornamento');
        btn.disabled = false;
      }
    });
  });
}

async function init() {
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
