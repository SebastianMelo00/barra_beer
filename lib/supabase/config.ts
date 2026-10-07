// URL y llave pública (anon/publishable) de Supabase. Ambas son públicas por
// diseño: la seguridad la ponen las políticas RLS y las funciones RPC.
// NUNCA pongas aquí la service_role key.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function verificarConfig() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Faltan las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
        '(o NEXT_PUBLIC_SUPABASE_ANON_KEY). Agrégalas en .env.local y en Vercel.',
    );
  }
}
