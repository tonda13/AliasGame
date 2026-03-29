// ==============================================
// js/screen-cards.js – Cards editor screen
// ==============================================
import { API, apiFetch } from './api.js';
import { toast, showConfirm, getCategoryIcon, getCategoryLabel, getDiffLabel } from './helpers.js';
import { showScreen } from './navigation.js';

let cardsFilter  = { group: '', category: '', search: '' };
let allCards     = [];
let editingCardId = null;

export async function loadCards() {
  const params = new URLSearchParams();
  if (cardsFilter.group)    params.set('group',    cardsFilter.group);
  if (cardsFilter.category) params.set('category', cardsFilter.category);
  allCards = await apiFetch(`${API.cards}?${params}`);
  renderCardsTable();
  loadCardFilterGroups();
}

async function loadCardFilterGroups() {
  const groups = await apiFetch(`${API.cards}?action=groups`);
  const sel = document.getElementById('filterGroup');
  sel.innerHTML = '<option value="">Všechny skupiny</option>';
  groups.forEach(g => {
    sel.insertAdjacentHTML('beforeend', `<option value="${g.group_name}">${g.group_name} (${g.card_count})</option>`);
  });
  sel.value = cardsFilter.group;

  const dl = document.getElementById('groupSuggestions');
  if (dl) {
    dl.innerHTML = '';
    groups.forEach(g => dl.insertAdjacentHTML('beforeend', `<option value="${g.group_name}">`));
  }
}

function renderCardsTable() {
  const search = cardsFilter.search.toLowerCase();
  const cards  = search
    ? allCards.filter(c => c.term.toLowerCase().includes(search) || c.hint?.toLowerCase().includes(search))
    : allCards;

  // ── Desktop tabulka ──
  const tbody = document.getElementById('cardsTableBody');
  tbody.innerHTML = '';
  if (!cards.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:32px">Žádné kartičky nenalezeny</td></tr>';
  } else {
    cards.forEach(c => {
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><strong>${c.term}</strong></td>
          <td style="max-width:200px; color:var(--text-muted); font-size:0.85rem">${c.hint || '—'}</td>
          <td><span class="badge badge-${c.category}">${getCategoryIcon(c.category)} ${getCategoryLabel(c.category)}</span></td>
          <td>${c.group_name}</td>
          <td><span class="badge badge-${c.difficulty}">${getDiffLabel(c.difficulty)}</span></td>
          <td>
            <div class="flex gap-8">
              <button class="btn btn-sm btn-secondary" data-edit="${c.id}">✏️</button>
              <button class="btn btn-sm btn-danger"    data-delete="${c.id}">🗑️</button>
            </div>
          </td>
        </tr>
      `);
    });
    tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openCardEditor(+b.dataset.edit)));
    tbody.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteCard(+b.dataset.delete)));
  }

  // ── Mobilní seznam ──
  const list = document.getElementById('cardsMobileList');
  if (!list) return;
  list.innerHTML = '';
  if (!cards.length) {
    list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:32px">Žádné kartičky nenalezeny</p>';
    return;
  }
  cards.forEach(c => {
    const item = document.createElement('div');
    item.className = 'cmi';
    item.innerHTML = `
      <div class="cmi-bg cmi-bg-edit">✏️ Upravit</div>
      <div class="cmi-bg cmi-bg-delete">🗑️ Smazat</div>
      <div class="cmi-content">
        <span class="cmi-icon">${getCategoryIcon(c.category)}</span>
        <div class="cmi-info">
          <div class="cmi-term">${c.term}</div>
          <div class="cmi-meta">${c.group_name} · ${'⭐'.repeat(+c.difficulty)}</div>
        </div>
        ${c.hint ? '<span class="cmi-hint-dot">💡</span>' : ''}
      </div>
    `;
    attachSwipeHandlers(item, c);
    list.appendChild(item);
  });
}

function attachSwipeHandlers(el, card) {
  const content = el.querySelector('.cmi-content');
  let startX = 0, startY = 0, deltaX = 0;
  let tracking = false, lockVertical = false, didSwipe = false;
  const THRESHOLD = 72;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    deltaX = 0;
    tracking = true;
    lockVertical = false;
    didSwipe = false;
    content.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!tracking || lockVertical) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 12) {
      lockVertical = true;
      content.style.transform = 'translateX(0)';
      return;
    }
    deltaX = dx;
    content.style.transform = `translateX(${deltaX}px)`;
  }, { passive: true });

  el.addEventListener('touchend', async () => {
    if (!tracking) return;
    tracking = false;
    content.style.transition = 'transform 0.25s ease';

    if (deltaX < -THRESHOLD) {
      didSwipe = true;
      content.style.transform = 'translateX(-110%)';
      const ok = await showConfirm(`Smazat „${card.term}"?`, '🗑️ Smazat', 'Zpět');
      if (ok) {
        await apiFetch(`${API.cards}?id=${card.id}`, { method: 'DELETE' });
        toast('Kartička smazána');
        loadCards();
      } else {
        content.style.transform = 'translateX(0)';
      }
    } else if (deltaX > THRESHOLD) {
      didSwipe = true;
      content.style.transform = 'translateX(0)';
      openCardEditor(card.id);
    } else {
      content.style.transform = 'translateX(0)';
    }
  });

  el.addEventListener('click', () => {
    if (didSwipe) { didSwipe = false; return; }
    showCardDetail(card);
  });
}

