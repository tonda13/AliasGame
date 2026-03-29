// ==============================================
// js/screen-game.js – Game screen & flow
// ==============================================
import { API, apiFetch } from './api.js';
import { State, saveGameExtras, clearGameExtras, loadGameExtras, jokerAvailable, updateJokerBtn } from './state.js';
import { Sounds } from './sounds.js';
import { toast, showConfirm, getCategoryIcon, getCategoryLabel, getDiffLabel, teamColorVar } from './helpers.js';
import { showScreen } from './navigation.js';

export async function loadGameState() {
  const data = await apiFetch(`${API.game}?action=state&game_id=${State.gameId}`);
  State.game             = data;
  State.teams            = data.teams;
  State.currentTeamIndex = data.current_team_index;
  State.roundCount       = data.round_count || 0;
  loadGameExtras();
  return data;
}

function updateScoreboard() {
  const sb = document.getElementById('scoreboard');
  if (!sb) return;
  const winScore = State.game.win_score;
  sb.innerHTML = '';
  State.teams.forEach((t, i) => {
    const pct    = Math.min(100, (t.score / winScore) * 100);
    const active = i === State.currentTeamIndex ? 'active' : '';
    sb.insertAdjacentHTML('beforeend', `
      <div class="team-score-card ${active}" style="${teamColorVar(t.color)}">
        <div class="team-score-name">${t.name}</div>
        <div class="team-score-pts" style="color:${t.color}">${t.score} <span class="pts-label">/ ${winScore}</span></div>
        <div class="win-progress mt-8"><div class="win-progress-bar" style="width:${pct}%; background:${t.color}"></div></div>
      </div>
    `);
  });
}

export function renderGame() {
  updateScoreboard();

  renderTurnArea();
  State.cardDrawn = false;
  updateJokerBtn();
}

function renderTurnArea() {
  const team = State.teams[State.currentTeamIndex];
  const area = document.getElementById('turnArea');
  area.innerHTML = `
    <div class="card-game max-w-600" style="margin:0 auto;">
      <div style="color:${team.color}; font-family:var(--font-display); font-size:1.8rem; letter-spacing:2px; margin-bottom:8px">
        ${team.name}
      </div>
      <p class="text-muted mb-16">je na řadě!</p>
      <button class="btn btn-primary btn-lg w-full" id="btnDrawCard">🎲 Táhnout kartičku</button>
    </div>
  `;
  document.getElementById('btnDrawCard').addEventListener('click', drawCard);
}

async function drawCard() {
  State.timerPaused = false;
  try {
    const res = await apiFetch(`${API.game}?action=next_card&game_id=${State.gameId}`, {
      method: 'POST', body: JSON.stringify({}),
    });
    State.currentCard           = res.card;
    State.currentCard.turn_time = res.turn_time;
    State.isPublic              = res.is_public;
    State.cardDrawn   = true;
    updateJokerBtn();
    showPrepPhase();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function showPrepPhase() {
  const card = State.currentCard;
  const team = State.teams[State.currentTeamIndex];

  const area = document.getElementById('turnArea');
  area.innerHTML = `
    ${State.isPublic ? '<div class="public-banner mb-16">🌍 VEŘEJNÉ KOLO – hádají všechny týmy!</div>' : ''}
    <div class="card-game max-w-600" style="margin:0 auto; border-color:${team.color}">
      <span class="category-icon">${getCategoryIcon(card.category)}</span>
      <div style="font-size:0.9rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:8px">
        ${getCategoryLabel(card.category)} · ${getDiffLabel(card.difficulty)}
      </div>
      <h2 style="font-size:clamp(2rem,6vw,3.5rem); color:${team.color}; margin-bottom:12px">${card.term}</h2>
      ${card.hint ? (() => {
        const _teamId    = State.teams[State.currentTeamIndex].id;
        const _hintsLeft = 5 - (State.hintsUsed[_teamId] || 0);
        const _btnHtml   = _hintsLeft > 0
          ? `<button id="btnShowHint" class="btn btn-secondary btn-sm">💡 Nápověda (${_hintsLeft} zbývá)</button>`
          : `<button id="btnBuyHints" class="btn btn-secondary btn-sm">💡 Koupit 2 nápovědy (-1b)</button>`;
        return `<div class="mt-8 mb-16">${_btnHtml}<p id="hintText" style="display:none; margin-top:10px; color:var(--accent2); font-weight:600">${card.hint}</p></div>`;
      })() : '<div class="mb-16"></div>'}
      <button class="btn btn-success btn-lg w-full mt-8" id="btnStartTurn">▶ Začít!</button>
    </div>
  `;

  document.getElementById('btnStartTurn').addEventListener('click', startTurn);

  const hintBtn = document.getElementById('btnShowHint');
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      const teamId = State.teams[State.currentTeamIndex].id;
      State.hintsUsed[teamId] = (State.hintsUsed[teamId] || 0) + 1;
      saveGameExtras();
      document.getElementById('hintText').style.display = 'block';
      hintBtn.disabled = true;
      hintBtn.textContent = `💡 Nápověda (${5 - State.hintsUsed[teamId]} zbývá)`;
    });
  }
  const buyHintsBtn = document.getElementById('btnBuyHints');
  if (buyHintsBtn) {
    buyHintsBtn.addEventListener('click', () => buyHints(State.teams[State.currentTeamIndex].id));
  }
}

