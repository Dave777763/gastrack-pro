import { supabase } from '../supabase-config.js';
import { loadingHTML } from '../utils.js';

let CURRENT_TAB = 'ventas';
let DATE_FROM = new Date().toISOString().split('T')[0];
let DATE_TO = new Date().toISOString().split('T')[0];

export async function renderReportes(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>📈 Reportes y Analítica</h1><p>Consulta histórica de operaciones y auditoría</p></div>
    </div>
    <div class="page-content">
      <div class="card" style="margin-bottom:16px; padding:16px; display:flex; gap:16px; align-items:flex-end; background:var(--bg-secondary); border:1px solid var(--border)">
        <div class="form-group" style="margin:0"><label class="form-label">Desde</label><input type="date" id="rep-desde" class="form-control" value="${DATE_FROM}"></div>
        <div class="form-group" style="margin:0"><label class="form-label">Hasta</label><input type="date" id="rep-hasta" class="form-control" value="${DATE_TO}"></div>
        <button class="btn btn-primary" id="rep-btn-buscar" style="height:38px; padding:0 24px">🔍 Generar</button>
      </div>

      <div class="wizard-bar" style="margin-bottom:16px">
        <div style="display:flex; gap:0">
          <div class="rep-tab" data-tab="ventas" style="flex:1;text-align:center;padding:12px;cursor:pointer;border-bottom:3px solid ${CURRENT_TAB==='ventas'?'var(--primary)':'transparent'};font-weight:${CURRENT_TAB==='ventas'?'700':'500'};color:${CURRENT_TAB==='ventas'?'var(--text-primary)':'var(--text-muted)'};transition:all 0.2s">⛽ Ventas (Volumen)</div>
          <div class="rep-tab" data-tab="inventarios" style="flex:1;text-align:center;padding:12px;cursor:pointer;border-bottom:3px solid ${CURRENT_TAB==='inventarios'?'var(--primary)':'transparent'};font-weight:${CURRENT_TAB==='inventarios'?'700':'500'};color:${CURRENT_TAB==='inventarios'?'var(--text-primary)':'var(--text-muted)'};transition:all 0.2s">🛢️ Balance de Inventarios</div>
          <div class="rep-tab" data-tab="transferencias" style="flex:1;text-align:center;padding:12px;cursor:pointer;border-bottom:3px solid ${CURRENT_TAB==='transferencias'?'var(--primary)':'transparent'};font-weight:${CURRENT_TAB==='transferencias'?'700':'500'};color:${CURRENT_TAB==='transferencias'?'var(--text-primary)':'var(--text-muted)'};transition:all 0.2s">🔄 Mermas por Descarga</div>
        </div>
      </div>

      <div id="rep-body" class="card" style="padding:0; overflow-x:auto">
        ${loadingHTML()}
      </div>
    </div>
  `;
  
  document.getElementById('rep-btn-buscar').addEventListener('click', () => {
    DATE_FROM = document.getElementById('rep-desde').value;
    DATE_TO = document.getElementById('rep-hasta').value;
    loadTab();
  });
  
  document.querySelectorAll('.rep-tab').forEach(t => t.addEventListener('click', (e) => {
    CURRENT_TAB = e.currentTarget.dataset.tab;
    renderReportes(container); // Re-render shell to update active tab style
  }));

  loadTab();
}

async function loadTab() {
  const area = document.getElementById('rep-body');
  area.innerHTML = loadingHTML();
  
  if (CURRENT_TAB === 'ventas') await loadVentas(area);
  if (CURRENT_TAB === 'inventarios') await loadInventarios(area);
  if (CURRENT_TAB === 'transferencias') await loadTransferencias(area);
}

const fmt = (n, d=2) => Number(n).toLocaleString('es-MX', {minimumFractionDigits:d, maximumFractionDigits:d});

async function loadVentas(area) {
  const { data, error } = await supabase.from('liquidaciones')
    .select('*, estaciones(nombre)')
    .gte('dia', DATE_FROM)
    .lte('dia', DATE_TO)
    .order('dia', {ascending: false});
  
  if(error){ area.innerHTML=`<p style="padding:20px;color:red">${error.message}</p>`; return; }
  if(!data.length){ area.innerHTML=`<p style="padding:40px;text-align:center;color:var(--text-muted)">No hay cortes de turno en este rango de fechas.</p>`; return; }

  const totalLitros = data.reduce((s,x)=>s+Number(x.total_litros||0), 0);
  
  let html = `
    <div style="padding:20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:rgba(16,185,129,0.05)">
      <div>
        <h3 style="font-size:16px; margin-bottom:4px">Resumen de Ventas Operativas</h3>
        <p style="font-size:12px; color:var(--text-muted)">Suma de litros reportados en cortes de turno</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em">Volumen Total Vendido</div>
        <div style="font-size:24px; font-weight:800; color:var(--success)">${fmt(totalLitros)} L</div>
      </div>
    </div>
    <table class="data-table">
      <thead><tr><th>Fecha</th><th>Turno</th><th>Estación</th><th style="text-align:right">Litros Vendidos</th></tr></thead>
      <tbody>
        ${data.map(r=>`<tr>
          <td class="td-bold">${r.dia}</td>
          <td><span class="badge badge-cyan">${r.turno}</span></td>
          <td>${r.estaciones?.nombre||'—'}</td>
          <td style="text-align:right; font-weight:700; color:var(--text-primary)">${fmt(r.total_litros||0)} L</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
  area.innerHTML = html;
}

async function loadInventarios(area) {
  const { data: liqs, error: e1 } = await supabase.from('liquidaciones')
    .select('id, dia, turno, total_litros, estaciones(nombre), niveles_tanque_corte(idtanque, nombre, capacidad, pct_ini, pct_fin), transferencias(litros_recibidos_est, litros_transferidos)')
    .gte('dia', DATE_FROM)
    .lte('dia', DATE_TO)
    .order('dia', {ascending: false});
    
  if(e1){ area.innerHTML=`<p style="padding:20px;color:red">${e1.message}</p>`; return; }
  if(!liqs.length){ area.innerHTML=`<p style="padding:40px;text-align:center;color:var(--text-muted)">No hay registros en este rango de fechas.</p>`; return; }

  let totalDif = 0;

  let rows = liqs.map(r => {
    const invIni = (r.niveles_tanque_corte||[]).reduce((s,n)=>s+((n.pct_ini/100)*n.capacidad),0);
    const invFin = (r.niveles_tanque_corte||[]).reduce((s,n)=>s+((n.pct_fin/100)*n.capacidad),0);
    const recibos = (r.transferencias||[]).reduce((s,t)=>s+(t.litros_recibidos_est || t.litros_transferidos || 0),0);
    const ventas = r.total_litros||0;
    
    // Total Entregados = Inv Final + Ventas
    const ltsEntregados = invFin + ventas;
    // Total Recibidos = Inv Inicial + Transferencias
    const ltsRecibidos = invIni + recibos;
    // Diferencia
    const dif = ltsEntregados - ltsRecibidos;
    
    totalDif += dif;
    
    let colorBal = 'var(--text-primary)';
    if (dif > 1) colorBal = 'var(--warning)'; // Sobrante
    if (dif < -1) colorBal = 'var(--danger)'; // Faltante
    
    return `<tr>
      <td class="td-bold">${r.dia}</td>
      <td>${r.estaciones?.nombre||'—'}</td>
      <td style="color:var(--text-muted)">${fmt(ltsRecibidos)}</td>
      <td style="color:var(--text-muted)">${fmt(ltsEntregados)}</td>
      <td style="text-align:right; font-weight:800; color:${colorBal}">${dif>0?'+':''}${fmt(dif)} L</td>
    </tr>`;
  }).join('');

  let totalColor = 'var(--text-primary)';
  if (totalDif > 1) totalColor = 'var(--warning)';
  if (totalDif < -1) totalColor = 'var(--danger)';

  area.innerHTML = `
    <div style="padding:20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:rgba(99,102,241,0.05)">
      <div>
        <h3 style="font-size:16px; margin-bottom:4px">Balance de Inventarios (Entregados vs Recibidos)</h3>
        <p style="font-size:12px; color:var(--text-muted)">Dif = (Inv Final + Ventas) − (Inv Inicial + Transferencias Recibidas)</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em">Diferencia Neta Periodo</div>
        <div style="font-size:24px; font-weight:800; color:${totalColor}">${totalDif>0?'+':''}${fmt(totalDif)} L</div>
      </div>
    </div>
    <table class="data-table">
      <thead><tr><th>Fecha</th><th>Estación</th><th>Lts Recibidos (Ini+Transf)</th><th>Lts Entregados (Fin+Ventas)</th><th style="text-align:right">Sobrante / Faltante</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function loadTransferencias(area) {
  const { data, error } = await supabase.from('transferencias')
    .select('*, estaciones(nombre)')
    .gte('created_at', DATE_FROM + 'T00:00:00')
    .lte('created_at', DATE_TO + 'T23:59:59')
    .order('created_at', {ascending: false});
    
  if(error){ area.innerHTML=`<p style="padding:20px;color:red">${error.message}</p>`; return; }
  if(!data.length){ area.innerHTML=`<p style="padding:40px;text-align:center;color:var(--text-muted)">No hay transferencias en este rango de fechas.</p>`; return; }

  const totalRecibido = data.reduce((s,t)=>s+(t.litros_recibidos_est||0),0);
  const totalEntregado = data.reduce((s,t)=>s+(t.litros_transferidos||0),0);
  const mermasNetas = totalRecibido - totalEntregado;

  area.innerHTML = `
    <div style="padding:20px; border-bottom:1px solid var(--border); display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:16px; background:rgba(245,158,11,0.05)">
      <div><h3 style="font-size:16px;margin-bottom:4px">Mermas por Descarga</h3><p style="font-size:12px;color:var(--text-muted)">Cruce entre Auto-tanques y Estaciones</p></div>
      <div style="text-align:right">
        <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase">Gas Recibido Real</div>
        <div style="font-size:20px; font-weight:800; color:var(--success)">${fmt(totalRecibido)} L</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase">Gas Entregado (AT)</div>
        <div style="font-size:20px; font-weight:800; color:var(--warning)">${fmt(totalEntregado)} L</div>
      </div>
    </div>
    <table class="data-table">
      <thead><tr><th>Fecha</th><th>Estación</th><th>Auto-Tanque</th><th style="text-align:right">L. Recibidos</th><th style="text-align:right">L. Entregados AT</th><th style="text-align:right">Diferencia</th></tr></thead>
      <tbody>
        ${data.map(r=>{
          const dif = (r.litros_recibidos_est||0) - (r.litros_transferidos||0);
          return `<tr>
          <td class="td-bold">${new Date(r.created_at).toLocaleString('es-MX')}</td>
          <td>${r.estaciones?.nombre||'—'}</td>
          <td><span class="badge badge-primary">${r.cargador_nombre||'—'}</span></td>
          <td style="text-align:right; font-weight:600; color:var(--success)">${fmt(r.litros_recibidos_est||0)} L</td>
          <td style="text-align:right; font-weight:600; color:var(--warning)">${fmt(r.litros_transferidos||0)} L</td>
          <td style="text-align:right; font-weight:800; color:${Math.abs(dif)>20?'var(--danger)':'var(--success)'}">${fmt(dif)} L</td>
        </tr>`}).join('')}
      </tbody>
    </table>
  `;
}
