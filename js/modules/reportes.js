import { supabase } from '../supabase-config.js';
import { loadingHTML, showModal } from '../utils.js';

let CURRENT_TAB = 'inventarios'; // Default to the main requested report
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
          <div class="rep-tab" data-tab="inventarios" style="flex:1;text-align:center;padding:12px;cursor:pointer;border-bottom:3px solid ${CURRENT_TAB==='inventarios'?'var(--primary)':'transparent'};font-weight:${CURRENT_TAB==='inventarios'?'700':'500'};color:${CURRENT_TAB==='inventarios'?'var(--text-primary)':'var(--text-muted)'};transition:all 0.2s">🛢️ Balance de Estaciones</div>
          <div class="rep-tab" data-tab="transferencias" style="flex:1;text-align:center;padding:12px;cursor:pointer;border-bottom:3px solid ${CURRENT_TAB==='transferencias'?'var(--primary)':'transparent'};font-weight:${CURRENT_TAB==='transferencias'?'700':'500'};color:${CURRENT_TAB==='transferencias'?'var(--text-primary)':'var(--text-muted)'};transition:all 0.2s">🔄 Balance Transferencias</div>
          <div class="rep-tab" data-tab="ventas" style="flex:1;text-align:center;padding:12px;cursor:pointer;border-bottom:3px solid ${CURRENT_TAB==='ventas'?'var(--primary)':'transparent'};font-weight:${CURRENT_TAB==='ventas'?'700':'500'};color:${CURRENT_TAB==='ventas'?'var(--text-primary)':'var(--text-muted)'};transition:all 0.2s">⛽ Ventas (Volumen)</div>
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
    renderReportes(container);
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
const c_str = (n) => `<span style="color:${n>1?'var(--warning)':n<-1?'var(--danger)':'var(--text-primary)'}">${n>0?'+':''}${fmt(n)}</span>`;

