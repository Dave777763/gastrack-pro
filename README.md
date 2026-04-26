# ⛽ GasTrack Pro

Sistema web para el registro de ventas de una estación de carburación de Gas LP.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + Vanilla JavaScript (ES Modules) |
| Base de datos | [Supabase](https://supabase.com) (PostgreSQL) |
| Hosting | GitHub Pages (deploy automático) |

## Estructura del proyecto

```
├── index.html                         # App shell + navegación
├── css/styles.css                     # Diseño dark theme
├── js/
│   ├── supabase-config.EXAMPLE.js    # Plantilla de credenciales
│   ├── supabase-config.js            # ⚠️ NO se sube al repo (gitignored)
│   ├── app.js                         # Router + Dashboard
│   ├── utils.js                       # Modal, toast, helpers
│   └── modules/
│       ├── zonas.js
│       ├── estaciones.js
│       ├── tanques.js
│       ├── empleados.js
│       ├── tipopva.js
│       ├── precios.js
│       ├── pvas.js
│       └── cargadores.js
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Schema SQL versionado
└── .github/
    └── workflows/
        └── deploy.yml                # CI/CD → GitHub Pages
```

## Configuración inicial

### 1. Clonar el repo

```bash
git clone https://github.com/TU_USUARIO/gastrack-pro.git
cd gastrack-pro
```

### 2. Configurar credenciales locales

```bash
cp js/supabase-config.EXAMPLE.js js/supabase-config.js
# Edita js/supabase-config.js con tu URL y anon key de Supabase
```

### 3. Crear las tablas en Supabase

Pega el contenido de `supabase/migrations/001_initial_schema.sql` en el SQL Editor de Supabase.

### 4. Correr localmente

```bash
python -m http.server 8080
# Abre http://localhost:8080
```

## Deploy automático (GitHub Pages)

Cada `git push` a `main` dispara el workflow que:
1. Inyecta las credenciales de Supabase desde los **GitHub Secrets**
2. Sube los archivos a GitHub Pages

### Configurar GitHub Secrets

En tu repo → **Settings → Secrets and variables → Actions → New secret**:

| Secret | Valor |
|---|---|
| `SUPABASE_URL` | `https://XXXXX.supabase.co` |
| `SUPABASE_ANON_KEY` | Tu anon/public key |

### Activar GitHub Pages

En tu repo → **Settings → Pages → Source → GitHub Actions**

## Módulos

### Catálogos
- **Zonas** — Zonas de distribución
- **Estaciones** — Estaciones de carburación
- **Tanques** — Tanques por estación
- **Empleados** — Personal por estación
- **Tipo PVA** — Tipos de punto de venta
- **Precios** — Precio por litro por zona y fecha
- **PVAs** — Puntos de venta/abastecimiento
- **Cargadores** — Puntos de carga

### Operaciones (próximamente)
- **Liquidaciones** — Corte de turno
- **Transferencias** — Control de trasvase
