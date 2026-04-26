import { supabase } from './supabase-config.js';

import { renderZonas }      from './modules/zonas.js';
import { renderEstaciones } from './modules/estaciones.js';
import { renderTanques }    from './modules/tanques.js';
import { renderEmpleados }  from './modules/empleados.js';
import { renderTipoPVA }    from './modules/tipopva.js';
import { renderPrecios }    from './modules/precios.js';
import { renderPVAs }       from './modules/pvas.js';
import { renderCargadores } from './modules/cargadores.js';
import { renderLiquidaciones } from './modules/liquidaciones.js';
import { renderTransferencias } from './modules/transferencias.js';

const container = document.getElementById('page-container');

// ─── Route map ────────────────────────────────────────────────────────────────
const routes = {
  dashboard:      renderDashboard,
  zonas:          renderZonas,
  estaciones:     renderEstaciones,
  tanques:        renderTanques,
  empleados:      renderEmpleados,
  tipopva:        renderTipoPVA,
  precios:        renderPrecios,
  pvas:           renderPVAs,
  cargadores:     renderCargadores,
  liquidaciones:  renderLiquidaciones,
  transferencias: renderTransferencias,
};

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
  const fn = routes[page] || renderDashboard;
  fn(container);
  window.location.hash = page;
}

document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); }));

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const tables = ['zonas','estaciones','tanques','empleados','pvas','cargadores','precios','liquidaciones'];
  const counts = await Promise.all(tables.map(async t => {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    return count ?? 0;
  }));
  const [nZonas, nEst, nTanques, nEmp, nPvas, nCarg, nPrecios, nLiq] = counts;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>⛽ Dashboard</h1>
        <p>Resumen general del sistema de carburación</p>
      </div>
      <span style="font-size:12px;color:var(--text-muted)">
        ${new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
      </span>
    </div>
    <div class="page-content">

      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(99,102,241,0.15)">🏭</div>
          <div class="stat-info"><h3>${nEst}</h3><p>Estaciones</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,185,129,0.15)">👷</div>
          <div class="stat-info"><h3>${nEmp}</h3><p>Empleados</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(6,182,212,0.15)">🛢️</div>
          <div class="stat-info"><h3>${nTanques}</h3><p>Tanques</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(245,158,11,0.15)">⚙️</div>
          <div class="stat-info"><h3>${nPvas}</h3><p>PVAs</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(139,92,246,0.15)">📋</div>
          <div class="stat-info"><h3>${nLiq}</h3><p>Liquidaciones</p></div>
        </div>
      </div>

      <h2 style="font-size:13px;font-weight:600;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.06em">Catálogos</h2>
      <div class="dashboard-grid">
        ${[
          ['zonas','🗺️','Zonas',`${nZonas} zonas registradas`],
          ['estaciones','🏭','Estaciones',`${nEst} estaciones`],
          ['tanques','🛢️','Tanques',`${nTanques} tanques`],
          ['empleados','👷','Empleados',`${nEmp} empleados`],
          ['tipopva','🔧','Tipo PVA','Tipos de punto de venta'],
          ['precios','💰','Precios',`${nPrecios} registros`],
          ['pvas','⚙️','PVAs',`${nPvas} puntos de venta`],
          ['cargadores','🔌','Cargadores',`${nCarg} cargadores`],
        ].map(([p,i,n,d]) => `
          <div class="dashboard-card" data-goto="${p}">
            <div class="card-icon">${i}</div>
            <h3>${n}</h3><p>${d}</p>
          </div>`).join('')}
      </div>

      <h2 style="font-size:13px;font-weight:600;color:var(--text-muted);margin:20px 0 12px;text-transform:uppercase;letter-spacing:.06em">Operaciones</h2>
      <div class="dashboard-grid">
        ${[
          ['liquidaciones','📋','Liquidaciones','Cortes de turno por estación'],
          ['transferencias','🔄','Transferencias','Control de trasvase entre tanques'],
        ].map(([p,i,n,d]) => `
          <div class="dashboard-card" data-goto="${p}">
            <div class="card-icon">${i}</div>
            <h3>${n}</h3><p>${d}</p>
          </div>`).join('')}
      </div>
    </div>`;

  container.querySelectorAll('[data-goto]').forEach(c =>
    c.addEventListener('click', () => navigate(c.dataset.goto)));
}

// ─── Placeholder ──────────────────────────────────────────────────────────────
function renderPlaceholder(icon, title, msg) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>${icon} ${title}</h1></div>
    </div>
    <div class="page-content">
      <div class="empty-state" style="padding:80px 20px">
        <div class="empty-icon">${icon}</div>
        <h3>${title}</h3><p>${msg}</p>
      </div>
    </div>`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
navigate(window.location.hash.replace('#','') || 'dashboard');
