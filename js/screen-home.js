// ==============================================
// js/screen-home.js – Home & Rules screens
// ==============================================
import { showScreen } from './navigation.js';
import { loadCards } from './screen-cards.js';

export function initHomeScreen() {
  document.getElementById('btnNewGame').addEventListener('click', () => showScreen('screenSetup'));
  document.getElementById('btnRules').addEventListener('click',   () => showScreen('screenRules'));
  document.getElementById('btnCards').addEventListener('click',   () => { showScreen('screenCards'); loadCards(); });
}

export function initRulesScreen() {
  document.getElementById('btnRulesBack').addEventListener('click', () => history.back());
  document.getElementById('btnRulesPlay').addEventListener('click', () => showScreen('screenSetup'));
}
