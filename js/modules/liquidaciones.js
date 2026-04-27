import { supabase } from '../supabase-config.js';
import { showToast, showModal, closeModal } from '../utils.js';

let W = {
  step: 1,
  idestacion: '', dia: new Date().toISOString().split('T')[0],
  turno: 'Matutino', idemp: '', precio_litro: 0,
  lecturas: [], niveles: [], transf: []
};

// Cache de catálogos para el modal de transferencia
let _pvasCache = [];
let _cargadoresCache = [];
let _tanquesCache = [];

export async function renderLiquidaciones(container) {
  W = { step:1, idestacion:'', dia: new Date().toISOString().split('T')[0],
        turno:'Matutino', idemp:'', precio_litro:0, lecturas:[], niveles:[], transf:[] };
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>📋 Liquidaciones</h1><p>Cortes de turno — ventas, inventarios y recibos de gas</p></div>
      <button class="btn btn-primary" id="btn-nuevo">+ Nuevo Corte</button>
    </div>
    <div class="page-content" id="liq-body"><div class="loading">⏳ Cargando...</div></div>`;
  await loadList();
  document.getElementById('btn-nuevo').addEventListener('click', () => renderWizard(container));
}

async function loadList() {
  const { data, error } = await supabase.from('liquidaciones')
    .select('*, estaciones(nombre), empleados(nombre,paterno)').order('dia',{ascending:false});
  const area = document.getElementById('liq-body');
  if (error) { area.innerHTML = `<p style="color:var(--danger);padding:20px">${error.message}</p>`; return; }
  if (!data.length) {
    area.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div>
      <h3>Sin cortes registrados</h3><p>Usa "+ Nuevo Corte" para capturar el primer turno</p></div>`;
    return;
  }
  area.innerHTML = `<div class="card"><table class="data-table"><thead><tr>
    <th>Fecha</th><th>Turno</th><th>Estación</th><th>Empleado</th>
    <th>Litros</th><th>Acciones</th></tr></thead><tbody>
    ${data.map(r=>`<tr>
      <td class="td-bold">${r.dia}</td>
      <td><span class="badge badge-${turnoClr(r.turno)}">${r.turno}</span></td>
      <td>${r.estaciones?.nombre||'—'}</td>
      <td>${r.empleados?`${r.empleados.nombre} ${r.empleados.paterno}`:'—'}</td>
      <td class="td-bold">${r.total_litros?Number(r.total_litros).toLocaleString('es-MX',{minimumFractionDigits:2})+' L':'—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-primary btn-icon btn-sm" data-view="${r.id}" title="Ver Detalles">👁️</button>
        <button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}" title="Eliminar">🗑️</button>
      </td>
    </tr>`).join('')}
    </tbody></table></div>`;
  document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>delCorte(b.dataset.del)));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>viewCorte(b.dataset.view)));
}

function turnoClr(t){ return t==='Matutino'?'warning':t==='Vespertino'?'cyan':'primary'; }

async function delCorte(id){
  if(!confirm('¿Eliminar este corte?')) return;
  const {error}=await supabase.from('liquidaciones').delete().eq('id',id);
  if(error){showToast('Error: '+error.message,'error');return;}
  showToast('Corte eliminado','success'); await loadList();
}

