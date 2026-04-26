import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'zonas';

export async function renderZonas(container) {
  container.innerHTML = pageShell('Zonas', 'Catálogo de zonas de distribución', '🗺️');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#zonas-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase.from(TABLE).select('*').order('zona');
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('zona'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Zona</th><th>Acciones</th></tr></thead>
      <tbody id="zonas-tbody">
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="td-bold">${r.zona}</td>
            <td>
              <button class="btn btn-secondary btn-icon btn-sm" data-edit="${r.id}" data-zona="${r.zona}">✏️</button>
              <button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}" data-name="${r.zona}">🗑️</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  area.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openForm(btn.dataset.edit, { zona: btn.dataset.zona })));
  area.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => confirmDialog(`Se eliminará la zona <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

function openForm(id = null, data = {}) {
  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nueva'} Zona</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nombre de Zona *</label>
        <input id="f-zona" class="form-control" placeholder="Ej. Zona Norte" value="${data.zona || ''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="btn-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-save">💾 Guardar</button>
    </div>`, overlay => {
    overlay.querySelector('#btn-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#btn-save').addEventListener('click', () => saveRecord(id, overlay));
  });
}

async function saveRecord(id, overlay) {
  const zona = overlay.querySelector('#f-zona').value.trim();
  if (!zona) { showToast('El nombre de zona es requerido', 'error'); return; }
  const { error } = id
    ? await supabase.from(TABLE).update({ zona }).eq('id', id)
    : await supabase.from(TABLE).insert({ zona });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Zona actualizada' : 'Zona creada', 'success');
  await loadTable();
  filterTable('search-input', '#zonas-tbody tr');
}

async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Zona eliminada', 'success');
  await loadTable();
  filterTable('search-input', '#zonas-tbody tr');
}
