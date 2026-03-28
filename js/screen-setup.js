// ==============================================
// js/screen-setup.js – Game setup screen
// ==============================================
import { API, apiFetch } from './api.js';
import { State, clearGameExtras } from './state.js';
import { toast } from './helpers.js';
import { showScreen } from './navigation.js';
import { loadGameState, renderGame } from './screen-game.js';

const TEAM_COLORS = ['#e94560','#3498db','#2ecc71','#f5a623','#9b59b6','#1abc9c','#e67e22','#e84393'];
let setupTeams = [
  { name: 'Tým 1', color: '#e94560' },
  { name: 'Tým 2', color: '#3498db' },
];

export async function initSetupScreen() {
  await loadGroupsCheckboxes();
  renderSetupTeams();

  document.getElementById('btnAddTeam').addEventListener('click', () => {
    if (setupTeams.length >= 8) return toast('Maximum 8 týmů', 'error');
    setupTeams.push({ name: `Tým ${setupTeams.length + 1}`, color: TEAM_COLORS[setupTeams.length % TEAM_COLORS.length] });
    renderSetupTeams();
  });

  document.getElementById('btnStartGame').addEventListener('click', startGame);
  document.getElementById('btnSetupBack').addEventListener('click', () => history.back());
  document.getElementById('btnToggleAllGroups').addEventListener('click', () => {
    const boxes = [...document.querySelectorAll('#groupCheckboxes input[type=checkbox]')];
    const allChecked = boxes.every(b => b.checked);
    boxes.forEach(b => { b.checked = !allChecked; });
    updateToggleAllBtn();
  });
}

async function loadGroupsCheckboxes() {
  const groups = await apiFetch(`${API.cards}?action=groups`);
  const container = document.getElementById('groupCheckboxes');
  container.innerHTML = '';
  groups.forEach(g => {
    container.insertAdjacentHTML('beforeend', `
      <label class="toggle" style="min-width:180px">
        <input type="checkbox" name="group" value="${g.group_name}" checked>
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        <span>${g.group_name} <span class="text-muted">(${g.card_count})</span></span>
      </label>
    `);
  });
  updateToggleAllBtn();
  container.addEventListener('change', updateToggleAllBtn);
}

function updateToggleAllBtn() {
  const boxes = [...document.querySelectorAll('#groupCheckboxes input[type=checkbox]')];
  const allChecked = boxes.every(b => b.checked);
  document.getElementById('btnToggleAllGroups').textContent = allChecked ? 'Zrušit vše' : 'Označit vše';
}

function renderSetupTeams() {
  const list = document.getElementById('teamsList');
  list.innerHTML = '';
  setupTeams.forEach((team, i) => {
    list.insertAdjacentHTML('beforeend', `
      <div class="card" style="padding:16px; border-left:4px solid ${team.color}">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px">
          <label style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); white-space:nowrap">Tým ${i + 1}</label>
          <input class="form-input" style="flex:1" value="${team.name}" data-team-name="${i}" placeholder="Název týmu">
          <button class="btn btn-sm btn-danger" data-remove="${i}" ${setupTeams.length <= 2 ? 'disabled' : ''}>✕</button>
        </div>
        <div class="color-swatch-wrap" style="gap:6px">
          ${TEAM_COLORS.map(c => `<div class="color-swatch ${c === team.color ? 'selected' : ''}" style="background:${c}" data-team="${i}" data-color="${c}"></div>`).join('')}
        </div>
      </div>
    `);
  });

  list.querySelectorAll('.color-swatch').forEach(s => {
    s.addEventListener('click', () => {
      const i = +s.dataset.team, c = s.dataset.color;
      setupTeams[i].color = c;
      renderSetupTeams();
    });
  });
  list.querySelectorAll('[data-team-name]').forEach(inp => {
    inp.addEventListener('input', e => { setupTeams[+e.target.dataset.teamName].name = e.target.value; });
  });
  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => { setupTeams.splice(+btn.dataset.remove, 1); renderSetupTeams(); });
  });
}

async function startGame() {
  const groups     = [...document.querySelectorAll('#groupCheckboxes input:checked')].map(i => i.value);
  const categories = [...document.querySelectorAll('#categoryCheckboxes input:checked')].map(i => i.value);
  const winScore   = +document.getElementById('winScore').value || 30;

  if (!groups.length)    return toast('Vyber alespoň jednu skupinu karet', 'error');
  if (!categories.length) return toast('Vyber alespoň jeden typ úkolů', 'error');
  if (setupTeams.some(t => !t.name.trim())) return toast('Všechny týmy musí mít jméno', 'error');

  try {
    const res = await apiFetch(`${API.game}?action=create`, {
      method: 'POST',
      body: JSON.stringify({ teams: setupTeams, active_groups: groups, active_categories: categories, win_score: winScore }),
    });
    State.gameId = res.game_id;
    localStorage.setItem('alias_game_id', State.gameId);
    clearGameExtras();
    await loadGameState();
    showScreen('screenGame');
    renderGame();
  } catch (e) {
    toast(e.message, 'error');
  }
}