async function viewCorte(id) {
  const { data: liq, error } = await supabase.from('liquidaciones')
    .select(`
      *,
      estaciones(nombre),
      empleados(nombre,paterno),
      lecturas_corte(pva_nombre, lectura_ini, lectura_fin),
      niveles_tanque_corte(nombre, capacidad, pct_ini, pct_fin),
      transferencias(cargador_nombre, litros_recibidos_est, litros_transferidos, estacion_pct_ini, estacion_pct_fin, litros_venta_durante, tanques(nombre, capacidad))
    `)
    .eq('id', id)
    .single();
  
  if (error) { showToast('Error cargando detalles del corte', 'error'); return; }
  
  const fmt = (n, d=2) => Number(n).toLocaleString('es-MX',{minimumFractionDigits:d, maximumFractionDigits:d});
  
  let html = `
    <style>
      #global-modal .modal { width: 750px !important; max-width: 95vw !important; }
    </style>
    <div class="modal-header">
      <h2>Detalle del Corte - ${liq.dia}</h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body" style="max-height:80vh; overflow-y:auto; padding:24px; font-size:14px; background:var(--bg-primary)">
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
        <div style="padding:16px; background:var(--bg-secondary); border-radius:8px; border:1px solid var(--border)">
          <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Estación y Turno</div>
          <div style="font-size:18px;font-weight:700">${liq.estaciones?.nombre} <span class="badge badge-${turnoClr(liq.turno)}" style="font-size:12px;vertical-align:middle">${liq.turno}</span></div>
        </div>
        <div style="padding:16px; background:var(--bg-secondary); border-radius:8px; border:1px solid var(--border)">
          <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Empleado Responsable</div>
          <div style="font-size:18px;font-weight:700">${liq.empleados?`${liq.empleados.nombre} ${liq.empleados.paterno||''}`:'—'}</div>
        </div>
      </div>

      <div style="margin-bottom:24px; background:var(--bg-card); border-radius:8px; border:1px solid var(--border); overflow-x:auto">
        <h3 style="padding:12px 16px; background:rgba(16,185,129,0.1); border-bottom:1px solid var(--border); font-size:14px; margin:0">⛽ 1. VENTAS (PUNTOS DE VENTA)</h3>
        <table class="data-table" style="margin:0">
          <thead><tr><th>PVA</th><th style="text-align:right">Lectura Inicial</th><th style="text-align:right">Lectura Final</th><th style="text-align:right">Litros Vendidos</th></tr></thead>
          <tbody>
            ${(liq.lecturas_corte||[]).map(l => {
              const diff = (l.lectura_fin||0) - (l.lectura_ini||0);
              return `<tr>
                <td style="font-weight:600">${l.pva_nombre || '—'}</td>
                <td style="text-align:right;color:var(--text-muted)">${fmt(l.lectura_ini)}</td>
                <td style="text-align:right;color:var(--text-muted)">${fmt(l.lectura_fin)}</td>
                <td style="text-align:right;font-weight:700;color:var(--text-primary)">${fmt(diff)} L</td>
              </tr>`;
            }).join('')}
            <tr style="background:rgba(255,255,255,0.02)">
              <td colspan="3" style="text-align:right;font-size:12px;color:var(--text-muted);text-transform:uppercase">Volumen Total Vendido</td>
              <td style="text-align:right;font-weight:800;color:var(--success);font-size:16px">${fmt(liq.total_litros)} L</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-bottom:24px; background:var(--bg-card); border-radius:8px; border:1px solid var(--border); overflow-x:auto">
        <h3 style="padding:12px 16px; background:rgba(99,102,241,0.1); border-bottom:1px solid var(--border); font-size:14px; margin:0">🛢️ 2. NIVELES DE TANQUES</h3>
        <table class="data-table" style="margin:0">
          <thead><tr><th>Tanque</th><th>Capacidad</th><th style="text-align:center">% Inicial</th><th style="text-align:right">Lts Iniciales</th><th style="text-align:center">% Final</th><th style="text-align:right">Lts Finales</th></tr></thead>
          <tbody>
            ${(liq.niveles_tanque_corte||[]).map(n => {
              const cap = n.capacidad||0;
              const ltsIni = (n.pct_ini/100)*cap;
              const ltsFin = (n.pct_fin/100)*cap;
              return `<tr>
                <td style="font-weight:600">${n.nombre || '—'}</td>
                <td style="color:var(--text-muted)">${fmt(cap)} L</td>
                <td style="text-align:center;color:var(--text-muted)">${n.pct_ini}%</td>
                <td style="text-align:right;color:var(--text-muted)">${fmt(ltsIni)} L</td>
                <td style="text-align:center;font-weight:600">${n.pct_fin}%</td>
                <td style="text-align:right;font-weight:700">${fmt(ltsFin)} L</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="background:var(--bg-card); border-radius:8px; border:1px solid var(--border); overflow-x:auto">
        <h3 style="padding:12px 16px; background:rgba(245,158,11,0.1); border-bottom:1px solid var(--border); font-size:14px; margin:0">🔄 3. DESCARGAS DE PIPAS EN ESTE TURNO</h3>
        ${(!liq.transferencias || liq.transferencias.length === 0) 
          ? `<div style="padding:24px;text-align:center;color:var(--text-muted)">No se registraron transferencias / recibos en este turno.</div>`
          : `<table class="data-table" style="margin:0">
              <thead><tr><th>Auto-Tanque</th><th style="text-align:right">Lts Medidor Pipa</th><th style="text-align:right">Lts Recibidos (Estación)</th></tr></thead>
              <tbody>
                ${liq.transferencias.map(t => {
                  const r_est = t.litros_recibidos_est || t.litros_transferidos || 0;
                  
                  // Desglose de la integración
                  let desglose = '';
                  if (t.estacion_pct_ini != null && t.estacion_pct_fin != null && t.tanques?.capacidad) {
                    const ltsTanque = ((t.estacion_pct_fin - t.estacion_pct_ini) / 100) * t.tanques.capacidad;
                    const ltsVentas = t.litros_venta_durante || 0;
                    desglose = `<div style="font-size:11px; color:var(--text-muted); font-weight:normal; margin-top:4px; line-height:1.3">
                      Lts Subieron Tanque: ${fmt(ltsTanque)} L<br>
                      + Ventas en Descarga: ${fmt(ltsVentas)} L
                    </div>`;
                  }
                  
                  return `<tr>
                    <td style="vertical-align:top"><span class="badge badge-primary">${t.cargador_nombre}</span></td>
                    <td style="text-align:right;color:var(--text-muted);vertical-align:top">${fmt(t.litros_transferidos)} L</td>
                    <td style="text-align:right;vertical-align:top">
                      <div style="font-weight:700;color:var(--success);font-size:15px">${fmt(r_est)} L</div>
                      ${desglose}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;
  
  showModal(html, overlay => {
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  });
}

function renderWizard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>📋 Nuevo Corte de Turno</h1></div>
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
  document.getElementById('btn-cancelar').addEventListener('click',()=>renderLiquidaciones(container));
  document.getElementById('btn-prev').addEventListener('click',()=>goStep(W.step-1,container));
  document.getElementById('btn-next').addEventListener('click',()=>goStep(W.step+1,container));
  renderStep(container);
}

