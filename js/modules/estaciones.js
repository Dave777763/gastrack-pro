import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'estaciones';

export async function renderEstaciones(container) {
  container.innerHTML = pageShell('Estaciones', 'Catálogo de estaciones de carburación', '🏭');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#est-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase
    .from(TABLE).select('*, zonas(zona)').order('nombre');
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('estación'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Nombre</th><th>Zona</th><th>Acciones</th></tr></thead>
      <tbody id="est-tbody">
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="td-bold">${r.nombre}</td>
            <td><span class="badge badge-primary">${r.zonas?.zona || '—'}</span></td>
            <td>
              <button class="btn btn-secondary btn-icon btn-sm" data-edit="${r.id}">✏️</button>
              <button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}" data-name="${r.nombre}">🗑️</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  area.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openForm(btn.dataset.edit, rows.find(r => r.id === btn.dataset.edit))));
  area.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => confirmDialog(`Se eliminará <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

async function openForm(id = null, data = {}) {
  const { data: zonas } = await supabase.from('zonas').select('id,zona').order('zona');
  const opts = (zonas || []).map(z => `<option value="${z.id}" ${data.idzona === z.id ? 'selected' : ''}>${z.zona}</option>`).join('');
  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nueva'} Estación</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <input id="f-nombre" class="form-control" placeholder="Ej. Estación Central" value="${data.nombre || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Zona *</label>
        <select id="f-zona" class="form-control"><option value="">— Selecciona —</option>${opts}</select>
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
  const nombre = overlay.querySelector('#f-nombre').value.trim();
  const idzona = overlay.querySelector('#f-zona').value;
  if (!nombre || !idzona) { showToast('Todos los campos son requeridos', 'error'); return; }
  const payload = { nombre, idzona };
  const { error } = id
    ? await supabase.from(TABLE).update(payload).eq('id', id)
    : await supabase.from(TABLE).insert(payload);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Estación actualizada' : 'Estación creada', 'success');
  await loadTable();
  filterTable('search-input', '#est-tbody tr');
}

async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Estación eliminada', 'success');
  await loadTable();
  filterTable('search-input', '#est-tbody tr');
}
