const fs = require('fs');
const path = require('path');

// Obtener las variables de entorno de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const targetPath = path.join(__dirname, 'js', 'supabase-config.js');
const templatePath = path.join(__dirname, 'js', 'supabase-config.EXAMPLE.js');

if (supabaseUrl && supabaseAnonKey) {
  console.log("Generando js/supabase-config.js usando variables de entorno...");
  
  if (!fs.existsSync(templatePath)) {
    console.error(`Error: No se encontró la plantilla en ${templatePath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(templatePath, 'utf8');
  content = content.replace('https://TU_PROJECT_ID.supabase.co', supabaseUrl);
  content = content.replace('TU_ANON_PUBLIC_KEY', supabaseAnonKey);
  
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log("¡Archivo js/supabase-config.js generado exitosamente!");
} else {
  // Si no hay variables de entorno, verificar si ya existe el archivo (desarrollo local)
  if (fs.existsSync(targetPath)) {
    console.log("El archivo js/supabase-config.js ya existe localmente. Omitiendo generación.");
  } else {
    console.error("Error: No se encontró js/supabase-config.js y tampoco están definidas las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY.");
    process.exit(1);
  }
}
