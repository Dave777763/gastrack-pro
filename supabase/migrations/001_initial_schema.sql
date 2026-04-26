-- Migracion 001 — Schema inicial GasTrack Pro
-- Fecha: 2026-04-26
-- Descripcion: Creacion de tablas maestras y operativas

CREATE TABLE IF NOT EXISTS zonas (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zona    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estaciones (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre    TEXT NOT NULL,
  idzona    UUID REFERENCES zonas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tanques (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL,
  capacidad   NUMERIC(12,2) NOT NULL DEFAULT 0,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS empleados (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL,
  paterno     TEXT NOT NULL,
  materno     TEXT,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tipopva (
  id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS precios (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dia     DATE NOT NULL,
  precio  NUMERIC(10,4) NOT NULL,
  idzona  UUID REFERENCES zonas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pvas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pva         TEXT NOT NULL,
  idtipopva   UUID REFERENCES tipopva(id) ON DELETE SET NULL,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL,
  idzona      UUID REFERENCES zonas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cargadores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pva         TEXT NOT NULL,
  idtipopva   UUID REFERENCES tipopva(id) ON DELETE SET NULL,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL,
  idtanque    UUID REFERENCES tanques(id) ON DELETE SET NULL,
  idzona      UUID REFERENCES zonas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS liquidaciones (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idestacion  UUID REFERENCES estaciones(id) ON DELETE SET NULL,
  dia         DATE NOT NULL,
  turno       TEXT NOT NULL,
  idemp       UUID REFERENCES empleados(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transferencias (
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

-- Row Level Security
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['zonas','estaciones','tanques','empleados',
    'tipopva','precios','pvas','cargadores','liquidaciones','transferencias']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format('CREATE POLICY "public_all" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
