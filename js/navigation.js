// ==============================================
// js/navigation.js – SPA screen switching
// ==============================================

export function showScreen(id, pushHistory = true) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  if (pushHistory) history.pushState({ screen: id }, '');
}
