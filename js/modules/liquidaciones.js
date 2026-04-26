import { supabase } from '../supabase-config.js';
import { showToast } from '../utils.js';

let W = {
  step: 1,
  idestacion: '', dia: new Date().toISOString().split('T')[0],
  turno: 'Matutino', idemp: '', precio_litro: 0,
  lecturas: [], niveles: []
};

export async function renderLiquidaciones(container) {
  W = { step:1, idestacion:'', dia: new Date().toISOString().split('T')[0],
        turno:'Matutino', idemp:'', precio_litro:0, lecturas:[], niveles:[] };
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>📋 Liquidaciones</h1><p>Cortes de turno — ventas e inventario</p></div>
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
      <td><button class="btn btn-danger btn-icon btn-sm" data-del="${r.id}">🗑️</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;
  document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>delCorte(b.dataset.del)));
}

function turnoClr(t){ return t==='Matutino'?'warning':t==='Vespertino'?'cyan':'primary'; }

async function delCorte(id){
  if(!confirm('¿Eliminar este corte?')) return;
  const {error}=await supabase.from('liquidaciones').delete().eq('id',id);
  if(error){showToast('Error: '+error.message,'error');return;}
  showToast('Corte eliminado','success'); await loadList();
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

const STEPS=['Datos Generales','Lecturas PVA','Tanques de Estación','Resumen'];

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
  document.getElementById('s-est').addEventListener('change',e=>{W.idestacion=e.target.value;W.lecturas=[];W.niveles=[];});
}

