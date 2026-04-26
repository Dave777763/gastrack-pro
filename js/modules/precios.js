import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'precios';

export async function renderPrecios(container) {
  container.innerHTML = pageShell('Precios', 'Precio por litro de Gas LP por zona y fecha', '💰');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#prec-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase
    .from(TABLE).select('*, zonas(zona)').order('dia', { ascending: false });
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('precio'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Fecha</th><th>Zona</th><th>Precio / Litro</th><th>Acciones</th></tr></thead>
      <tbody id="prec-tbody">
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.dia}</td>
            <td><span class="badge badge-primary">${r.zonas?.zona || '—'}</span></td>
            <td class="td-bold">$${Number(r.precio).toFixed(4)}</td>
            <td>
              <button class="btn btn-secondary btn-icon btn-sm" data-edit="${r.id}">✏️</button>
              <button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}" data-name="$${r.precio}">🗑️</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  area.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openForm(btn.dataset.edit, rows.find(r => r.id === btn.dataset.edit))));
  area.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => confirmDialog(`Se eliminará el precio <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

async function openForm(id = null, data = {}) {
  const { data: zonas } = await supabase.from('zonas').select('id,zona').order('zona');
  const opts = (zonas || []).map(z => `<option value="${z.id}" ${data.idzona === z.id ? 'selected' : ''}>${z.zona}</option>`).join('');
  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nuevo'} Precio</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha *</label>
          <input id="f-dia" type="date" class="form-control" value="${data.dia || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Zona *</label>
          <select id="f-zona" class="form-control"><option value="">— Selecciona —</option>${opts}</select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Precio por Litro (MXN) *</label>
        <input id="f-precio" type="number" step="0.0001" min="0" class="form-control" placeholder="12.5000" value="${data.precio || ''}">
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
  const dia = overlay.querySelector('#f-dia').value;
  const idzona = overlay.querySelector('#f-zona').value;
  const precio = parseFloat(overlay.querySelector('#f-precio').value);
  if (!dia || !idzona || isNaN(precio)) { showToast('Todos los campos son requeridos', 'error'); return; }
  const payload = { dia, idzona, precio };
  const { error } = id
    ? await supabase.from(TABLE).update(payload).eq('id', id)
    : await supabase.from(TABLE).insert(payload);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Precio actualizado' : 'Precio registrado', 'success');
  await loadTable();
  filterTable('search-input', '#prec-tbody tr');
}

async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Precio eliminado', 'success');
  await loadTable();
  filterTable('search-input', '#prec-tbody tr');
}
