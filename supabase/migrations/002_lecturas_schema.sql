-- Migración 002 — Tablas para Liquidaciones completas
-- Pegar en Supabase → SQL Editor

-- Columnas adicionales en liquidaciones
ALTER TABLE liquidaciones
  ADD COLUMN IF NOT EXISTS precio_litro   NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS total_litros   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_venta    NUMERIC(14,2);

-- Lecturas de medidor por PVA (hijo de liquidacion)
CREATE TABLE IF NOT EXISTS lecturas_corte (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idcorte         UUID REFERENCES liquidaciones(id) ON DELETE CASCADE NOT NULL,
  idpva           UUID REFERENCES pvas(id) ON DELETE SET NULL,
  pva_nombre      TEXT,
  lectura_ini     NUMERIC(12,2) NOT NULL DEFAULT 0,
  lectura_fin     NUMERIC(12,2) NOT NULL DEFAULT 0,
  litros_vendidos NUMERIC(12,2) GENERATED ALWAYS AS (lectura_fin - lectura_ini) STORED
);

-- Niveles de tanque de la estación por corte
CREATE TABLE IF NOT EXISTS niveles_tanque_corte (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idcorte    UUID REFERENCES liquidaciones(id) ON DELETE CASCADE NOT NULL,
  idtanque   UUID REFERENCES tanques(id) ON DELETE SET NULL,
  nombre     TEXT,
  capacidad  NUMERIC(12,2),
  pct_ini    NUMERIC(6,2) NOT NULL DEFAULT 0,
  pct_fin    NUMERIC(6,2) NOT NULL DEFAULT 0
);

-- Columnas adicionales en transferencias (autotanques)
ALTER TABLE transferencias
  ADD COLUMN IF NOT EXISTS cargador_nombre    TEXT,
  ADD COLUMN IF NOT EXISTS capacidad_at       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS litros_transferidos NUMERIC(12,2);

-- RLS para las nuevas tablas
ALTER TABLE lecturas_corte      ENABLE ROW LEVEL SECURITY;
ALTER TABLE niveles_tanque_corte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON lecturas_corte      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON niveles_tanque_corte FOR ALL USING (true) WITH CHECK (true);