function showCardDetail(card) {
  const modal = document.getElementById('cardDetailModal');
  document.getElementById('cdIcon').textContent     = getCategoryIcon(card.category);
  document.getElementById('cdTerm').textContent     = card.term;
  document.getElementById('cdCategory').textContent = getCategoryLabel(card.category);
  document.getElementById('cdGroup').textContent    = card.group_name;
  document.getElementById('cdDifficulty').textContent = getDiffLabel(card.difficulty) + ` · ${card.points} bod${+card.points === 1 ? '' : +card.points < 5 ? 'y' : 'ů'}`;
  const hintRow = document.getElementById('cdHintRow');
  if (card.hint) {
    document.getElementById('cdHint').textContent = card.hint;
    hintRow.style.display = '';
  } else {
    hintRow.style.display = 'none';
  }
  document.getElementById('cdEditBtn').onclick = () => {
    modal.classList.remove('open');
    openCardEditor(card.id);
  };
  document.getElementById('cdDeleteBtn').onclick = () => {
    modal.classList.remove('open');
    deleteCard(card.id);
  };
  modal.classList.add('open');
}

function openCardEditor(id = null, defaultGroup = null) {
  editingCardId = id;
  const modal = document.getElementById('modalCard');
  if (id) {
    const c = allCards.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cardTerm').value        = c.term;
    document.getElementById('cardEmoji').value       = c.emoji || '';
    document.getElementById('cardHint').value        = c.hint || '';
    document.getElementById('cardCategory').value   = c.category;
    document.getElementById('cardGroup').value      = c.group_name;
    document.getElementById('cardDifficulty').value  = c.difficulty;
    document.getElementById('cardPoints').value     = c.points;
    document.getElementById('modalCardTitle').textContent = 'Upravit kartičku';
  } else {
    document.getElementById('cardEditorForm').reset();
    if (defaultGroup) document.getElementById('cardGroup').value = defaultGroup;
    document.getElementById('modalCardTitle').textContent = 'Nová kartička';
  }
  modal.classList.add('open');
}

// ── Groups management ──────────────────────────────────────────────

async function openGroupsModal() {
  await refreshGroupsList();
  document.getElementById('newGroupForm').style.display = 'none';
  document.getElementById('modalGroups').classList.add('open');
}

async function refreshGroupsList() {
  const groups = await apiFetch(`${API.cards}?action=groups`);
  renderGroupsList(groups);
}

function renderGroupsList(groups) {
  const el = document.getElementById('groupsList');
  el.innerHTML = '';
  if (!groups.length) {
    el.innerHTML = '<p class="text-muted" style="text-align:center;padding:24px 0">Žádné skupiny</p>';
    return;
  }
  groups.forEach(g => {
    const row = document.createElement('div');
    row.className = 'group-row';
    row.dataset.name = g.group_name;
    row.innerHTML = `
      <div class="group-row-info">
        <span class="group-name">${g.group_name}</span>
        <span class="text-muted" style="font-size:0.82rem">${g.card_count} kartiček</span>
      </div>
      <div class="flex gap-8" style="flex-shrink:0">
        <button class="btn btn-sm btn-secondary" data-rename="${g.group_name}">✏️</button>
        <button class="btn btn-sm btn-danger" data-delete="${g.group_name}" data-count="${g.card_count}">🗑️</button>
      </div>
    `;
    el.appendChild(row);
  });
  el.querySelectorAll('[data-rename]').forEach(b => b.addEventListener('click', () => openRenameGroup(b.dataset.rename)));
  el.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => confirmDeleteGroup(b.dataset.delete, +b.dataset.count)));
}

