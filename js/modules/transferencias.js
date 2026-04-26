import { supabase } from '../supabase-config.js';
import { showToast, pageShell, emptyHTML, loadingHTML } from '../utils.js';

let W = {
  step: 1,
  idestacion: '', idcargador: '', idtanque_estacion: '',
  capacidad_at: 0, pva_at: '',
  capacidad_tanque: 0, nombre_tanque: '',
  lecturas: [], 
  est: { pct_ini: 0, pct_fin: 0 },
  at: { pct_ini: 0, pct_fin: 0, li: 0, lf: 0 }
};

export async function renderTransferencias(container) {
  W = { step:1, idestacion:'', idcargador:'', idtanque_estacion:'', capacidad_at:0, pva_at:'',
        capacidad_tanque:0, nombre_tanque:'', lecturas:[], est:{pct_ini:0,pct_fin:0}, at:{pct_ini:0,pct_fin:0,li:0,lf:0} };
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>🔄 Transferencias</h1><p>Descargas de Auto-Tanques a Estaciones</p></div>
      <button class="btn btn-primary" id="btn-nuevo">+ Nueva Transferencia</button>
    </div>
    <div class="page-content" id="transf-body"><div class="loading">⏳ Cargando...</div></div>`;
  await loadList();
  document.getElementById('btn-nuevo').addEventListener('click', () => renderWizard(container));
}

async function loadList() {
  const { data, error } = await supabase.from('transferencias')
    .select('*, estaciones(nombre), cargadores(pva)').order('created_at',{ascending:false});
  const area = document.getElementById('transf-body');
  if (error) { area.innerHTML = `<p style="color:var(--danger);padding:20px">${error.message}</p>`; return; }
  if (!data.length) { area.innerHTML = emptyHTML('transferencia'); return; }
  
  area.innerHTML = `<div class="card"><table class="data-table"><thead><tr>
    <th>Fecha/Hora</th><th>Estación</th><th>Auto-Tanque</th>
    <th>Recibido (Estación)</th><th>Entregado (AT)</th><th>Acciones</th></tr></thead><tbody>
    ${data.map(r=>`<tr>
      <td class="td-bold">${new Date(r.created_at).toLocaleString('es-MX')}</td>
      <td>${r.estaciones?.nombre||'—'}</td>
      <td><span class="badge badge-primary">${r.cargadores?.pva||r.cargador_nombre||'—'}</span></td>
      <td style="color:var(--success)">${r.litros_recibidos_est?Number(r.litros_recibidos_est).toLocaleString('es-MX')+' L':'—'}</td>
      <td style="color:var(--warning)">${r.litros_transferidos?Number(r.litros_transferidos).toLocaleString('es-MX')+' L':'—'}</td>
      <td><button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}">🗑️</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;
  document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>delTransf(b.dataset.del)));
}

async function delTransf(id){
  if(!confirm('¿Eliminar esta transferencia?')) return;
  const {error}=await supabase.from('transferencias').delete().eq('id',id);
  if(error){showToast('Error: '+error.message,'error');return;}
  showToast('Transferencia eliminada','success'); await loadList();
}

function renderWizard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>🔄 Nueva Transferencia</h1></div>
      <button class="btn btn-secondary" id="btn-cancelar">✕ Cancelar</button>
    </div>
    <div class="page-content">
      <div class="wizard-bar" id="wiz-bar"></div>
      <div class="card" style="margin-top:16px"><div id="wiz-step" style="padding:24px"></div></div>
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-secondary" id="btn-prev" style="display:none">← Anterior</button>
        <button class="btn btn-primary" id="btn-next">Siguiente →</button>
      </div>
    </div>`;
  document.getElementById('btn-cancelar').addEventListener('click',()=>renderTransferencias(container));
  document.getElementById('btn-prev').addEventListener('click',()=>goStep(W.step-1,container));
  document.getElementById('btn-next').addEventListener('click',()=>goStep(W.step+1,container));
  renderStep(container);
}

const STEPS=['Selección de Equipos','Datos Estación','Datos Auto-Tanque','Resumen y Cierre'];

function renderWizBar(){
  document.getElementById('wiz-bar').innerHTML=`<div style="display:flex;gap:0;margin-bottom:8px">
    ${STEPS.map((s,i)=>`
    <div style="flex:1;padding:10px 12px;font-size:12px;font-weight:600;text-align:center;
      background:${W.step===i+1?'linear-gradient(135deg,var(--primary),var(--secondary))':'var(--bg-card)'};
      color:${W.step===i+1?'#fff':'var(--text-muted)'};
      border:1px solid ${W.step===i+1?'var(--primary)':'var(--border)'};
      border-radius:${i===0?'8px 0 0 8px':i===3?'0 8px 8px 0':'0'}">
      ${i+1}. ${s}</div>`).join('')}
  </div>`;
}

async function goStep(next, container){
  if(next>W.step && !validateStep()) return;
  if(next===2 && W.step===1) await loadStationData();
  W.step=Math.max(1,Math.min(4,next));
  renderStep(container);
}

function renderStep(container){
  renderWizBar();
  document.getElementById('btn-prev').style.display = W.step>1?'':'none';
  const nextBtn=document.getElementById('btn-next');
  nextBtn.textContent = W.step===4?'💾 Guardar':'Siguiente →';
  if(W.step===4) { nextBtn.onclick=()=>saveTransf(container); }
  else { nextBtn.onclick=()=>goStep(W.step+1,container); }
  
  const area=document.getElementById('wiz-step');
  if(W.step===1) renderStep1(area);
  if(W.step===2) renderStep2(area);
  if(W.step===3) renderStep3(area);
  if(W.step===4) renderStep4(area);
}

// ─── STEP 1 ────────────────────────────────────────────────────────────────
let _cargadoresCache = [];
let _tanquesCache = [];
async function renderStep1(area){
  const [{data:ests},{data:cargs},{data:tanques}]=await Promise.all([
    supabase.from('estaciones').select('id,nombre').order('nombre'),
    supabase.from('cargadores').select('id,pva,tanques(capacidad)').order('pva'),
    supabase.from('tanques').select('id,nombre,capacidad,idestacion').order('nombre')
  ]);
  _cargadoresCache = cargs || [];
  _tanquesCache = tanques || [];
  
  const optsEst=(ests||[]).map(e=>`<option value="${e.id}" ${W.idestacion===e.id?'selected':''}>${e.nombre}</option>`).join('');
  const optsCarg=(_cargadoresCache).map(c=>`<option value="${c.id}" ${W.idcargador===c.id?'selected':''}>${c.pva}</option>`).join('');
  
  area.innerHTML=`
    <h3 style="margin-bottom:18px;font-size:15px;color:var(--text-primary)">Paso 1 — Equipos Involucrados</h3>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Estación Receptora *</label>
        <select id="s-est" class="form-control"><option value="">— Selecciona —</option>${optsEst}</select></div>
      <div class="form-group"><label class="form-label">Tanque de Estación *</label>
        <select id="s-tanq" class="form-control" ${!W.idestacion?'disabled':''}><option value="">— Selecciona —</option></select></div>
    </div>
    <div class="form-group" style="margin-top:10px"><label class="form-label">Auto-Tanque (Transferencia) *</label>
      <select id="s-carg" class="form-control"><option value="">— Selecciona —</option>${optsCarg}</select>
    </div>`;
    
  const fillTanques = (estId) => {
    const sel = document.getElementById('s-tanq');
    if(!estId){ sel.disabled=true; sel.innerHTML='<option value="">— Selecciona —</option>'; return; }
    sel.disabled=false;
    const filtered = _tanquesCache.filter(t=>t.idestacion===estId);
    sel.innerHTML = '<option value="">— Selecciona —</option>' + 
      filtered.map(t=>`<option value="${t.id}" ${W.idtanque_estacion===t.id?'selected':''}>${t.nombre} (${Number(t.capacidad).toLocaleString()} L)</option>`).join('');
  };
  
  document.getElementById('s-est').addEventListener('change',e=>{
    W.idestacion=e.target.value; W.lecturas=[]; fillTanques(W.idestacion);
  });
  if(W.idestacion) fillTanques(W.idestacion);
}

function validateStep(){
  if(W.step===1){
    W.idestacion=document.getElementById('s-est')?.value||W.idestacion;
    W.idtanque_estacion=document.getElementById('s-tanq')?.value||W.idtanque_estacion;
    W.idcargador=document.getElementById('s-carg')?.value||W.idcargador;
    if(!W.idestacion||!W.idtanque_estacion||!W.idcargador){ showToast('Completa todos los campos','error'); return false;}
    
    const carg = _cargadoresCache.find(c=>c.id===W.idcargador);
    if(carg) { W.capacidad_at = carg.tanques?.capacidad || 0; W.pva_at = carg.pva; }
    
    const tk = _tanquesCache.find(t=>t.id===W.idtanque_estacion);
    if(tk) { W.capacidad_tanque = tk.capacidad; W.nombre_tanque = tk.nombre; }
  }
  if(W.step===2){
    W.est.pct_ini = parseFloat(document.getElementById('est-pi')?.value||0);
    W.est.pct_fin = parseFloat(document.getElementById('est-pf')?.value||0);
    W.lecturas=W.lecturas.map(l=>({...l,
      li:parseFloat(document.getElementById(`li-${l.idpva}`)?.value||0),
      lf:parseFloat(document.getElementById(`lf-${l.idpva}`)?.value||0),
    }));
    if(W.lecturas.some(l=>l.lf<l.li)){showToast('Lecturas: Final debe ser ≥ Inicial','error');return false;}
  }
  if(W.step===3){
    W.at.pct_ini = parseFloat(document.getElementById('at-pi')?.value||0);
    W.at.pct_fin = parseFloat(document.getElementById('at-pf')?.value||0);
    W.at.li = parseFloat(document.getElementById('at-li')?.value||0);
    W.at.lf = parseFloat(document.getElementById('at-lf')?.value||0);
  }
  return true;
}

// ─── STEP 2 ────────────────────────────────────────────────────────────────
async function loadStationData(){
  if(!W.lecturas.length){
    const {data}=await supabase.from('pvas').select('id,pva').eq('idestacion',W.idestacion).order('pva');
    W.lecturas=(data||[]).map(p=>({idpva:p.id,nombre:p.pva,li:0,lf:0}));
  }
}

function renderStep2(area){
  area.innerHTML=`
    <h3 style="margin-bottom:18px;font-size:15px">Paso 2 — Recibo en Estación</h3>
    
    <div class="card" style="padding:16px; margin-bottom:16px; background:var(--bg-secondary)">
      <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px">🛢️ TANQUE: ${W.nombre_tanque} (${Number(W.capacidad_tanque).toLocaleString()} L)</h4>
      <div class="form-row">
        <div class="form-group"><label class="form-label">% Inicial (Antes de descargar)</label>
          <input id="est-pi" type="number" min="0" max="100" step="0.01" class="form-control" value="${W.est.pct_ini||''}"></div>
        <div class="form-group"><label class="form-label">% Final (Al terminar)</label>
          <input id="est-pf" type="number" min="0" max="100" step="0.01" class="form-control" value="${W.est.pct_fin||''}"></div>
      </div>
    </div>

    <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px">⛽ VENTAS DURANTE LA DESCARGA (PVAs)</h4>
    <table class="data-table"><thead><tr><th>PVA</th><th>Lectura Inicial</th><th>Lectura Final</th><th>Litros Fugados/Vendidos</th></tr></thead><tbody>
      ${W.lecturas.map(l=>`<tr>
        <td class="td-bold">${l.nombre}</td>
        <td><input id="li-${l.idpva}" type="number" class="form-control" style="width:130px" value="${l.li||''}"></td>
        <td><input id="lf-${l.idpva}" type="number" class="form-control" style="width:130px" value="${l.lf||''}"
          oninput="document.getElementById('dif-${l.idpva}').textContent=(parseFloat(this.value)||0)-(parseFloat(document.getElementById('li-${l.idpva}').value)||0)+' L'"></td>
        <td id="dif-${l.idpva}" style="color:var(--warning);font-weight:600">${(l.lf-l.li)||0} L</td>
      </tr>`).join('')}
    </tbody></table>`;
}

// ─── STEP 3 ────────────────────────────────────────────────────────────────
function renderStep3(area){
  area.innerHTML=`
    <h3 style="margin-bottom:18px;font-size:15px">Paso 3 — Entrega de Auto-Tanque</h3>
    
    <div class="card" style="padding:16px; margin-bottom:16px; background:var(--bg-secondary)">
      <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px">🛢️ NIVELES DEL AUTO-TANQUE: ${W.pva_at} (${Number(W.capacidad_at).toLocaleString()} L)</h4>
      <div class="form-row">
        <div class="form-group"><label class="form-label">% Inicial AT</label>
          <input id="at-pi" type="number" min="0" max="100" step="0.01" class="form-control" value="${W.at.pct_ini||''}"></div>
        <div class="form-group"><label class="form-label">% Final AT</label>
          <input id="at-pf" type="number" min="0" max="100" step="0.01" class="form-control" value="${W.at.pct_fin||''}"></div>
      </div>
    </div>

    <div class="card" style="padding:16px; background:var(--bg-secondary)">
      <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px">⛽ MEDIDOR DEL AUTO-TANQUE</h4>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Lectura Inicial AT</label>
          <input id="at-li" type="number" class="form-control" value="${W.at.li||''}"></div>
        <div class="form-group"><label class="form-label">Lectura Final AT</label>
          <input id="at-lf" type="number" class="form-control" value="${W.at.lf||''}"></div>
      </div>
    </div>`;
}

// ─── STEP 4 ────────────────────────────────────────────────────────────────
function renderStep4(area){
  // Cálculos Estación
  const ltsSubieronTanque = ((W.est.pct_fin - W.est.pct_ini)/100) * W.capacidad_tanque;
  const ltsVendidosPVA = W.lecturas.reduce((s,l)=>s+(l.lf-l.li),0);
  const ltsRecibidosReales = ltsSubieronTanque + ltsVendidosPVA;

  // Cálculos Auto-Tanque
  const ltsEntregadosPorPct = ((W.at.pct_ini - W.at.pct_fin)/100) * W.capacidad_at;
  const ltsEntregadosPorMedidor = W.at.lf - W.at.li;

  const difMedidor = ltsRecibidosReales - ltsEntregadosPorMedidor;
  const difPct = ltsRecibidosReales - ltsEntregadosPorPct;

  const fmt=(n)=>Number(n).toLocaleString('es-MX',{minimumFractionDigits:2, maximumFractionDigits:2});

  area.innerHTML=`
    <h3 style="margin-bottom:20px;font-size:15px">Paso 4 — Resumen del Cruce de Datos</h3>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="stat-card" style="border:1px solid var(--success)"><div class="stat-icon" style="background:rgba(16,185,129,0.15)">📥</div>
        <div class="stat-info"><h3>${fmt(ltsRecibidosReales)} L</h3><p>Recibidos Exactos (Estación)</p></div></div>
      <div class="stat-card" style="border:1px solid var(--warning)"><div class="stat-icon" style="background:rgba(245,158,11,0.15)">📤</div>
        <div class="stat-info"><h3>${fmt(ltsEntregadosPorPct)} L</h3><p>Entregados (Según % de AT)</p></div></div>
    </div>

    <div class="card" style="padding:16px;margin-bottom:16px">
      <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase">ESTACIÓN: CÁLCULO DE RECIBO</h4>
      <table class="data-table"><tbody>
        <tr><td>Gas que subió en el Tanque Físicamente</td><td style="color:var(--accent)">+${fmt(ltsSubieronTanque)} L</td></tr>
        <tr><td>Gas fugado/vendido por bombas</td><td style="color:var(--accent)">+${fmt(ltsVendidosPVA)} L</td></tr>
        <tr style="font-weight:700"><td>= TOTAL REAL RECIBIDO</td><td style="color:var(--success)">${fmt(ltsRecibidosReales)} L</td></tr>
      </tbody></table>
    </div>

    <div class="card" style="padding:16px">
      <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase">AUTO-TANQUE: CÁLCULO DE ENTREGA Y MERMAS</h4>
      <table class="data-table"><tbody>
        <tr><td>Entrega según Medidor AT</td><td>${fmt(ltsEntregadosPorMedidor)} L</td></tr>
        <tr><td><b>Diferencia contra Medidor AT</b></td><td style="color:${Math.abs(difMedidor)>10?'var(--danger)':'var(--success)'}">${fmt(difMedidor)} L</td></tr>
        <tr><td colspan="2" style="border-top:1px solid var(--border);height:4px"></td></tr>
        <tr><td>Entrega según % Porcentaje AT</td><td>${fmt(ltsEntregadosPorPct)} L</td></tr>
        <tr><td><b>Diferencia contra % AT</b></td><td style="color:${Math.abs(difPct)>20?'var(--danger)':'var(--success)'}">${fmt(difPct)} L</td></tr>
      </tbody></table>
    </div>`;

  // Save state for insertion
  W._ltsRecibidos = ltsRecibidosReales;
  W._ltsVentas = ltsVendidosPVA;
  W._ltsEntregadosPct = ltsEntregadosPorPct;
}

// ─── SAVE ───────────────────────────────────────────────────────────────────
async function saveTransf(container){
  try {
    const payload = {
      idestacion: W.idestacion,
      idcargador: W.idcargador,
      cargador_nombre: W.pva_at,
      capacidad_at: W.capacidad_at,
      idtanque_estacion: W.idtanque_estacion,
      estacion_pct_ini: W.est.pct_ini,
      estacion_pct_fin: W.est.pct_fin,
      pct_ini_at: W.at.pct_ini,
      pct_fin_at: W.at.pct_fin,
      at_lectura_ini: W.at.li,
      at_lectura_fin: W.at.lf,
      litros_venta_durante: W._ltsVentas,
      litros_recibidos_est: W._ltsRecibidos,
      litros_transferidos: W._ltsEntregadosPct
    };

    const {data:transf, error:e1} = await supabase.from('transferencias').insert(payload).select().single();
    if(e1) throw e1;

    if(W.lecturas.length){
      const {error:e2} = await supabase.from('lecturas_transferencia').insert(
        W.lecturas.map(l=>({
          idtransferencia: transf.id,
          idpva: l.idpva,
          pva_nombre: l.nombre,
          lectura_ini: l.li,
          lectura_fin: l.lf
        }))
      );
      if(e2) throw e2;
    }

    showToast('✅ Transferencia guardada con éxito','success');
    renderTransferencias(container);
  } catch(err){
    showToast('Error al guardar: '+err.message,'error');
  }
}
