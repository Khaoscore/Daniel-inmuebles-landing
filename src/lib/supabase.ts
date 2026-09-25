import { createClient } from '@supabase/supabase-js';

// `.trim()`: el .env tiene un espacio después del "=".
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_PUBLISHABLE_KEY en el archivo .env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