function openRenameGroup(oldName) {
  const row = document.querySelector(`#groupsList [data-name="${CSS.escape(oldName)}"]`);
  if (!row) return;
  const nameEl  = row.querySelector('.group-name');
  const renameBtn = row.querySelector('[data-rename]');

  const input = document.createElement('input');
  input.className = 'form-input';
  input.value = oldName;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  renameBtn.textContent = '💾';
  delete renameBtn.dataset.rename;

  const save = async () => {
    const newName = input.value.trim();
    if (!newName || newName === oldName) { await refreshGroupsList(); return; }
    try {
      await apiFetch(`${API.cards}?action=rename_group`, {
        method: 'POST',
        body: JSON.stringify({ old_name: oldName, new_name: newName }),
      });
      toast('Skupina přejmenována', 'success');
      await refreshGroupsList();
      loadCards();
    } catch (e) { toast(e.message, 'error'); }
  };

  input.addEventListener('keydown', async e => {
    if (e.key === 'Enter')  await save();
    if (e.key === 'Escape') await refreshGroupsList();
  });
  renameBtn.addEventListener('click', save);
}

async function confirmDeleteGroup(name, count) {
  if (count > 0) {
    document.getElementById('deleteGroupNameDisplay').textContent  = name;
    document.getElementById('deleteGroupCountDisplay').textContent = count;
    document.getElementById('deleteGroupConfirmInput').value       = '';
    document.getElementById('deleteGroupConfirmInput').dataset.target = name;
    document.getElementById('btnConfirmDeleteGroup').disabled      = true;
    document.getElementById('modalDeleteGroup').classList.add('open');
  } else {
    if (!await showConfirm(`Smazat skupinu „${name}"?`, '🗑️ Smazat', 'Zpět')) return;
    await deleteGroup(name);
  }
}

async function deleteGroup(name) {
  try {
    await apiFetch(`${API.cards}?action=delete_group`, {
      method: 'DELETE',
      body: JSON.stringify({ group_name: name }),
    });
    toast(`Skupina „${name}" smazána`, 'success');
    document.getElementById('modalDeleteGroup').classList.remove('open');
    await refreshGroupsList();
    loadCards();
  } catch (e) { toast(e.message, 'error'); }
}

