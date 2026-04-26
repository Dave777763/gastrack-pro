// ─── Shared utilities ───────────────────────────────────────────────────────

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function showModal(html, onOpen) {
  let overlay = document.getElementById('global-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'global-modal';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.querySelector('.modal-close')?.addEventListener('click', () => closeModal());
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  requestAnimationFrame(() => overlay.classList.add('active'));
  if (onOpen) onOpen(overlay);
}

export function closeModal() {
  const overlay = document.getElementById('global-modal');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 250);
  }
}

export function confirmDialog(message, onConfirm) {
  showModal(`
    <div class="modal-header">
      <h2>Confirmar acción</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-icon">🗑️</div>
      <h3>¿Eliminar registro?</h3>
      <p>${message}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="btn-cancel-confirm">Cancelar</button>
      <button class="btn btn-danger" id="btn-ok-confirm">Eliminar</button>
    </div>
  `, overlay => {
    overlay.querySelector('#btn-cancel-confirm').addEventListener('click', closeModal);
    overlay.querySelector('#btn-ok-confirm').addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
  });
}

export function pageShell(title, subtitle, icon, toolbarExtra = '', content = '') {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1>${icon} ${title}</h1>
        <p>${subtitle}</p>
      </div>
      ${toolbarExtra}
    </div>
    <div class="page-content">
      <div class="card">
        <div class="table-toolbar">
          <div class="search-box">
            <span>🔍</span>
            <input type="text" id="search-input" placeholder="Buscar...">
          </div>
          <button class="btn btn-primary" id="btn-add">+ Nuevo</button>
        </div>
        <div id="table-area">${content}</div>
      </div>
    </div>`;
}

export function loadingHTML() {
  return `<div class="loading">⏳ Cargando...</div>`;
}

export function emptyHTML(label) {
  return `<div class="empty-state">
    <div class="empty-icon">📂</div>
    <h3>Sin registros</h3>
    <p>Agrega el primer ${label} con el botón "+ Nuevo"</p>
  </div>`;
}

export function filterTable(searchId, rowSelector) {
  document.getElementById(searchId)?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll(rowSelector).forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}
