import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'cargadores';

export async function renderCargadores(container) {
  container.innerHTML = pageShell('Cargadores', 'Puntos de carga (auto-tanques / cargadores)', '🔌');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#carg-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase
    .from(TABLE)
    .select('*, tipopva(tipo), estaciones(nombre), tanques(nombre), zonas(zona)')
    .order('pva');
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('cargador'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Cargador</th><th>Tipo</th><th>Estación</th><th>Tanque</th><th>Zona</th><th>Acciones</th></tr></thead>
      <tbody id="carg-tbody">
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="td-bold">${r.pva}</td>
            <td><span class="badge badge-warning">${r.tipopva?.tipo || '—'}</span></td>
            <td>${r.estaciones?.nombre || '—'}</td>
            <td><span class="badge badge-cyan">${r.tanques?.nombre || '—'}</span></td>
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
    btn.addEventListener('click', () => confirmDialog(`Se eliminará el cargador <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

async function openForm(id = null, data = {}) {
  const [{ data: zonas }, { data: estaciones }, { data: tipos }, { data: tanques }] = await Promise.all([
    supabase.from('zonas').select('id,zona').order('zona'),
    supabase.from('estaciones').select('id,nombre').order('nombre'),
    supabase.from('tipopva').select('id,tipo').order('tipo'),
    supabase.from('tanques').select('id,nombre').order('nombre'),
  ]);
  const optsZona   = (zonas||[]).map(z => `<option value="${z.id}" ${data.idzona===z.id?'selected':''}>${z.zona}</option>`).join('');
  const optsEst    = (estaciones||[]).map(e => `<option value="${e.id}" ${data.idestacion===e.id?'selected':''}>${e.nombre}</option>`).join('');
  const optsTipo   = (tipos||[]).map(t => `<option value="${t.id}" ${data.idtipopva===t.id?'selected':''}>${t.tipo}</option>`).join('');
  const optsTanque = (tanques||[]).map(t => `<option value="${t.id}" ${data.idtanque===t.id?'selected':''}>${t.nombre}</option>`).join('');

  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nuevo'} Cargador</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Clave Cargador *</label>
        <input id="f-pva" class="form-control" placeholder="Ej. CARG-01" value="${data.pva || ''}">
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
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Estación *</label>
          <select id="f-est" class="form-control"><option value="">— Selecciona —</option>${optsEst}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Tanque *</label>
          <select id="f-tanque" class="form-control"><option value="">— Selecciona —</option>${optsTanque}</select>
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
  const pva = overlay.querySelector('#f-pva').value.trim();
  const idtipopva = overlay.querySelector('#f-tipo').value;
  const idzona = overlay.querySelector('#f-zona').value;
  const idestacion = overlay.querySelector('#f-est').value;
  const idtanque = overlay.querySelector('#f-tanque').value;
  if (!pva || !idtipopva || !idzona || !idestacion || !idtanque) { showToast('Todos los campos son requeridos', 'error'); return; }
  const payload = { pva, idtipopva, idzona, idestacion, idtanque };
  const { error } = id
    ? await supabase.from(TABLE).update(payload).eq('id', id)
    : await supabase.from(TABLE).insert(payload);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Cargador actualizado' : 'Cargador creado', 'success');
  await loadTable();
  filterTable('search-input', '#carg-tbody tr');
}

async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Cargador eliminado', 'success');
  await loadTable();
  filterTable('search-input', '#carg-tbody tr');
}