function startTurn(startFrom = null) {
  const isResume = startFrom !== null;
  if (!isResume) Sounds.play('start');

  const card = State.currentCard;
  const team = State.teams[State.currentTeamIndex];
  const totalSecs = State.currentCard.turn_time || 60;
  let   secs = isResume ? startFrom : totalSecs;

  const area = document.getElementById('turnArea');
  area.innerHTML = `
    ${State.isPublic ? '<div class="public-banner mb-16">🌍 VEŘEJNÉ KOLO – hádají všechny týmy!</div>' : ''}
    <div class="card-game max-w-600" style="margin:0 auto; border-color:${team.color}">
      <span class="category-icon">${getCategoryIcon(card.category)}</span>
      <h2 style="font-size:clamp(2rem,6vw,3.5rem); color:${team.color}; margin-bottom:4px">${card.term}</h2>
      <div class="text-muted mb-24" style="font-size:0.9rem">${getCategoryLabel(card.category)}</div>
      <div class="timer-wrap" id="timerWrap">
        <svg class="timer-svg" viewBox="0 0 160 160">
          <circle class="timer-track" cx="80" cy="80" r="70"/>
          <circle class="timer-bar" cx="80" cy="80" r="70" id="timerBar"/>
        </svg>
        <div class="timer-text" id="timerText">${secs}</div>
      </div>
      <button class="btn btn-secondary btn-lg w-full mt-24" id="btnStopTimer">⏹ Ukončit odpočet</button>
    </div>
  `;

  document.getElementById('btnStopTimer').addEventListener('click', () => {
    clearInterval(State.timerInterval);
    State.timerInterval = null;
    showRoundResult();
  });

  State.timerSeconds  = secs;
  State.timerInterval = setInterval(() => {
    secs--;
    State.timerSeconds = secs;
    const progress = secs / totalSecs;
    document.documentElement.style.setProperty('--timer-progress', progress);
    const txt = document.getElementById('timerText');
    const bar = document.getElementById('timerBar');
    if (txt) txt.textContent = secs;
    if (bar) {
      bar.classList.toggle('warning',  secs <= 20 && secs > 10);
      bar.classList.toggle('critical', secs <= 10);
    }
    if (secs === 20) Sounds.play('warning');
    if (secs <= 10 && secs > 0) Sounds.play('tick');
    if (secs <= 0) {
      clearInterval(State.timerInterval);
      Sounds.play('end');
      showRoundResult();
    }
  }, 1000);
}