const STEPS=['Datos Generales','Lecturas PVA','Tanques y Transferencias','Resumen'];

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
  if(next===2 && W.step===1) await loadPVAs();
  if(next===3 && W.step===2) await loadTanques();
  W.step=Math.max(1,Math.min(4,next));
  renderStep(container);
}

function renderStep(container){
  renderWizBar();
  document.getElementById('btn-prev').style.display = W.step>1?'':'none';
  const nextBtn=document.getElementById('btn-next');
  nextBtn.textContent = W.step===4?'💾 Guardar':'Siguiente →';
  if(W.step===4) { nextBtn.onclick=()=>saveCorte(container); }
  else { nextBtn.onclick=()=>goStep(W.step+1,container); }
  const area=document.getElementById('wiz-step');
  if(W.step===1) renderStep1(area);
  if(W.step===2) renderStep2(area);
  if(W.step===3) renderStep3(area);
  if(W.step===4) renderStep4(area);
}

// ─── Step 1 ────────────────────────────────────────────────────────────────
async function renderStep1(area){
  const [{data:ests},{data:emps}]=await Promise.all([
    supabase.from('estaciones').select('id,nombre').order('nombre'),
    supabase.from('empleados').select('id,nombre,paterno,rol').order('paterno'),
  ]);
  const optsEst=(ests||[]).map(e=>`<option value="${e.id}" ${W.idestacion===e.id?'selected':''}>${e.nombre}</option>`).join('');
  area.innerHTML=`
    <h3 style="margin-bottom:18px;font-size:15px;color:var(--text-primary)">Paso 1 — Datos del Corte</h3>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Estación *</label>
        <select id="s-est" class="form-control"><option value="">— Selecciona —</option>${optsEst}</select></div>
      <div class="form-group"><label class="form-label">Fecha *</label>
        <input id="s-dia" type="date" class="form-control" value="${W.dia}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Turno *</label>
        <select id="s-turno" class="form-control">
          ${['Matutino','Vespertino','Nocturno'].map(t=>`<option ${W.turno===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Empleado responsable del corte *</label>
        <select id="s-emp" class="form-control"><option value="">— Selecciona —</option>
          ${(emps||[]).map(e=>`<option value="${e.id}" ${W.idemp===e.id?'selected':''}>${e.paterno} ${e.nombre} (${e.rol})</option>`).join('')}
        </select></div>
    </div>`;
  document.getElementById('s-est').addEventListener('change',e=>{
    W.idestacion=e.target.value; W.lecturas=[]; W.niveles=[]; W.transf=[];
  });
}

function validateStep(){
  if(W.step===1){
    W.idestacion=document.getElementById('s-est')?.value||W.idestacion;
    W.dia=document.getElementById('s-dia')?.value||W.dia;
    W.turno=document.getElementById('s-turno')?.value||W.turno;
    W.idemp=document.getElementById('s-emp')?.value||W.idemp;
    if(!W.idestacion||!W.dia||!W.turno||!W.idemp){
      showToast('Completa todos los campos','error'); return false;}
  }
  if(W.step===2){
    W.lecturas=W.lecturas.map(l=>({...l,
      li:parseFloat(document.getElementById(`li-${l.idpva}`)?.value||0),
      lf:parseFloat(document.getElementById(`lf-${l.idpva}`)?.value||0),
    }));
    if(W.lecturas.some(l=>l.lf<l.li)){showToast('Lectura Final debe ser ≥ Lectura Inicial','error');return false;}
  }
  if(W.step===3){
    W.niveles=W.niveles.map(n=>({...n,
      pct_ini:parseFloat(document.getElementById(`ni-${n.idtanque}`)?.value||0),
      pct_fin:parseFloat(document.getElementById(`nf-${n.idtanque}`)?.value||0),
    }));
  }
  return true;
}

// ─── Step 2 ────────────────────────────────────────────────────────────────
async function loadPVAs(){
  const {data}=await supabase.from('pvas').select('id,pva').eq('idestacion',W.idestacion).order('pva');
  _pvasCache = data || [];
  
  const { data: lastCorte } = await supabase.from('liquidaciones')
    .select('id, lecturas_corte(idpva, lectura_fin)')
    .eq('idestacion', W.idestacion)
    .order('created_at', { ascending: false })
    .limit(1);

  const prevLecturas = lastCorte?.[0]?.lecturas_corte || [];

  if(!W.lecturas.length) {
    W.lecturas=(_pvasCache).map(p=>{
      const past = prevLecturas.find(l => l.idpva === p.id);
      return {idpva:p.id, nombre:p.pva, li: past ? past.lectura_fin : '', lf:''};
    });
  }
}

function renderStep2(area){
  area.innerHTML=`
    <h3 style="margin-bottom:18px;font-size:15px">Paso 2 — Lecturas de Medidores del Turno (PVAs)</h3>
    <table class="data-table"><thead><tr>
      <th>PVA</th><th>Lectura Inicial</th><th>Lectura Final</th><th>Litros</th>
    </tr></thead><tbody>
      ${W.lecturas.map(l=>`<tr>
        <td class="td-bold">${l.nombre}</td>
        <td><input id="li-${l.idpva}" type="number" class="form-control" style="width:130px" value="${l.li||''}" placeholder="0.00"></td>
        <td><input id="lf-${l.idpva}" type="number" class="form-control" style="width:130px" value="${l.lf||''}" placeholder="0.00"
          oninput="document.getElementById('dif-${l.idpva}').textContent=(parseFloat(this.value)||0)-(parseFloat(document.getElementById('li-${l.idpva}').value)||0)+' L'"></td>
        <td id="dif-${l.idpva}" style="color:var(--success);font-weight:600">${(l.lf-l.li)||0} L</td>
      </tr>`).join('')}
    </tbody></table>`;
}

// ─── Step 3: Tanques y Modal de Transferencias ──────────────────────────────
async function loadTanques(){
  const [{data:tq},{data:cg}, {data:lastCorte}]=await Promise.all([
    supabase.from('tanques').select('id,nombre,capacidad').eq('idestacion',W.idestacion).order('nombre'),
    supabase.from('cargadores').select('id,pva,tanques(capacidad)').order('pva'),
    supabase.from('liquidaciones')
      .select('id, niveles_tanque_corte(idtanque, pct_fin)')
      .eq('idestacion', W.idestacion)
      .order('created_at', { ascending: false })
      .limit(1)
  ]);
  _tanquesCache = tq || [];
  _cargadoresCache = cg || [];
  const prevNiveles = lastCorte?.[0]?.niveles_tanque_corte || [];

  if(!W.niveles.length) {
    W.niveles=(_tanquesCache).map(t=>{
      const past = prevNiveles.find(n => n.idtanque === t.id);
      return {idtanque:t.id, nombre:t.nombre, capacidad:t.capacidad, pct_ini: past ? past.pct_fin : '', pct_fin: ''};
    });
  }
}

function renderStep3(area){
  area.innerHTML=`
    <h3 style="margin-bottom:18px;font-size:15px">Paso 3 — Niveles de Tanques y Transferencias</h3>
    
    <h4 style="font-size:13px;color:var(--text-muted);margin-bottom:10px">🛢️ NIVELES DEL TURNO (ESTACIÓN)</h4>
    <table class="data-table" style="margin-bottom:24px"><thead><tr>
      <th>Tanque</th><th>Capacidad</th><th>% Inicial Turno</th><th>% Final Turno</th><th>Litros ini</th><th>Litros fin</th>
    </tr></thead><tbody>
      ${W.niveles.map(n=>`<tr>
        <td class="td-bold">${n.nombre}</td>
        <td>${Number(n.capacidad).toLocaleString('es-MX')} L</td>
        <td><input id="ni-${n.idtanque}" type="number" min="0" max="100" step="0.01" class="form-control" style="width:90px" value="${n.pct_ini||''}"
          oninput="document.getElementById('nli-${n.idtanque}').textContent=(((parseFloat(this.value)||0)/100)*${n.capacidad}).toFixed(1)+' L'"></td>
        <td><input id="nf-${n.idtanque}" type="number" min="0" max="100" step="0.01" class="form-control" style="width:90px" value="${n.pct_fin||''}"
          oninput="document.getElementById('nlf-${n.idtanque}').textContent=(((parseFloat(this.value)||0)/100)*${n.capacidad}).toFixed(1)+' L'"></td>
        <td id="nli-${n.idtanque}" style="color:var(--accent)">${((n.pct_ini/100)*n.capacidad).toFixed(1)} L</td>
        <td id="nlf-${n.idtanque}" style="color:var(--accent)">${((n.pct_fin/100)*n.capacidad).toFixed(1)} L</td>
      </tr>`).join('')}
    </tbody></table>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-top:16px;border-top:1px solid var(--border)">
      <h4 style="font-size:13px;color:var(--text-muted)">🔄 DESCARGAS RECIBIDAS (AUTO-TANQUES)</h4>
      <button class="btn btn-secondary btn-sm" id="btn-add-transf">+ Agregar Descarga</button>
    </div>
    
    <div id="transf-list" style="display:flex;flex-direction:column;gap:12px;">
      ${W.transf.map((t,i)=>renderTransfCard(t,i)).join('')}
      ${W.transf.length===0?'<p style="font-size:13px;color:var(--text-muted);font-style:italic">No se han registrado descargas en este turno.</p>':''}
    </div>`;

  document.getElementById('btn-add-transf').addEventListener('click', openTransferModal);
  bindTransfCards();
}

function renderTransfCard(t, i){
  const fmt = n => Number(n).toLocaleString('es-MX',{minimumFractionDigits:2, maximumFractionDigits:2});
  return `
    <div class="card" style="padding:16px; background:var(--bg-secondary); border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong>${t.cargador_nombre} ➡️ ${t.tanque_nombre}</strong>
        <button class="btn btn-danger btn-sm btn-icon btn-del-t" data-index="${i}">🗑️</button>
      </div>
      <div style="display:flex;gap:16px;font-size:12px;color:var(--text-muted)">
        <div><span style="color:var(--success);font-weight:bold">${fmt(t.litros_recibidos_est)} L</span> recibidos en estación</div>
        <div><span style="color:var(--warning);font-weight:bold">${fmt(t.litros_transferidos)} L</span> entregados s/AT</div>
      </div>
    </div>`;
}

function bindTransfCards(){
  document.querySelectorAll('.btn-del-t').forEach(b=>b.addEventListener('click', (e)=>{
    W.transf.splice(parseInt(e.currentTarget.dataset.index), 1);
    renderStep3(document.getElementById('wiz-step')); // Re-render step 3
  }));
}

function openTransferModal(){
  const estNombre = document.getElementById('s-est')?.selectedOptions[0]?.text || 'Estación actual';
  const optsCarg = _cargadoresCache.map(c=>`<option value="${c.id}">${c.pva}</option>`).join('');
  
  // Si solo hay un tanque en la estación, lo pre-seleccionamos
  const optsTanq = _tanquesCache.map(t=>`<option value="${t.id}" ${_tanquesCache.length===1?'selected':''}>${t.nombre}</option>`).join('');
  
  const pvasRows = _pvasCache.map(p=>`<tr>
    <td>${p.pva}</td>
    <td><input type="number" class="form-control li-pva-t" data-id="${p.id}" data-name="${p.pva}" placeholder="0"></td>
    <td><input type="number" class="form-control lf-pva-t" data-id="${p.id}" placeholder="0"></td>
  </tr>`).join('');

  showModal(`
    <div class="modal-header">
      <h2>Registrar Descarga en <span style="color:var(--primary)">${estNombre}</span></h2>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto;padding-right:10px">
      
      <div class="form-row">
        <div class="form-group"><label class="form-label">Auto-Tanque (Cargador) *</label>
          <select id="m-carg" class="form-control"><option value="">— Selecciona —</option>${optsCarg}</select></div>
        <div class="form-group"><label class="form-label">Tanque Receptor *</label>
          <select id="m-tanq" class="form-control">${_tanquesCache.length!==1?'<option value="">— Selecciona —</option>':''}${optsTanq}</select></div>
      </div>

      <div style="background:var(--bg-card);padding:12px;border-radius:8px;margin-bottom:16px;border:1px solid var(--border)">
        <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:8px">1. DATOS DE ESTACIÓN DURANTE DESCARGA</h4>
        <div class="form-row">
          <div class="form-group"><label class="form-label">% Inicial Tanque Est.</label>
            <input id="m-epi" type="number" min="0" max="100" step="0.01" class="form-control"></div>
          <div class="form-group"><label class="form-label">% Final Tanque Est.</label>
            <input id="m-epf" type="number" min="0" max="100" step="0.01" class="form-control"></div>
        </div>
        <label class="form-label">Ventas en bombas (PVAs) DURANTE la descarga</label>
        <table class="data-table" style="font-size:12px">
          <thead><tr><th>PVA</th><th>Lectura Ini</th><th>Lectura Fin</th></tr></thead>
          <tbody>${pvasRows}</tbody>
        </table>
      </div>

      <div style="background:var(--bg-card);padding:12px;border-radius:8px;border:1px solid var(--border)">
        <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:8px">2. DATOS DEL AUTO-TANQUE (PIPA)</h4>
        <div class="form-row">
          <div class="form-group"><label class="form-label">% Inicial AT</label>
            <input id="m-api" type="number" min="0" max="100" step="0.01" class="form-control"></div>
          <div class="form-group"><label class="form-label">% Final AT</label>
            <input id="m-apf" type="number" min="0" max="100" step="0.01" class="form-control"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Medidor Inicial AT</label>
            <input id="m-ali" type="number" class="form-control"></div>
          <div class="form-group"><label class="form-label">Medidor Final AT</label>
            <input id="m-alf" type="number" class="form-control"></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="btn-cancel-m">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-m">Agregar Descarga</button>
    </div>`, overlay => {
    overlay.querySelector('#btn-cancel-m').addEventListener('click', closeModal);
    overlay.querySelector('#btn-save-m').addEventListener('click', () => {
      saveModalData(overlay);
    });
  });
}

function saveModalData(overlay) {
  const idcargador = overlay.querySelector('#m-carg').value;
  const idtanque_estacion = overlay.querySelector('#m-tanq').value;
  if(!idcargador || !idtanque_estacion){ showToast('Selecciona el Auto-Tanque y el Tanque','error'); return; }

  const carg = _cargadoresCache.find(c=>c.id===idcargador);
  const tanq = _tanquesCache.find(t=>t.id===idtanque_estacion);

  const est_pi = parseFloat(overlay.querySelector('#m-epi').value||0);
  const est_pf = parseFloat(overlay.querySelector('#m-epf').value||0);
  const at_pi = parseFloat(overlay.querySelector('#m-api').value||0);
  const at_pf = parseFloat(overlay.querySelector('#m-apf').value||0);
  const at_li = parseFloat(overlay.querySelector('#m-ali').value||0);
  const at_lf = parseFloat(overlay.querySelector('#m-alf').value||0);

  // Recolectar lecturas de PVAs
  let lecturas = [];
  let litros_venta_durante = 0;
  overlay.querySelectorAll('.li-pva-t').forEach(inp => {
    const li = parseFloat(inp.value||0);
    const lfInp = overlay.querySelector(`.lf-pva-t[data-id="${inp.dataset.id}"]`);
    const lf = parseFloat(lfInp.value||0);
    if(li>0 || lf>0){
      lecturas.push({ idpva: inp.dataset.id, nombre: inp.dataset.name, li, lf });
      litros_venta_durante += (lf - li);
    }
  });

  // Cálculos
  const capacidad_tanque = tanq.capacidad;
  const capacidad_at = carg.tanques?.capacidad || 0;
  const ltsSubieronTanque = ((est_pf - est_pi)/100) * capacidad_tanque;
  const litros_recibidos_est = ltsSubieronTanque + litros_venta_durante;
  const litros_transferidos = ((at_pi - at_pf)/100) * capacidad_at;

  W.transf.push({
    idcargador, cargador_nombre: carg.pva, capacidad_at,
    idtanque_estacion, tanque_nombre: tanq.nombre,
    estacion_pct_ini: est_pi, estacion_pct_fin: est_pf,
    pct_ini_at: at_pi, pct_fin_at: at_pf,
    at_lectura_ini: at_li, at_lectura_fin: at_lf,
    litros_venta_durante, litros_recibidos_est, litros_transferidos,
    lecturas
  });

  closeModal();
  renderStep3(document.getElementById('wiz-step'));
}

// ─── Step 4: Resumen ────────────────────────────────────────────────────────
function renderStep4(area){
  const totalLitrosVenta = W.lecturas.reduce((s,l)=>s+(l.lf-l.li),0);
  const invIni = W.niveles.reduce((s,n)=>s+((n.pct_ini/100)*n.capacidad),0);
  const invFin = W.niveles.reduce((s,n)=>s+((n.pct_fin/100)*n.capacidad),0);
  
  // Total de gas recibido en todas las transferencias de este turno
  const totalRecibido = W.transf.reduce((s,t)=>s+(t.litros_recibidos_est || t.litros_transferidos || 0), 0);

  // Total Entregados = Inv Final + Ventas
  const ltsEntregados = invFin + totalLitrosVenta;
  
  // Total Recibidos = Inv Inicial + Descargas
  const ltsRecibidos = invIni + totalRecibido;

  // Diferencia
  const bal = ltsEntregados - ltsRecibidos;
  
  let badgeBal = '✅'; let colorBal = 'var(--success)'; let textBal = 'Balance Perfecto';
  if(bal > 1) { badgeBal = '📈'; colorBal = 'var(--warning)'; textBal = 'Sobrante'; }
  if(bal < -1) { badgeBal = '📉'; colorBal = 'var(--danger)'; textBal = 'Faltante'; }
  
  const fmt=(n,d=2)=>Number(n).toLocaleString('es-MX',{minimumFractionDigits:d});
  area.innerHTML=`
    <h3 style="margin-bottom:20px;font-size:15px">Paso 4 — Resumen y Balance del Corte</h3>
    
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon" style="background:rgba(16,185,129,0.15)">⛽</div>
        <div class="stat-info"><h3>${fmt(totalLitrosVenta)} L</h3><p>Ventas del Turno</p></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:rgba(6,182,212,0.15)">🔄</div>
        <div class="stat-info"><h3>${fmt(totalRecibido)} L</h3><p>Recibido en Descargas</p></div></div>
      <div class="stat-card" style="border:1px solid ${colorBal}"><div class="stat-icon" style="background:${colorBal};color:#fff">${badgeBal}</div>
        <div class="stat-info"><h3 style="color:${colorBal}">${bal>0?'+':''}${fmt(bal)} L</h3>
        <p>${textBal}</p></div></div>
    </div>
    
    <div class="card" style="padding:16px;margin-bottom:16px">
      <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase">BALANCE DE INVENTARIO (ENTREGADOS VS RECIBIDOS)</h4>
      <table class="data-table"><thead><tr><th>Concepto</th><th>Cálculo</th><th>Total</th></tr></thead><tbody>
        <tr><td><b>Lts Recibidos</b> (Lo que deberíamos tener)</td><td style="color:var(--text-muted);font-size:12px">Inv. Inicial (${fmt(invIni)}) + Transferencias (${fmt(totalRecibido)})</td><td><b>${fmt(ltsRecibidos)} L</b></td></tr>
        <tr><td><b>Lts Entregados</b> (Lo que realmente tenemos/salió)</td><td style="color:var(--text-muted);font-size:12px">Inv. Final (${fmt(invFin)}) + Ventas (${fmt(totalLitrosVenta)})</td><td><b>${fmt(ltsEntregados)} L</b></td></tr>
        <tr style="font-size:14px;border-top:2px solid var(--border)">
          <td colspan="2"><b>Diferencia Total (Entregados − Recibidos)</b></td>
          <td style="color:${colorBal};font-weight:bold">${bal>0?'+':''}${fmt(bal)} L</td>
        </tr>
      </tbody></table>
    </div>`;
  W._totalLitros=totalLitrosVenta;
}

// ─── SAVE ───────────────────────────────────────────────────────────────────
async function saveCorte(container){
  try {
    const {data:corte,error:e1}=await supabase.from('liquidaciones').insert({
      idestacion:W.idestacion, dia:W.dia, turno:W.turno, idemp:W.idemp,
      precio_litro:0, total_litros:W._totalLitros, total_venta:0,
    }).select().single();
    if(e1) throw e1;
    const cid=corte.id;

    if(W.lecturas.length){
      const {error:e2}=await supabase.from('lecturas_corte').insert(
        W.lecturas.map(l=>({idcorte:cid,idpva:l.idpva,pva_nombre:l.nombre,lectura_ini:l.li,lectura_fin:l.lf})));
      if(e2) throw e2;
    }

    if(W.niveles.length){
      const {error:e3}=await supabase.from('niveles_tanque_corte').insert(
        W.niveles.map(n=>({idcorte:cid,idtanque:n.idtanque,nombre:n.nombre,capacidad:n.capacidad,pct_ini:n.pct_ini,pct_fin:n.pct_fin})));
      if(e3) throw e3;
    }

    if(W.transf.length){
      for(let t of W.transf){
        const {data:tSaved, error:e4} = await supabase.from('transferencias').insert({
          idcorte: cid, idestacion: W.idestacion,
          idcargador: t.idcargador, cargador_nombre: t.cargador_nombre, capacidad_at: t.capacidad_at,
          idtanque_estacion: t.idtanque_estacion, estacion_pct_ini: t.estacion_pct_ini, estacion_pct_fin: t.estacion_pct_fin,
          pct_ini_at: t.pct_ini_at, pct_fin_at: t.pct_fin_at, at_lectura_ini: t.at_lectura_ini, at_lectura_fin: t.at_lectura_fin,
          litros_venta_durante: t.litros_venta_durante, litros_recibidos_est: t.litros_recibidos_est, litros_transferidos: t.litros_transferidos
        }).select().single();
        if(e4) throw e4;

        if(t.lecturas.length){
          const {error:e5} = await supabase.from('lecturas_transferencia').insert(
            t.lecturas.map(l=>({
              idtransferencia: tSaved.id, idpva: l.idpva, pva_nombre: l.nombre,
              lectura_ini: l.li, lectura_fin: l.lf
            }))
          );
          if(e5) throw e5;
        }
      }
    }

    showToast('✅ Corte guardado exitosamente','success');
    renderLiquidaciones(container);
  } catch(err){
    showToast('Error al guardar: '+err.message,'error');
  }
}
