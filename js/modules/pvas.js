import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'pvas';

export async function renderPVAs(container) {
  container.innerHTML = pageShell('PVAs', 'Puntos de venta / abastecimiento', '⚙️');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#pva-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase
    .from(TABLE).select('*, tipopva(tipo), estaciones(nombre), zonas(zona)').order('pva');
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('PVA'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>PVA</th><th>Tipo</th><th>Estación</th><th>Zona</th><th>Acciones</th></tr></thead>
      <tbody id="pva-tbody">
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="td-bold">${r.pva}</td>
            <td><span class="badge badge-warning">${r.tipopva?.tipo || '—'}</span></td>
            <td>${r.estaciones?.nombre || '—'}</td>
            <td><span class="badge badge-primary">${r.zonas?.zona || '—'}</span></td>
            <td>
              <button class="btn btn-secondary btn-icon btn-sm" data-edit="${r.id}">✏️</button>
              <button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}" data-name="${r.pva}">🗑️</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  area.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openForm(btn.dataset.edit, rows.find(r => r.id === btn.dataset.edit))));
  area.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => confirmDialog(`Se eliminará el PVA <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

async function openForm(id = null, data = {}) {
  const [{ data: zonas }, { data: estaciones }, { data: tipos }] = await Promise.all([
    supabase.from('zonas').select('id,zona').order('zona'),
    supabase.from('estaciones').select('id,nombre').order('nombre'),
    supabase.from('tipopva').select('id,tipo').order('tipo'),
  ]);
  const optsZona = (zonas||[]).map(z => `<option value="${z.id}" ${data.idzona===z.id?'selected':''}>${z.zona}</option>`).join('');
  const optsEst  = (estaciones||[]).map(e => `<option value="${e.id}" ${data.idestacion===e.id?'selected':''}>${e.nombre}</option>`).join('');
  const optsTipo = (tipos||[]).map(t => `<option value="${t.id}" ${data.idtipopva===t.id?'selected':''}>${t.tipo}</option>`).join('');

  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nuevo'} PVA</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Clave PVA *</label>
        <input id="f-pva" class="form-control" placeholder="Ej. PVA-01" value="${data.pva || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo PVA *</label>
          <select id="f-tipo" class="form-control"><option value="">— Selecciona —</option>${optsTipo}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Zona *</label>
          <select id="f-zona" class="form-control"><option value="">— Selecciona —</option>${optsZona}</select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Estación *</label>
        <select id="f-est" class="form-control"><option value="">— Selecciona —</option>${optsEst}</select>
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
  const pva = overlay.querySelector('#f-pva').value.trim();
  const idtipopva = overlay.querySelector('#f-tipo').value;
  const idzona = overlay.querySelector('#f-zona').value;
  const idestacion = overlay.querySelector('#f-est').value;
  if (!pva || !idtipopva || !idzona || !idestacion) { showToast('Todos los campos son requeridos', 'error'); return; }
  const payload = { pva, idtipopva, idzona, idestacion };
  const { error } = id
    ? await supabase.from(TABLE).update(payload).eq('id', id)
    : await supabase.from(TABLE).insert(payload);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'PVA actualizado' : 'PVA creado', 'success');
  await loadTable();
  filterTable('search-input', '#pva-tbody tr');
}

async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('PVA eliminado', 'success');
  await loadTable();
  filterTable('search-input', '#pva-tbody tr');
}
