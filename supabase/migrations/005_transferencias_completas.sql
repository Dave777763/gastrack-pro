-- Migración 005 — Transferencias Independientes con detalle cruzado
-- Pegar en Supabase → SQL Editor

-- 1. Ampliar la tabla de transferencias para guardar datos cruzados
ALTER TABLE transferencias
  ADD COLUMN IF NOT EXISTS at_lectura_ini       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS at_lectura_fin       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS estacion_pct_ini     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS estacion_pct_fin     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS idcargador           UUID REFERENCES cargadores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idtanque_estacion    UUID REFERENCES tanques(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS litros_venta_durante NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS litros_recibidos_est NUMERIC(12,2);

-- 2. Crear tabla hija para guardar las lecturas de los PVAs de la Estación DURANTE la transferencia
CREATE TABLE IF NOT EXISTS lecturas_transferencia (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idtransferencia UUID REFERENCES transferencias(id) ON DELETE CASCADE NOT NULL,
  idpva           UUID REFERENCES pvas(id) ON DELETE SET NULL,
  pva_nombre      TEXT,
  lectura_ini     NUMERIC(12,2) NOT NULL DEFAULT 0,
  lectura_fin     NUMERIC(12,2) NOT NULL DEFAULT 0,
  litros_vendidos NUMERIC(12,2) GENERATED ALWAYS AS (lectura_fin - lectura_ini) STORED
);

-- 3. Seguridad para la nueva tabla
ALTER TABLE lecturas_transferencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON lecturas_transferencia FOR ALL USING (true) WITH CHECK (true);
