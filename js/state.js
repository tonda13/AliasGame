// ==============================================
// js/state.js – Centrální stav hry + persistence
// ==============================================

export const State = {
  gameId:           null,
  game:             null,
  teams:            [],
  currentTeamIndex: 0,
  currentCard:      null,
  isPublic:         false,
  timerInterval:    null,
  timerSeconds:     60,
  timerPaused:      false,
  prepInterval:     null,
  roundCount:       0,    // celkový počet odehraných kol (ze serveru)
  cardDrawn:        false, // je aktuálně vytažena karta?
  jokerUsedAt:      {},   // { teamId: roundCount } – kdy byl joker naposledy použit
  hintsUsed:        {},   // { teamId: count } – počet použitých nápověd per tým (max 5)
};

// ── Persistence helpery (joker + nápověda) ──
export function saveGameExtras() {
  localStorage.setItem('alias_game_extras', JSON.stringify({
    gameId:      State.gameId,
    jokerUsedAt: State.jokerUsedAt,
    hintsUsed:   State.hintsUsed,
  }));
}

export function loadGameExtras() {
  try {
    const data = JSON.parse(localStorage.getItem('alias_game_extras') || 'null');
    if (!data || data.gameId !== State.gameId) return;
    State.jokerUsedAt = data.jokerUsedAt || {};
    State.hintsUsed   = data.hintsUsed   || {};
  } catch {}
}

export function clearGameExtras() {
  localStorage.removeItem('alias_game_extras');
  State.jokerUsedAt = {};
  State.hintsUsed   = {};
  State.roundCount  = 0;
  State.cardDrawn   = false;
}

// ── Joker helpery ──
export function jokerAvailable(teamId) {
  const usedAt = State.jokerUsedAt[teamId];
  if (usedAt === undefined || usedAt === null) return true;
  return State.roundCount - usedAt >= 7;
}

export function updateJokerBtn() {
  const btn = document.getElementById('btnJoker');
  if (!btn) return;
  const team = State.teams[State.currentTeamIndex];
  if (!team) { btn.disabled = true; return; }
  const avail = jokerAvailable(team.id);
  if (avail) {
    btn.textContent = '🃏 Joker';
    btn.disabled    = !State.cardDrawn;
    btn.title       = State.cardDrawn ? 'Přeskočit kartičku' : 'Nejdřív vytáhněte kartičku';
  } else {
    const remaining = 7 - (State.roundCount - State.jokerUsedAt[team.id]);
    if (State.cardDrawn) {
      btn.textContent = '🃏 Joker (-1b)';
      btn.disabled    = false;
      btn.title       = `Joker není k dispozici, ale lze přeskočit za -1 bod`;
    } else {
      btn.textContent = `🃏 Za ${remaining}`;
      btn.disabled    = true;
      btn.title       = `Joker se dobije za ${remaining} ${remaining === 1 ? 'kolo' : remaining < 5 ? 'kola' : 'kol'}`;
    }
  }
}
