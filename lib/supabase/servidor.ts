import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseKey, supabaseUrl, verificarConfig } from './config';

// Cliente para Server Components, Server Actions y Route Handlers.
// Crea uno nuevo por solicitud; usa la sesión del usuario (no la service_role),
// así que RLS aplica igual que en el navegador.
export async function crearClienteServidor() {
  verificarConfig();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: no puede escribir cookies.
          // No pasa nada: el proxy ya refresca la sesión en cada solicitud.
        }
      },
    },
  });
}
