import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal, confirmDialog, pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

const TABLE = 'cargadores';

export async function renderCargadores(container) {
  container.innerHTML = pageShell('Cargadores (Auto-Tanques)', 'Equipos móviles de transferencia (Planta ↔ Estaciones)', '🚛');
  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  document.getElementById('btn-add').addEventListener('click', () => openForm());
  filterTable('search-input', '#carg-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase
    .from(TABLE)
    .select('*, tipopva(tipo), tanques(nombre), zonas(zona)')
    .order('pva');
  
  const area = document.getElementById('table-area');
  if (error) { area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; return; }
  if (!rows.length) { area.innerHTML = emptyHTML('cargador'); return; }

  area.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Clave</th>
          <th>Zona</th>
          <th>Tanque</th>
          <th>Vehículo (Marca - Año)</th>
          <th>Serie</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody id="carg-tbody">
        ${rows.map(r => `
          <tr>
            <td class="td-bold">${r.pva}</td>
            <td>${r.zonas?.zona || '—'}</td>
            <td><span class="badge badge-warning">${r.tanques?.nombre || '—'}</span></td>
            <td>${r.camion_marca || '—'} ${r.camion_anio ? `(${r.camion_anio})` : ''}</td>
            <td style="font-family:monospace; color:var(--text-muted)">${r.camion_serie || '—'}</td>
            <td>
              <button class="btn btn-secondary btn-icon btn-sm" data-edit="${r.id}">✏️</button>
              <button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}" data-name="${r.pva}">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

  area.querySelectorAll('[data-edit]').forEach(btn => 
    btn.addEventListener('click', () => openForm(btn.dataset.edit, rows.find(r => r.id === btn.dataset.edit))));
  area.querySelectorAll('[data-del]').forEach(btn => 
    btn.addEventListener('click', () => confirmDialog(`Eliminar cargador <strong>${btn.dataset.name}</strong>`, () => deleteRecord(btn.dataset.del))));
}

async function openForm(id = null, data = {}) {
  // Cargar catálogos
  const [resTipos, resZonas, resTanques] = await Promise.all([
    supabase.from('tipopva').select('id,tipo').order('tipo'),
    supabase.from('zonas').select('id,zona').order('zona'),
    supabase.from('tanques').select('id,nombre').order('nombre')
  ]);

  const optsTipos = (resTipos.data || []).map(t => `<option value="${t.id}" ${data.idtipopva === t.id ? 'selected' : ''}>${t.tipo}</option>`).join('');
  const optsZonas = (resZonas.data || []).map(z => `<option value="${z.id}" ${data.idzona === z.id ? 'selected' : ''}>${z.zona}</option>`).join('');
  const optsTanques = (resTanques.data || []).map(t => `<option value="${t.id}" ${data.idtanque === t.id ? 'selected' : ''}>${t.nombre}</option>`).join('');

  showModal(`
    <div class="modal-header">
      <h2>${id ? 'Editar' : 'Nuevo'} Cargador (Auto-Tanque)</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      
      <h4 style="margin-bottom:12px;font-size:13px;color:var(--text-muted)">DATOS GENERALES</h4>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Clave Cargador *</label>
          <input id="f-pva" class="form-control" placeholder="Ej. AT-01" value="${data.pva || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo PVA</label>
          <select id="f-tipo" class="form-control"><option value="">— Opcional —</option>${optsTipos}</select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Zona Asignada *</label>
          <select id="f-zona" class="form-control"><option value="">— Selecciona —</option>${optsZonas}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Tanque (Capacidad) *</label>
          <select id="f-tanque" class="form-control"><option value="">— Selecciona —</option>${optsTanques}</select>
        </div>
      </div>

      <h4 style="margin-top:8px; margin-bottom:12px;font-size:13px;color:var(--text-muted)">DATOS DEL VEHÍCULO</h4>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Marca del Camión</label>
          <input id="f-marca" class="form-control" placeholder="Ej. Freightliner" value="${data.camion_marca || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Año</label>
          <input id="f-anio" type="number" class="form-control" placeholder="2020" value="${data.camion_anio || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Número de Serie (VIN)</label>
        <input id="f-serie" class="form-control" placeholder="3ALXXXXXXXXXX" value="${data.camion_serie || ''}">
      </div>

    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="btn-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-save">💾 Guardar</button>
    </div>
  `, overlay => {
    overlay.querySelector('#btn-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#btn-save').addEventListener('click', () => saveRecord(id, overlay));
  });
}

async function saveRecord(id, overlay) {
  const pva = overlay.querySelector('#f-pva').value.trim();
  const idzona = overlay.querySelector('#f-zona').value;
  const idtanque = overlay.querySelector('#f-tanque').value;
  
  if (!pva || !idzona || !idtanque) {
    showToast('La Clave, Zona y Tanque son obligatorios', 'error');
    return;
  }

  const payload = {
    pva,
    idtipopva: overlay.querySelector('#f-tipo').value || null,
    idzona,
    idtanque,
    camion_marca: overlay.querySelector('#f-marca').value.trim(),
    camion_serie: overlay.querySelector('#f-serie').value.trim(),
    camion_anio: overlay.querySelector('#f-anio').value ? parseInt(overlay.querySelector('#f-anio').value) : null
  };

  const { error } = id 
    ? await supabase.from(TABLE).update(payload).eq('id', id)
    : await supabase.from(TABLE).insert(payload);

  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  
  closeModal();
  showToast(id ? 'Cargador actualizado' : 'Cargador registrado', 'success');
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
