// ==============================================
// js/main.js – Entry point (ES module)
// ==============================================

// Aplikuj téma před renderem – zabraňuje záblesku výchozích barev
const _theme = localStorage.getItem('alias_theme') ?? '';
if (_theme) document.documentElement.setAttribute('data-theme', _theme);

import { initHomeScreen, initRulesScreen } from './screen-home.js';
import { initSetupScreen } from './screen-setup.js';
import { loadGameState, renderGame, endGame, initGameScreen } from './screen-game.js';
import { initCardsScreen } from './screen-cards.js';
import { State } from './state.js';
import { showScreen } from './navigation.js';
import { showConfirm } from './helpers.js';

window.addEventListener('popstate', async e => {
  const gameActive = document.getElementById('screenGame').classList.contains('active');
  if (gameActive) {
    history.pushState({ screen: 'screenGame' }, '');
    if (await showConfirm('Ukončit hru?', '✕ Ukončit', '← Zpět do hry')) endGame();
    return;
  }
  showScreen(e.state?.screen ?? 'screenHome', false);
});

document.addEventListener('DOMContentLoaded', async () => {
  initHomeScreen();
  initRulesScreen();
  initSetupScreen();
  initCardsScreen();
  initGameScreen();

  let initialScreen = 'screenHome';

  const savedId = localStorage.getItem('alias_game_id');
  if (savedId) {
    State.gameId = +savedId;
    try {
      await loadGameState();
      if (State.game.status === 'finished') {
        localStorage.removeItem('alias_game_id');
      } else {
        initialScreen = 'screenGame';
      }
    } catch {
      localStorage.removeItem('alias_game_id');
    }
  }

  showScreen(initialScreen, false);
  if (initialScreen === 'screenGame') renderGame();
  history.replaceState({ screen: initialScreen }, '');

  // Verze – klik vymaže SW cache a načte stránku znovu
  document.getElementById('btnVersion')?.addEventListener('click', async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    location.reload();
  });

  // Theme picker
  const savedTheme = localStorage.getItem('alias_theme') ?? '';
  document.querySelectorAll('.theme-dot').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === savedTheme);
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      if (theme) document.documentElement.setAttribute('data-theme', theme);
      else        document.documentElement.removeAttribute('data-theme');
      const themeBg = { '': '#012641', celadon: '#2a1a17', cherry: '#0d0a35',
        icy: '#1a1d1f', lime: '#1c1528', shadow: '#141414' };
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', themeBg[theme] ?? '#012641');
      localStorage.setItem('alias_theme', theme);
      document.querySelectorAll('.theme-dot').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
