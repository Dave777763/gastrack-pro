-- ╔══════════════════════════════════════════════════════╗
-- ║  GasTrack Pro — Schema SQL para Supabase             ║
-- ║  Pega esto en: Supabase → SQL Editor → Run           ║
-- ╚══════════════════════════════════════════════════════╝

-- ─── Zonas ────────────────────────────────────────────
CREATE TABLE zonas (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zona    TEXT NOT NULL
);

-- ─── Estaciones ───────────────────────────────────────
CREATE TABLE estaciones (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre    TEXT NOT NULL,
  idzona    UUID REFERENCES zonas(id) ON DELETE SET NULL
);

-- ─── Tanques ──────────────────────────────────────────
CREATE TABLE tanques (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL,
  capacidad   NUMERIC(12,2) NOT NULL DEFAULT 0,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL
);

-- ─── Empleados ────────────────────────────────────────
CREATE TABLE empleados (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL,
  paterno     TEXT NOT NULL,
  materno     TEXT,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL
);

-- ─── Tipo PVA ─────────────────────────────────────────
CREATE TABLE tipopva (
  id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo  TEXT NOT NULL
);

-- ─── Precios ──────────────────────────────────────────
CREATE TABLE precios (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dia     DATE NOT NULL,
  precio  NUMERIC(10,4) NOT NULL,
  idzona  UUID REFERENCES zonas(id) ON DELETE SET NULL
);

-- ─── PVAs ─────────────────────────────────────────────
CREATE TABLE pvas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pva         TEXT NOT NULL,
  idtipopva   UUID REFERENCES tipopva(id) ON DELETE SET NULL,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL,
  idzona      UUID REFERENCES zonas(id) ON DELETE SET NULL
);

-- ─── Cargadores ───────────────────────────────────────
CREATE TABLE cargadores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pva         TEXT NOT NULL,
  idtipopva   UUID REFERENCES tipopva(id) ON DELETE SET NULL,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL,
  idtanque    UUID REFERENCES tanques(id) ON DELETE SET NULL,
  idzona      UUID REFERENCES zonas(id) ON DELETE SET NULL
);

-- ─── Liquidaciones ────────────────────────────────────
CREATE TABLE liquidaciones (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL,
  dia         DATE NOT NULL,
  turno       TEXT NOT NULL,
  idemp       UUID REFERENCES empleados(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Transferencias ───────────────────────────────────
CREATE TABLE transferencias (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL,
  idcorte     UUID REFERENCES liquidaciones(id) ON DELETE SET NULL,
  idpva       UUID REFERENCES pvas(id) ON DELETE SET NULL,
  pct_ini_at  NUMERIC(6,2),
  pct_fin_at  NUMERIC(6,2),
  lit_ini_at  NUMERIC(12,2),
  lit_fin_at  NUMERIC(12,2),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Row Level Security (permitir todo en desarrollo) ─
ALTER TABLE zonas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE estaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tanques       ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipopva       ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargadores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (desarrollo — cambiar en producción)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['zonas','estaciones','tanques','empleados',
    'tipopva','precios','pvas','cargadores','liquidaciones','transferencias']
  LOOP
    EXECUTE format('CREATE POLICY "public_all" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
