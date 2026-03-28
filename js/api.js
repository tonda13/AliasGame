// ==============================================
// js/api.js – API endpoints & fetch wrapper
// ==============================================

export const API = {
  cards: 'api/cards.php',
  game:  'api/game.php',
};

export async function apiFetch(url, opts = {}) {
  const res  = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}