function showRoundResult() {
  const card = State.currentCard;
  const team = State.teams[State.currentTeamIndex];
  const area = document.getElementById('turnArea');

  let guessingTeamHtml = '';
  if (State.isPublic) {
    guessingTeamHtml = `
      <div class="mt-16">
        <p class="text-muted mb-8" style="font-size:0.9rem">Který tým uhodl?</p>
        <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center">
          ${State.teams.map((t, i) => {
            const label = i === State.currentTeamIndex ? `${t.name} (ukazující)` : t.name;
            return `<button class="btn btn-secondary" data-guess-team="${t.id}" style="border-color:${t.color}; color:${t.color}">${label}</button>`;
          }).join('')}
          <button class="btn btn-secondary" data-guess-team="0">Nikdo</button>
        </div>
      </div>
    `;
  }

  area.innerHTML = `
    <div class="card-game max-w-600" style="margin:0 auto">
      <div style="font-size:3rem; margin-bottom:8px">⏱️</div>
      <h2 style="color:${team.color}; margin-bottom:8px">Čas!</h2>
      <p class="text-muted mb-24">Uhodl tým <strong style="color:${team.color}">${team.name}</strong> termín?</p>
      <h3 style="font-size:2rem; margin-bottom:24px; color:var(--text)">${card.term}</h3>
      ${guessingTeamHtml}
      <div class="flex gap-16 mt-24 justify-center">
        <div id="resultBtnGuessedWrap" ${State.isPublic ? 'style="display:none"' : ''}>
          <button class="btn btn-success btn-lg" id="btnGuessed">✓ Uhodli! (+${card.points}b)</button>
        </div>
        <button class="btn btn-danger btn-lg" id="btnNotGuessed">✕ Neuhodli</button>
      </div>
    </div>
  `;

  if (State.isPublic) {
    let selectedGuesser = null;
    area.querySelectorAll('[data-guess-team]').forEach(btn => {
      btn.addEventListener('click', () => {
        area.querySelectorAll('[data-guess-team]').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        selectedGuesser = +btn.dataset.guessTeam;
        const guessedWrap = document.getElementById('resultBtnGuessedWrap');
        if (selectedGuesser === 0) {
          guessedWrap.style.display = 'none';
        } else {
          guessedWrap.style.display = '';
          const isPresentingTeam = selectedGuesser === team.id;
          document.getElementById('btnGuessed').textContent = isPresentingTeam
            ? `✓ Uhodli! (všechny body)`
            : `✓ Uhodli! (body rozděleny)`;
        }
      });
    });
    document.getElementById('btnGuessed').addEventListener('click', () => submitRound(true, selectedGuesser));
    document.getElementById('btnNotGuessed').addEventListener('click', () => submitRound(false));
  } else {
    document.getElementById('btnGuessed').addEventListener('click', () => submitRound(true));
    document.getElementById('btnNotGuessed').addEventListener('click', () => submitRound(false));
  }
}

function animateScore(teamIdx, points) {
  const card = document.querySelectorAll('#scoreboard .team-score-card')[teamIdx];
  if (!card) return;
  const el = document.createElement('div');
  el.className = 'score-bump';
  el.textContent = `+${points}`;
  card.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

async function submitRound(guessed, guessingTeamId = null, isJoker = false) {
  if (isJoker) {
    const teamId = State.teams[State.currentTeamIndex].id;
    State.jokerUsedAt[teamId] = State.roundCount;
    saveGameExtras();
  } else {
    Sounds.play(guessed ? 'correct' : 'wrong');
  }
  const oldScores = State.teams.map(t => t.score);
  try {
    const res = await apiFetch(`${API.game}?action=submit_round&game_id=${State.gameId}`, {
      method: 'POST',
      body: JSON.stringify({
        team_id:          State.teams[State.currentTeamIndex].id,
        card_id:          State.currentCard.id,
        guessed,
        is_public:        State.isPublic,
        guessing_team_id: guessingTeamId || null,
      }),
    });

    State.roundCount       = res.round_count || State.roundCount + 1;
    State.teams            = res.teams;
    State.currentTeamIndex = res.next_team_index;

    if (res.winner) {
      showWinner(res.winner);
      return;
    }

    renderGame();

    res.teams.forEach((t, i) => {
      const diff = t.score - (oldScores[i] ?? 0);
      if (diff > 0) animateScore(i, diff);
    });
  } catch (e) {
    toast(e.message, 'error');
  }
}

function showWinner(winner) {
  localStorage.removeItem('alias_game_id');
  clearGameExtras();
  Sounds.play('winner');
  showScreen('screenWinner');
  const team   = State.teams.find(t => t.id === winner.id) || winner;
  const sorted = [...State.teams].sort((a, b) => b.score - a.score);

  document.getElementById('winnerContent').innerHTML = `
    <span class="trophy">🏆</span>
    <h1 style="color:${team.color}; margin:16px 0">${team.name}</h1>
    <p class="text-muted" style="font-size:1.3rem; margin-bottom:32px">vyhrál hru s <strong style="color:${team.color}">${team.score} body</strong>!</p>
    <div class="scoreboard" style="justify-content:center">
      ${sorted.map((t, i) => `
        <div class="team-score-card" style="${teamColorVar(t.color)}; border-color:${t.color}">
          <div style="font-size:1.5rem">${['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'][i]}</div>
          <div class="team-score-name">${t.name}</div>
          <div class="team-score-pts" style="color:${t.color}">${t.score}</div>
        </div>
      `).join('')}
    </div>
    <div class="flex gap-16 mt-32 justify-center">
      <button class="btn btn-primary btn-lg" onclick="location.reload()">🔄 Nová hra</button>
    </div>
  `;
  startConfetti();
}

function startConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 8 + 4,
    d: Math.random() * 120 + 30,
    color: ['#e94560','#f5a623','#2ecc71','#3498db','#ffd700','#9b59b6'][Math.floor(Math.random()*6)],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0, speed: Math.random() * 2 + 1,
  }));

  let frame;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.ellipse(p.x, p.y, p.r, p.r / 2, p.tilt, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.speed;
      p.tilt += 0.05;
      p.x += Math.sin(p.tiltAngle) * 1.5;
      p.tiltAngle += 0.05;
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
    });
    frame = requestAnimationFrame(draw);
  })();
  setTimeout(() => cancelAnimationFrame(frame), 8000);
}