async function saveCard() {
  const body = {
    term:       document.getElementById('cardTerm').value.trim(),
    emoji:      document.getElementById('cardEmoji').value.trim(),
    hint:       document.getElementById('cardHint').value.trim(),
    category:   document.getElementById('cardCategory').value,
    group_name: document.getElementById('cardGroup').value.trim(),
    difficulty: +document.getElementById('cardDifficulty').value,
    points:     +document.getElementById('cardPoints').value,
  };
  if (!body.term)       return toast('Zadej název kartičky', 'error');
  if (!body.group_name) return toast('Zadej skupinu', 'error');

  try {
    if (editingCardId) {
      await apiFetch(`${API.cards}?id=${editingCardId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Kartička uložena', 'success');
    } else {
      await apiFetch(API.cards, { method: 'POST', body: JSON.stringify(body) });
      toast('Kartička přidána', 'success');
    }
    document.getElementById('modalCard').classList.remove('open');
    loadCards();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteCard(id) {
  const card = allCards.find(c => c.id === id);
  if (!await showConfirm(`Smazat „${card?.term || 'kartičku'}"?`, '🗑️ Smazat', 'Zpět')) return;
  await apiFetch(`${API.cards}?id=${id}`, { method: 'DELETE' });
  toast('Kartička smazána');
  loadCards();
}

async function exportCards() {
  const params = new URLSearchParams({ action: 'export' });
  if (cardsFilter.group)    params.set('group',    cardsFilter.group);
  if (cardsFilter.category) params.set('category', cardsFilter.category);
  const data = await apiFetch(`${API.cards}?${params}`);
  const parts = ['karticky', cardsFilter.group, cardsFilter.category].filter(Boolean);
  const filename = parts.join('-') + '.json';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
  toast('Exportováno');
}

function importCards() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.addEventListener('change', async () => {
    const file = inp.files[0];
    if (!file) return;
    const text  = await file.text();
    const data  = JSON.parse(text);
    const cards = data.cards ?? data;
    if (!Array.isArray(cards)) return toast('Neplatný formát souboru', 'error');
    const res = await apiFetch(`${API.cards}?action=import`, { method: 'POST', body: JSON.stringify({ cards }) });
    const skipMsg = res.skipped ? `, přeskočeno ${res.skipped} duplikátů` : '';
    toast(`Importováno ${res.imported} kartiček${skipMsg}`, 'success');
    loadCards();
  });
  inp.click();
}

export function initCardsScreen() {
  document.getElementById('btnNewCard').addEventListener('click', () => openCardEditor());
  document.getElementById('btnExportCards').addEventListener('click', exportCards);
  document.getElementById('btnImportCards').addEventListener('click', importCards);
  document.getElementById('btnSaveCard').addEventListener('click', saveCard);
  document.getElementById('btnCancelCard').addEventListener('click', () => document.getElementById('modalCard').classList.remove('open'));
  document.getElementById('modalCard').addEventListener('click', e => { if (e.target === document.getElementById('modalCard')) document.getElementById('modalCard').classList.remove('open'); });
  document.getElementById('cdClose').addEventListener('click', () => document.getElementById('cardDetailModal').classList.remove('open'));
  document.getElementById('cardDetailModal').addEventListener('click', e => { if (e.target === document.getElementById('cardDetailModal')) document.getElementById('cardDetailModal').classList.remove('open'); });
  document.getElementById('btnCardsBack').addEventListener('click', () => history.back());

  document.getElementById('filterGroup').addEventListener('change', e => { cardsFilter.group = e.target.value; loadCards(); });
  document.getElementById('filterCategory').addEventListener('change', e => { cardsFilter.category = e.target.value; loadCards(); });
  document.getElementById('searchCards').addEventListener('input', e => { cardsFilter.search = e.target.value; renderCardsTable(); });

  // Groups manager
  document.getElementById('btnManageGroups').addEventListener('click', openGroupsModal);
  document.getElementById('btnCloseGroups').addEventListener('click', () => document.getElementById('modalGroups').classList.remove('open'));
  document.getElementById('modalGroups').addEventListener('click', e => { if (e.target === document.getElementById('modalGroups')) document.getElementById('modalGroups').classList.remove('open'); });

  document.getElementById('btnNewGroup').addEventListener('click', () => {
    document.getElementById('newGroupForm').style.display = '';
    document.getElementById('newGroupInput').value = '';
    document.getElementById('newGroupInput').focus();
  });
  document.getElementById('btnCancelNewGroup').addEventListener('click', () => {
    document.getElementById('newGroupForm').style.display = 'none';
  });
  document.getElementById('btnCreateGroupConfirm').addEventListener('click', () => {
    const name = document.getElementById('newGroupInput').value.trim();
    if (!name) return;
    document.getElementById('newGroupForm').style.display = 'none';
    document.getElementById('modalGroups').classList.remove('open');
    openCardEditor(null, name);
  });
  document.getElementById('newGroupInput').addEventListener('keydown', e => {
    if (e.key === 'Enter')  document.getElementById('btnCreateGroupConfirm').click();
    if (e.key === 'Escape') document.getElementById('btnCancelNewGroup').click();
  });

  // Delete group confirm modal
  document.getElementById('deleteGroupConfirmInput').addEventListener('input', e => {
    document.getElementById('btnConfirmDeleteGroup').disabled = e.target.value !== e.target.dataset.target;
  });
  document.getElementById('btnConfirmDeleteGroup').addEventListener('click', async () => {
    await deleteGroup(document.getElementById('deleteGroupConfirmInput').dataset.target);
  });
  document.getElementById('btnCancelDeleteGroup').addEventListener('click', () => {
    document.getElementById('modalDeleteGroup').classList.remove('open');
  });
}
