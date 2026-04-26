import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'empleados';

export async function renderEmpleados(container) {
  container.innerHTML = pageShell('Empleados', 'Catálogo de empleados por estación', '👷');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#emp-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase
    .from(TABLE).select('*, estaciones(nombre)').order('paterno');
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('empleado'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Nombre Completo</th><th>Estación</th><th>Acciones</th></tr></thead>
      <tbody id="emp-tbody">
        ${rows.map((r, i) => {
          const full = `${r.paterno} ${r.materno || ''} ${r.nombre}`.trim();
          return `<tr>
            <td>${i + 1}</td>
            <td class="td-bold">${full}</td>
            <td><span class="badge badge-cyan">${r.estaciones?.nombre || '—'}</span></td>
            <td>
              <button class="btn btn-secondary btn-icon btn-sm" data-edit="${r.id}">✏️</button>
              <button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}" data-name="${full}">🗑️</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  area.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openForm(btn.dataset.edit, rows.find(r => r.id === btn.dataset.edit))));
  area.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => confirmDialog(`Se eliminará a <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

async function openForm(id = null, data = {}) {
  const { data: estaciones } = await supabase.from('estaciones').select('id,nombre').order('nombre');
  const opts = (estaciones || []).map(e => `<option value="${e.id}" ${data.idestacion === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('');
  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nuevo'} Empleado</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nombre(s) *</label>
        <input id="f-nombre" class="form-control" placeholder="Juan Carlos" value="${data.nombre || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Apellido Paterno *</label>
          <input id="f-paterno" class="form-control" placeholder="García" value="${data.paterno || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Apellido Materno</label>
          <input id="f-materno" class="form-control" placeholder="López" value="${data.materno || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Estación *</label>
        <select id="f-est" class="form-control"><option value="">— Selecciona —</option>${opts}</select>
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
  const paterno = overlay.querySelector('#f-paterno').value.trim();
  const materno = overlay.querySelector('#f-materno').value.trim();
  const idestacion = overlay.querySelector('#f-est').value;
  if (!nombre || !paterno || !idestacion) { showToast('Nombre, paterno y estación son requeridos', 'error'); return; }
  const payload = { nombre, paterno, materno, idestacion };
  const { error } = id
    ? await supabase.from(TABLE).update(payload).eq('id', id)
    : await supabase.from(TABLE).insert(payload);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Empleado actualizado' : 'Empleado registrado', 'success');
  await loadTable();
  filterTable('search-input', '#emp-tbody tr');
}

async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Empleado eliminado', 'success');
  await loadTable();
  filterTable('search-input', '#emp-tbody tr');
}
