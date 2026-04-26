import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'tipopva';

export async function renderTipoPVA(container) {
  container.innerHTML = pageShell('Tipo PVA', 'Tipos de punto de venta / abastecimiento', '🔧');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#tipo-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase.from(TABLE).select('*').order('tipo');
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('tipo PVA'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Tipo PVA</th><th>Acciones</th></tr></thead>
      <tbody id="tipo-tbody">
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="td-bold">${r.tipo}</td>
            <td>
              <button class="btn btn-secondary btn-icon btn-sm" data-edit="${r.id}" data-tipo="${r.tipo}">✏️</button>
              <button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}" data-name="${r.tipo}">🗑️</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  area.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openForm(btn.dataset.edit, { tipo: btn.dataset.tipo })));
  area.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => confirmDialog(`Se eliminará el tipo <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

function openForm(id = null, data = {}) {
  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nuevo'} Tipo PVA</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Tipo *</label>
        <input id="f-tipo" class="form-control" placeholder="Ej. Expendio, Auto-tanque, Cargador..." value="${data.tipo || ''}">
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
  const tipo = overlay.querySelector('#f-tipo').value.trim();
  if (!tipo) { showToast('El tipo es requerido', 'error'); return; }
  const { error } = id
    ? await supabase.from(TABLE).update({ tipo }).eq('id', id)
    : await supabase.from(TABLE).insert({ tipo });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Tipo actualizado' : 'Tipo creado', 'success');
  await loadTable();
  filterTable('search-input', '#tipo-tbody tr');
}

async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Tipo eliminado', 'success');
  await loadTable();
  filterTable('search-input', '#tipo-tbody tr');
}
