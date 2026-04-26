-- Migración 004 — Cargadores como Auto-tanques móviles
-- Pegar en Supabase → SQL Editor

-- 1. Eliminar la relación estricta con estaciones
ALTER TABLE cargadores 
  DROP CONSTRAINT IF EXISTS cargadores_idestacion_fkey;

ALTER TABLE cargadores 
  DROP COLUMN IF EXISTS idestacion;

-- 2. Agregar los datos del camión
ALTER TABLE cargadores 
  ADD COLUMN IF NOT EXISTS camion_serie TEXT,
  ADD COLUMN IF NOT EXISTS camion_marca TEXT,
  ADD COLUMN IF NOT EXISTS camion_anio  INTEGER;
