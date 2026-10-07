// Protección de rutas por rol (en Next.js 16 "middleware.ts" pasó a llamarse
// "proxy.ts"; hace lo mismo). Es una primera barrera para la navegación: la
// seguridad real está en la base de datos (RLS + funciones RPC).
import type { NextRequest } from 'next/server';
import { actualizarSesion } from '@/lib/supabase/proxy';
import { inicioPorRol } from '@/lib/rutas';

const RUTAS_SOLO_ADMIN = ['/dashboard', '/productos', '/turnos'];

function empiezaCon(path: string, prefijos: string[]) {
  return prefijos.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { userId, rol, continuar, redirigir } = await actualizarSesion(request);
  const path = request.nextUrl.pathname;
  const enLogin = path === '/login';

  if (!userId) {
    return enLogin ? continuar() : redirigir('/login');
  }

  // Sesión válida pero sin perfil (o desactivado): se queda en /login con aviso.
  if (!rol) {
    return enLogin ? continuar() : redirigir('/login?error=sin-perfil');
  }

  if (enLogin || path === '/') {
    return redirigir(inicioPorRol(rol));
  }

  if (rol !== 'admin' && empiezaCon(path, RUTAS_SOLO_ADMIN)) {
    return redirigir(inicioPorRol(rol));
  }

  return continuar();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|webmanifest)$).*)'],
};