async function buyHints(teamId) {
  if (!await showConfirm('Koupit 2 další nápovědy za -1 bod?', '💡 Koupit (-1b)', '← Zpět')) return;
  try {
    const res = await apiFetch(`${API.game}?action=score_adjust&game_id=${State.gameId}`, {
      method: 'POST',
      body: JSON.stringify({ team_id: teamId, delta: -1 }),
    });
    State.teams = res.teams;
    State.hintsUsed[teamId] = Math.max(0, (State.hintsUsed[teamId] || 0) - 2);
    saveGameExtras();
    updateScoreboard();
    // Swap buy button for hint button
    const buyBtn = document.getElementById('btnBuyHints');
    if (buyBtn) {
      const hintsLeft = 5 - (State.hintsUsed[teamId] || 0);
      buyBtn.outerHTML = `<button id="btnShowHint" class="btn btn-secondary btn-sm">💡 Nápověda (${hintsLeft} zbývá)</button>`;
      document.getElementById('btnShowHint').addEventListener('click', () => {
        State.hintsUsed[teamId] = (State.hintsUsed[teamId] || 0) + 1;
        saveGameExtras();
        document.getElementById('hintText').style.display = 'block';
        const btn = document.getElementById('btnShowHint');
        btn.disabled = true;
        btn.textContent = `💡 Nápověda (${5 - State.hintsUsed[teamId]} zbývá)`;
      });
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

export async function useJoker() {
  if (!State.cardDrawn) return;
  const team  = State.teams[State.currentTeamIndex];
  const avail = jokerAvailable(team.id);
  const msg   = avail ? 'Přeskočit tuto kartičku?' : 'Joker není k dispozici. Přeskočit za -1 bod?';
  const conf  = avail ? '🃏 Použít Joker' : '🃏 Přeskočit (-1b)';
  if (!await showConfirm(msg, conf, '← Zpět')) return;
  clearInterval(State.timerInterval);  State.timerInterval = null;
  clearInterval(State.prepInterval);   State.prepInterval  = null;
  if (!avail) {
    try {
      const res = await apiFetch(`${API.game}?action=score_adjust&game_id=${State.gameId}`, {
        method: 'POST',
        body: JSON.stringify({ team_id: team.id, delta: -1 }),
      });
      State.teams = res.teams;
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
  }
  await submitRound(false, null, true);
}

export async function endGame() {
  clearInterval(State.timerInterval);  State.timerInterval = null;
  clearInterval(State.prepInterval);   State.prepInterval  = null;
  await apiFetch(`${API.game}?action=end&game_id=${State.gameId}`, { method: 'POST', body: JSON.stringify({}) });
  localStorage.removeItem('alias_game_id');
  clearGameExtras();
  showScreen('screenHome');
}

export function initGameScreen() {
  document.getElementById('btnPauseGame').addEventListener('click', () => {
    const btn = document.getElementById('btnPauseGame');
    if (!State.timerPaused) {
      if (State.timerInterval) {
        clearInterval(State.timerInterval);
        State.timerInterval = null;
      }
      State.timerPaused = true;
      btn.textContent = '▶ Pokračovat';
    } else {
      State.timerPaused = false;
      btn.textContent = '⏸ Pauza';
      if (State.timerSeconds > 0) startTurn(State.timerSeconds);
    }
  });
  document.getElementById('btnJoker').addEventListener('click', useJoker);
  document.getElementById('btnEndGame').addEventListener('click', async () => {
    if (!await showConfirm('Ukončit hru?', '✕ Ukončit', '← Zpět do hry')) return;
    await endGame();
  });
}
