import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente con la clave secreta: puede escribir saltándose RLS. Solo el
 * servidor lo usa, para guardar las coordenadas de `propiedades_ubicacion`.
 * Sin `SUPABASE_SECRET_KEY` es null y las coordenadas solo quedan en memoria.
 */
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const secretKey = import.meta.env.SUPABASE_SECRET_KEY?.trim();

export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && secretKey
    ? createClient(supabaseUrl, secretKey, { auth: { persistSession: false } })
    : null;
