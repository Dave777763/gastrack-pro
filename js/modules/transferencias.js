import { supabase } from '../supabase-config.js';
import { pageShell, loadingHTML, emptyHTML, filterTable } from '../utils.js';

export async function renderTransferencias(container) {
  container.innerHTML = pageShell('Historial de Transferencias', 'Control de trasvase de auto-tanques a estaciones', '🔄');
  
  // Ocultamos el botón de "+ Nuevo" porque se hacen desde Liquidaciones
  const btnAdd = document.getElementById('btn-add');
  if (btnAdd) btnAdd.style.display = 'none';

  document.getElementById('table-area').innerHTML = loadingHTML();
  await loadTable();
  filterTable('search-input', '#transf-tbody tr');
}

async function loadTable() {
  const { data: rows, error } = await supabase
    .from('transferencias')
    .select('*, estaciones(nombre), liquidaciones(dia, turno)')
    .order('created_at', { ascending: false });

  const area = document.getElementById('table-area');
  
  if (error) { 
    area.innerHTML = `<p style="padding:20px;color:var(--danger)">Error: ${error.message}</p>`; 
    return; 
  }
  
  if (!rows.length) { 
    area.innerHTML = emptyHTML('transferencia'); 
    area.innerHTML += `<p style="text-align:center; color:var(--text-muted); margin-top:-10px;">Las transferencias se registran automáticamente durante el Corte de Turno (Liquidaciones).</p>`;
    return; 
  }

  area.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Fecha / Turno</th>
          <th>Estación</th>
          <th>Auto-tanque</th>
          <th>Capacidad AT</th>
          <th>% Inicial AT</th>
          <th>% Final AT</th>
          <th>Litros Descargados</th>
        </tr>
      </thead>
      <tbody id="transf-tbody">
        ${rows.map((r) => `
          <tr>
            <td>
              <div style="font-weight:600">${r.liquidaciones?.dia || '—'}</div>
              <span class="badge badge-${r.liquidaciones?.turno === 'Matutino' ? 'warning' : r.liquidaciones?.turno === 'Vespertino' ? 'cyan' : 'primary'}">${r.liquidaciones?.turno || '—'}</span>
            </td>
            <td><span class="badge badge-primary">${r.estaciones?.nombre || '—'}</span></td>
            <td class="td-bold">${r.cargador_nombre || '—'}</td>
            <td>${r.capacidad_at ? Number(r.capacidad_at).toLocaleString('es-MX') + ' L' : '—'}</td>
            <td>${r.pct_ini_at || 0}%</td>
            <td>${r.pct_fin_at || 0}%</td>
            <td style="color:var(--success); font-weight:bold;">+${r.litros_transferidos ? Number(r.litros_transferidos).toLocaleString('es-MX', {minimumFractionDigits: 2}) : 0} L</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p style="text-align:center; color:var(--text-muted); margin-top:20px; font-size:13px;">
      ℹ️ Las transferencias se registran y eliminan desde el módulo de <b>Liquidaciones</b>.
    </p>`;
}
