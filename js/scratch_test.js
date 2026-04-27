import { supabase } from './supabase-config.js';

async function testQuery() {
  const { data, error } = await supabase.from('liquidaciones')
    .select(`
      *,
      estaciones(nombre),
      empleados(nombre,paterno),
      lecturas_corte(pvas(nombre), lectura_ini, lectura_fin),
      niveles_tanque_corte(tanques(nombre), capacidad, pct_ini, pct_fin),
      transferencias(cargador_nombre, litros_recibidos_est, litros_transferidos)
    `)
    .limit(1);

  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("SUCCESS:", data);
  }
}

testQuery();
