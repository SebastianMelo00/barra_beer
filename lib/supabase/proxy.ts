import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Rol } from '@/lib/types';
import { supabaseKey, supabaseUrl, verificarConfig } from './config';

type CookieAEscribir = Parameters<SetAllCookies>[0][number];

// Refresca la sesión de Supabase (cookies) y averigua el rol del usuario.
// Devuelve funciones para continuar o redirigir sin perder las cookies nuevas.
export async function actualizarSesion(request: NextRequest) {
  verificarConfig();
  let cookiesNuevas: CookieAEscribir[] = [];
  let cabecerasCache: Record<string, string> = {};

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesNuevas = cookiesToSet;
        cabecerasCache = headers;
      },
    },
  });

  // getClaims valida el JWT; no confiar en getSession() del lado servidor.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  let rol: Rol | null = null;
  if (userId) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, activo')
      .eq('id', userId)
      .maybeSingle();
    rol = perfil?.activo ? (perfil.rol as Rol) : null;
  }

  function aplicar<T extends NextResponse>(res: T): T {
    cookiesNuevas.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    Object.entries(cabecerasCache).forEach(([key, value]) => res.headers.set(key, value));
    return res;
  }

  return {
    userId,
    rol,
    continuar: () => aplicar(NextResponse.next({ request })),
    redirigir: (ruta: string) => aplicar(NextResponse.redirect(new URL(ruta, request.url))),
  };
}
