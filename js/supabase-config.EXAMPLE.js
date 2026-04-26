// ╔════════════════════════════════════════════════════════╗
// ║  supabase-config.EXAMPLE.js                           ║
// ║  Copia este archivo como supabase-config.js           ║
// ║  y llena con tus credenciales reales                  ║
// ╚════════════════════════════════════════════════════════╝
//
// 1. Ve a https://supabase.com → tu proyecto → Settings → API
// 2. Copia "Project URL" y "anon / public key"
// 3. Crea el archivo js/supabase-config.js (está en .gitignore)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://TU_PROJECT_ID.supabase.co';
const SUPABASE_KEY  = 'TU_ANON_PUBLIC_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
