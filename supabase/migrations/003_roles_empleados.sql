-- Migración 003 — Roles de Empleados en lugar de asignación fija a estación
-- Pegar en Supabase → SQL Editor

-- 1. Eliminar la relación estricta con estaciones
ALTER TABLE empleados 
  DROP CONSTRAINT IF EXISTS empleados_idestacion_fkey;

ALTER TABLE empleados 
  DROP COLUMN IF EXISTS idestacion;

-- 2. Agregar el campo de rol
ALTER TABLE empleados 
  ADD COLUMN IF NOT EXISTS rol TEXT NOT NULL DEFAULT 'Despachador';

-- Nota: Los roles pueden ser 'Despachador', 'Supervisor', 'Chofer'
