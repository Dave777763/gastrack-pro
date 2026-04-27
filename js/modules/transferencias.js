import { supabase } from '../supabase-config.js';
import { pageShell, emptyHTML, loadingHTML } from '../utils.js';

export async function renderTransferencias(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>🔄 Historial de Transferencias</h1><p>Descargas de Auto-Tanques a Estaciones</p></div>
    </div>
    <div class="page-content" id="transf-body"><div class="loading">⏳ Cargando...</div></div>`;
  await loadList();
}

async function loadList() {
  const { data, error } = await supabase.from('transferencias')
    .select('*, estaciones(nombre), cargadores(pva)').order('created_at',{ascending:false});
  const area = document.getElementById('transf-body');
  if (error) { area.innerHTML = `<p style="color:var(--danger);padding:20px">${error.message}</p>`; return; }
  if (!data.length) { area.innerHTML = emptyHTML('transferencia'); return; }
  
  area.innerHTML = `<div class="card"><table class="data-table"><thead><tr>
    <th>Fecha/Hora</th><th>Estación</th><th>Auto-Tanque</th>
    <th>Recibido (Estación)</th><th>Entregado (AT %)</th><th>Entregado (AT Medidor)</th></tr></thead><tbody>
    ${data.map(r=>{
      const medidor = (r.at_lectura_fin != null && r.at_lectura_ini != null) ? (r.at_lectura_fin - r.at_lectura_ini) : null;
      return `<tr>
      <td class="td-bold">${new Date(r.created_at).toLocaleString('es-MX')}</td>
      <td>${r.estaciones?.nombre||'—'}</td>
      <td><span class="badge badge-primary">${r.cargadores?.pva||r.cargador_nombre||'—'}</span></td>
      <td style="color:var(--success)">${r.litros_recibidos_est?Number(r.litros_recibidos_est).toLocaleString('es-MX')+' L':'—'}</td>
      <td style="color:var(--warning)">${r.litros_transferidos?Number(r.litros_transferidos).toLocaleString('es-MX')+' L':'—'}</td>
      <td style="color:var(--primary-light); font-weight:600">${medidor != null ? Number(medidor).toLocaleString('es-MX')+' L':'—'}</td>
    </tr>`}).join('')}
    </tbody></table></div>
    <p style="font-size:13px; color:var(--text-muted); margin-top:20px; text-align:center;">
      ℹ️ Las transferencias se capturan ahora desde el botón "+ Agregar Descarga" dentro del Asistente de Cortes de Turno (Liquidaciones).
    </p>`;
}
