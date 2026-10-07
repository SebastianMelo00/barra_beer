'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { ENLACES_NAV } from '@/lib/rutas';
import { SesionProvider, cerrarSesion, useSesion } from '@/lib/sesion';

// Estructura común de las pantallas con sesión: barra superior + contenido.
export function Marco({ children }: { children: ReactNode }) {
  return (
    <SesionProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
            <Link href="/" className="shrink-0 text-lg font-black tracking-tight text-amber-400">
              La Barra Beer
            </Link>
            {/* La ruta actual solo se conoce al navegar: va en su propio Suspense. */}
            <Suspense fallback={<div className="flex-1" />}>
              <Navegacion />
            </Suspense>
            <Usuario />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </SesionProvider>
  );
}

function Navegacion() {
  const pathname = usePathname();
  const { cargando, esAdmin } = useSesion();
  const enlaces = ENLACES_NAV.filter((e) => !e.soloAdmin || esAdmin);

  return (
    <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1" aria-label="Principal">
      {cargando
        ? null
        : enlaces.map((e) => {
            const activo = pathname === e.href || pathname.startsWith(`${e.href}/`);
            return (
              <Link
                key={e.href}
                href={e.href}
                aria-current={activo ? 'page' : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  activo ? 'bg-amber-400 text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {e.texto}
              </Link>
            );
          })}
    </nav>
  );
}

function Usuario() {
  const { perfil } = useSesion();
  return (
    <div className="flex shrink-0 items-center gap-2">
      {perfil ? (
        <span className="hidden text-sm text-zinc-400 md:inline">
          {perfil.nombre} · {perfil.rol === 'admin' ? 'Admin' : 'Caja'}
        </span>
      ) : null}
      <button
        type="button"
        onClick={cerrarSesion}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      >
        Salir
      </button>
    </div>
  );
}