// ─── 1. BALANCE DE ESTACIONES ───────────────────────────────────────────────
async function loadInventarios(area) {
  const { data: liqs, error: e1 } = await supabase.from('liquidaciones')
    .select('id, dia, turno, total_litros, estaciones(nombre), niveles_tanque_corte(idtanque, nombre, capacidad, pct_ini, pct_fin), transferencias(litros_recibidos_est, litros_transferidos, at_lectura_ini, at_lectura_fin)')
    .gte('dia', DATE_FROM)
    .lte('dia', DATE_TO)
    .order('dia', {ascending: true}); // Sort ASC to calculate running total (acumulado)
    
  if(e1){ area.innerHTML=`<p style="padding:20px;color:red">${e1.message}</p>`; return; }
  if(!liqs.length){ area.innerHTML=`<p style="padding:40px;text-align:center;color:var(--text-muted)">No hay registros en este rango de fechas.</p>`; return; }

  let acum = {};
  
  const processed = liqs.map(r => {
    const estId = r.estaciones?.nombre || 'Desconocida';
    if(typeof acum[estId] === 'undefined') acum[estId] = 0;

    // String for %I and %F (in case of multiple tanks)
    const pctI = (r.niveles_tanque_corte||[]).map(n => `${n.pct_ini}%`).join('<br>');
    const pctF = (r.niveles_tanque_corte||[]).map(n => `${n.pct_fin}%`).join('<br>');

    // A: Existencia inicial
    const A = (r.niveles_tanque_corte||[]).reduce((s,n)=>s+((n.pct_ini/100)*n.capacidad),0);
    // B: Transferencias
    const B = (r.transferencias||[]).reduce((s,t)=>s+(t.litros_recibidos_est || t.litros_transferidos || 0),0);
    // C = A + B (Recibidos)
    const C = A + B;

    // D: Ventas
    const D = r.total_litros||0;
    // E: Existencia final
    const E = (r.niveles_tanque_corte||[]).reduce((s,n)=>s+((n.pct_fin/100)*n.capacidad),0);
    // F = D + E (Entregados)
    const F = D + E;

    // Inventario = F - C (Entregados - Recibidos)
    const inventario = F - C;
    
    // Inv Acumulado
    acum[estId] += inventario;
    const invAcum = acum[estId];

    // Balance Transferencia (Suma de las transferencias de este corte: E = D - B de transferencias)
    const balanceTransf = (r.transferencias||[]).reduce((s,t) => {
      const b_med = (t.at_lectura_fin||0) - (t.at_lectura_ini||0);
      const d_rec = t.litros_recibidos_est || t.litros_transferidos || 0;
      return s + (d_rec - b_med);
    }, 0);

    return { ...r, estId, pctI, pctF, A, B, C, D, E, F, inventario, invAcum, balanceTransf };
  });

  // Sort descending for display
  processed.sort((a,b) => new Date(b.dia) - new Date(a.dia));

  let rows = processed.map(r => `<tr>
    <td>${r.estId}</td>
    <td class="td-bold">${r.dia}</td>
    <td><span class="badge badge-cyan">${r.turno}</span></td>
    <td style="font-size:11px;color:var(--text-muted)">${r.pctI}</td>
    <td>${fmt(r.A)}</td>
    <td style="color:var(--success)">${fmt(r.B)}</td>
    <td style="font-weight:bold;background:rgba(255,255,255,0.02)">${fmt(r.C)}</td>
    
    <td style="color:var(--danger)">${fmt(r.D)}</td>
    <td style="font-size:11px;color:var(--text-muted)">${r.pctF}</td>
    <td>${fmt(r.E)}</td>
    <td style="font-weight:bold;background:rgba(255,255,255,0.02)">${fmt(r.F)}</td>
    
    <td style="font-weight:bold">${c_str(r.inventario)}</td>
    <td style="font-weight:bold">${c_str(r.invAcum)}</td>
    <td style="font-weight:bold">${c_str(r.balanceTransf)}</td>
  </tr>`).join('');

  area.innerHTML = `
    <div style="padding:16px; border-bottom:1px solid var(--border); background:rgba(99,102,241,0.05)">
      <h3 style="font-size:16px; margin-bottom:4px">Balance de Estaciones</h3>
      <p style="font-size:12px; color:var(--text-muted)">Cálculo detallado: Recibidos (C=A+B) vs Entregados (F=D+E)</p>
    </div>
    <div style="overflow-x:auto;">
      <table class="data-table" style="min-width:1200px; font-size:13px">
        <thead>
          <tr style="font-size:11px">
            <th colspan="3"></th>
            <th colspan="4" style="background:rgba(16,185,129,0.1);text-align:center">LTS RECIBIDOS</th>
            <th colspan="4" style="background:rgba(245,158,11,0.1);text-align:center">LTS ENTREGADOS</th>
            <th colspan="3" style="text-align:center">BALANCES</th>
          </tr>
          <tr>
            <th>Estación</th><th>Día</th><th>Turno</th>
            <th>%I</th><th>A (Ex. Inic)</th><th>B (Transf)</th><th style="background:rgba(255,255,255,0.02)">C=A+B</th>
            <th>D (Ventas)</th><th>%F</th><th>E (Ex. Final)</th><th style="background:rgba(255,255,255,0.02)">F=D+E</th>
            <th>Inventario (F-C)</th><th>Inv Acum</th><th>Bal. Transf</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ─── 2. BALANCE TRANSFERENCIAS ──────────────────────────────────────────────
async function loadTransferencias(area) {
  const { data, error } = await supabase.from('transferencias')
    .select('*, estaciones(nombre), liquidaciones(dia, turno)')
    .gte('created_at', DATE_FROM + 'T00:00:00')
    .lte('created_at', DATE_TO + 'T23:59:59')
    .order('created_at', {ascending: false});
    
  if(error){ area.innerHTML=`<p style="padding:20px;color:red">${error.message}</p>`; return; }
  if(!data.length){ area.innerHTML=`<p style="padding:40px;text-align:center;color:var(--text-muted)">No hay transferencias en este rango de fechas.</p>`; return; }

  area.innerHTML = `
    <div style="padding:16px; border-bottom:1px solid var(--border); background:rgba(245,158,11,0.05)">
      <h3 style="font-size:16px;margin-bottom:4px">Balance Transferencias</h3>
      <p style="font-size:12px;color:var(--text-muted)">Evaluación de descargas: Medidor AT (B) vs Recibido Estación (D)</p>
    </div>
    <div style="overflow-x:auto;">
      <table class="data-table" style="min-width:1000px; font-size:13px">
        <thead>
          <tr style="font-size:11px">
            <th colspan="5"></th>
            <th colspan="3" style="background:rgba(139,92,246,0.1);text-align:center">AUTO-TANQUE (AT)</th>
            <th colspan="2" style="background:rgba(16,185,129,0.1);text-align:center">ESTACIÓN</th>
          </tr>
          <tr>
            <th>Estación</th><th>Día</th><th>Turno</th><th>%I (AT)</th><th>%F (AT)</th>
            <th>A (Lts % Existencia)</th><th>B (Lts Medidor)</th><th style="background:rgba(255,255,255,0.02)">C=B-A (Inv. Transf)</th>
            <th>D (Lts Recibidos Est)</th><th style="background:rgba(255,255,255,0.02)">E=D-B (Balance Transf)</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r=>{
            const dia = r.liquidaciones?.dia || new Date(r.created_at).toLocaleDateString('es-MX');
            const turno = r.liquidaciones?.turno || '—';
            
            const A = ((r.pct_ini_at||0) - (r.pct_fin_at||0)) / 100 * (r.capacidad_at||0);
            const B = (r.at_lectura_fin||0) - (r.at_lectura_ini||0);
            const C = B - A;
            
            const D = r.litros_recibidos_est || r.litros_transferidos || 0;
            const E = D - B;

            return `<tr>
            <td class="td-bold">${r.estaciones?.nombre||'—'}</td>
            <td>${dia}</td>
            <td><span class="badge badge-cyan">${turno}</span></td>
            <td style="color:var(--text-muted)">${r.pct_ini_at||0}%</td>
            <td style="color:var(--text-muted)">${r.pct_fin_at||0}%</td>
            
            <td>${fmt(A)}</td>
            <td style="font-weight:600;color:var(--primary)">${fmt(B)}</td>
            <td style="font-weight:bold;background:rgba(255,255,255,0.02)">${c_str(C)}</td>
            
            <td style="font-weight:600;color:var(--success)">${fmt(D)}</td>
            <td style="font-weight:bold;background:rgba(255,255,255,0.02)">${c_str(E)}</td>
          </tr>`}).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─── 3. VENTAS (VOLUMEN) ──────────────────────────────────────────────────
async function loadVentas(area) {
  const { data, error } = await supabase.from('liquidaciones')
    .select('*, estaciones(nombre)')
    .gte('dia', DATE_FROM)
    .lte('dia', DATE_TO)
    .order('dia', {ascending: false});
  
  if(error){ area.innerHTML=`<p style="padding:20px;color:red">${error.message}</p>`; return; }
  if(!data.length){ area.innerHTML=`<p style="padding:40px;text-align:center;color:var(--text-muted)">No hay cortes de turno en este rango de fechas.</p>`; return; }

  const totalLitros = data.reduce((s,x)=>s+Number(x.total_litros||0), 0);
  
  area.innerHTML = `
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
}
