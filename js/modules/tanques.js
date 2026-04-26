import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'tanques';

export async function renderTanques(container) {
  container.innerHTML = pageShell('Tanques', 'Catálogo de tanques por estación', '🛢️');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#tank-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase
    .from(TABLE).select('*, estaciones(nombre)').order('nombre');
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('tanque'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Nombre</th><th>Capacidad</th><th>Estación</th><th>Acciones</th></tr></thead>
      <tbody id="tank-tbody">
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="td-bold">${r.nombre}</td>
            <td>${Number(r.capacidad).toLocaleString('es-MX')} L</td>
            <td><span class="badge badge-cyan">${r.estaciones?.nombre || '—'}</span></td>
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
    btn.addEventListener('click', () => confirmDialog(`Se eliminará el tanque <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

async function openForm(id = null, data = {}) {
  const { data: estaciones } = await supabase.from('estaciones').select('id,nombre').order('nombre');
  const opts = (estaciones || []).map(e => `<option value="${e.id}" ${data.idestacion === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('');
  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nuevo'} Tanque</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <input id="f-nombre" class="form-control" placeholder="Ej. Tanque 1" value="${data.nombre || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Capacidad (Litros) *</label>
          <input id="f-cap" type="number" min="0" class="form-control" placeholder="10000" value="${data.capacidad || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Estación (Opcional)</label>
          <select id="f-est" class="form-control"><option value="">— Ninguna (Móvil) —</option>${opts}</select>
        </div>
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
  const capacidad = parseFloat(overlay.querySelector('#f-cap').value);
  const idestacion = overlay.querySelector('#f-est').value;
  if (!nombre || isNaN(capacidad)) { showToast('Nombre y capacidad requeridos', 'error'); return; }
  const payload = { nombre, capacidad, idestacion: idestacion || null };
  const { error } = id
    ? await supabase.from(TABLE).update(payload).eq('id', id)
    : await supabase.from(TABLE).insert(payload);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Tanque actualizado' : 'Tanque creado', 'success');
  await loadTable();
  filterTable('search-input', '#tank-tbody tr');
}

async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Tanque eliminado', 'success');
  await loadTable();
  filterTable('search-input', '#tank-tbody tr');
}