function validateStep(){
  if(W.step===1){
    W.idestacion=document.getElementById('s-est')?.value||W.idestacion;
    W.dia=document.getElementById('s-dia')?.value||W.dia;
    W.turno=document.getElementById('s-turno')?.value||W.turno;
    W.idemp=document.getElementById('s-emp')?.value||W.idemp;
    W.precio_litro=0;
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

async function loadPVAs(){
  const {data}=await supabase.from('pvas').select('id,pva').eq('idestacion',W.idestacion).order('pva');
  if(!W.lecturas.length) W.lecturas=(data||[]).map(p=>({idpva:p.id,nombre:p.pva,li:0,lf:0}));
}

function renderStep2(area){
  area.innerHTML=`
    <h3 style="margin-bottom:18px;font-size:15px">Paso 2 — Lecturas de Medidores por PVA</h3>
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

async function loadTanques(){
  const {data}=await supabase.from('tanques').select('id,nombre,capacidad').eq('idestacion',W.idestacion).order('nombre');
  if(!W.niveles.length) W.niveles=(data||[]).map(t=>({idtanque:t.id,nombre:t.nombre,capacidad:t.capacidad,pct_ini:0,pct_fin:0}));
}

function renderStep3(area){
  area.innerHTML=`
    <h3 style="margin-bottom:18px;font-size:15px">Paso 3 — Niveles de Tanques de la Estación</h3>
    <table class="data-table"><thead><tr>
      <th>Tanque</th><th>Capacidad</th><th>% Inicial</th><th>% Final</th><th>Litros ini</th><th>Litros fin</th>
    </tr></thead><tbody>
      ${W.niveles.map(n=>`<tr>
        <td class="td-bold">${n.nombre}</td>
        <td>${Number(n.capacidad).toLocaleString('es-MX')} L</td>
        <td><input id="ni-${n.idtanque}" type="number" min="0" max="100" step="0.01" class="form-control" style="width:90px" value="${n.pct_ini||''}"></td>
        <td><input id="nf-${n.idtanque}" type="number" min="0" max="100" step="0.01" class="form-control" style="width:90px" value="${n.pct_fin||''}"></td>
        <td style="color:var(--accent)">${((n.pct_ini/100)*n.capacidad).toFixed(1)} L</td>
        <td style="color:var(--accent)">${((n.pct_fin/100)*n.capacidad).toFixed(1)} L</td>
      </tr>`).join('')}
    </tbody></table>
    <p style="font-size:13px; color:var(--text-muted); margin-top:20px; text-align:center;">
      ℹ️ Las transferencias o descargas de auto-tanques ahora se capturan de forma independiente en el menú "Transferencias".
    </p>`;
}

function renderStep4(area){
  const totalLitros=W.lecturas.reduce((s,l)=>s+(l.lf-l.li),0);
  const invIni=W.niveles.reduce((s,n)=>s+((n.pct_ini/100)*n.capacidad),0);
  const invFin=W.niveles.reduce((s,n)=>s+((n.pct_fin/100)*n.capacidad),0);
  // Diferencia sin tomar en cuenta las transferencias, ya que ahora son independientes.
  // Es decir, si se vendieron 1000L, el inventario final real debería ser InvIni - 1000L.
  // Si no lo es, hay diferencia. Las transferencias se gestionarán y calcularán en su propio módulo.
  // (Nota para el usuario: Para un balance de estación perfecto mensual, se sumarán las transferencias).
  const bal=invFin-invIni+totalLitros; 
  const fmt=(n,d=2)=>Number(n).toLocaleString('es-MX',{minimumFractionDigits:d});
  area.innerHTML=`
    <h3 style="margin-bottom:20px;font-size:15px">Paso 4 — Resumen del Corte</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon" style="background:rgba(16,185,129,0.15)">⛽</div>
        <div class="stat-info"><h3>${fmt(totalLitros)} L</h3><p>Total Litros Vendidos</p></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:rgba(${bal>1?'239,68,68':'245,158,11'},0.15)">${bal>1?'⚠️':'✅'}</div>
        <div class="stat-info"><h3>${fmt(Math.abs(bal))} L</h3>
        <p>${bal>1?'Diferencia de turno':'Balance correcto'}</p></div></div>
    </div>
    <div class="card" style="padding:16px;margin-bottom:16px">
      <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase">MOVIMIENTO DE INVENTARIO</h4>
      <table class="data-table"><thead><tr><th>Concepto</th><th>Litros</th></tr></thead><tbody>
        <tr><td>Inventario Inicial (Tanques)</td><td>${fmt(invIni)} L</td></tr>
        <tr><td>− Gas Vendido</td><td style="color:var(--danger)">−${fmt(totalLitros)} L</td></tr>
        <tr style="font-weight:700"><td>= Inventario Final Teórico</td><td>${fmt(invIni-totalLitros)} L</td></tr>
        <tr><td>Inventario Final Real (Tanques)</td><td>${fmt(invFin)} L</td></tr>
        <tr><td><b>Diferencia de Turno</b></td><td style="color:${Math.abs(bal)>10?'var(--danger)':'var(--success)'}">${fmt(bal)} L</td></tr>
      </tbody></table>
    </div>
    <div class="card" style="padding:16px">
      <h4 style="font-size:12px;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase">VENTAS POR PVA</h4>
      <table class="data-table"><thead><tr><th>PVA</th><th>L. Inicial</th><th>L. Final</th><th>Litros</th></tr></thead><tbody>
        ${W.lecturas.map(l=>`<tr>
          <td class="td-bold">${l.nombre}</td><td>${fmt(l.li)}</td><td>${fmt(l.lf)}</td>
          <td style="color:var(--success)">${fmt(l.lf-l.li)} L</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
  W._totalLitros=totalLitros;
}

async function saveCorte(container){
  try {
    const {data:corte,error:e1}=await supabase.from('liquidaciones').insert({
      idestacion:W.idestacion, dia:W.dia, turno:W.turno, idemp:W.idemp,
      precio_litro:W.precio_litro,
      total_litros:W._totalLitros, total_venta:0,
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

    showToast('✅ Corte guardado exitosamente','success');
    renderLiquidaciones(container);
  } catch(err){
    showToast('Error al guardar: '+err.message,'error');
  }
}
