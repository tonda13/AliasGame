// ==============================================
// js/helpers.js – UI utilities & formatters
// ==============================================

export function showConfirm(message, confirmText = 'Potvrdit', cancelText = 'Zrušit') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal" style="max-width:340px; text-align:center">
        <div style="font-size:2.5rem; margin-bottom:12px">⚠️</div>
        <h3 style="margin-bottom:8px">${message}</h3>
        <div class="flex gap-12 mt-24 justify-center">
          <button class="btn btn-danger"    id="confirmYes">${confirmText}</button>
          <button class="btn btn-secondary" id="confirmNo">${cancelText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const done = r => { overlay.remove(); resolve(r); };
    overlay.querySelector('#confirmYes').addEventListener('click', () => done(true));
    overlay.querySelector('#confirmNo').addEventListener('click',  () => done(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
  });
}

export function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function getCategoryIcon(cat) {
  return { describe: '🗣️', draw: '✏️', mime: '🤸' }[cat] ?? '❓';
}

export function getCategoryLabel(cat) {
  return { describe: 'Popis', draw: 'Kresba', mime: 'Pantomima' }[cat] ?? cat;
}

export function getDiffLabel(d) {
  return ['', '⭐ Lehká', '⭐⭐ Střední', '⭐⭐⭐ Těžká'][d] ?? '';
}

export function teamColorVar(color) {
  return `--team-color: ${color}`;
}
