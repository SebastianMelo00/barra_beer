'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';
import { ENLACES_NAV } from '@/lib/rutas';
import { SesionProvider, cerrarSesion, useSesion } from '@/lib/sesion';
import { NotificacionesProvider } from './Notificaciones';

// Estructura común de las pantallas con sesión: barra superior + contenido.
export function Marco({ children }: { children: ReactNode }) {
  return (
    <SesionProvider>
      <NotificacionesProvider>
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
              <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="La Barra Beer, inicio">
                <Image src="/logo_barrabeer.jpeg" alt="" width={36} height={36} className="size-9 rounded-lg" priority />
                <span className="hidden text-lg font-black tracking-tight text-marca lg:inline">La Barra Beer</span>
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
      </NotificacionesProvider>
    </SesionProvider>
  );
}

function Navegacion() {
  const pathname = usePathname();
  const { cargando, esAdmin } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const enlaces = ENLACES_NAV.filter((e) => !e.soloAdmin || esAdmin);
  const esActivo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const actual = enlaces.find((e) => esActivo(e.href));

  if (cargando) return <div className="flex-1" />;

  return (
    <>
      {/* Computador y tableta: todas las secciones a la vista. */}
      <nav className="-mx-1 hidden flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:flex" aria-label="Principal">
        {enlaces.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            aria-current={esActivo(e.href) ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              esActivo(e.href) ? 'bg-marca text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {e.texto}
          </Link>
        ))}
      </nav>

      {/* Celular: menú desplegable. */}
      <div className="flex-1 sm:hidden">
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          aria-controls="menu-movil"
          className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold"
        >
          <span aria-hidden>☰</span>
          {actual?.texto ?? 'Menú'}
        </button>
        {menuAbierto ? (
          <nav
            id="menu-movil"
            aria-label="Principal"
            className="absolute inset-x-0 top-full grid grid-cols-2 gap-2 border-b border-zinc-800 bg-zinc-950 p-4 shadow-2xl"
          >
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                onClick={() => setMenuAbierto(false)}
                aria-current={esActivo(e.href) ? 'page' : undefined}
                className={`rounded-xl px-4 py-4 text-center text-base font-semibold ${
                  esActivo(e.href) ? 'bg-marca text-zinc-950' : 'bg-zinc-900 text-zinc-200'
                }`}
              >
                {e.texto}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </>
  );
}

function Usuario() {
  const { perfil } = useSesion();
  return (
    <div className="flex shrink-0 items-center gap-2">
      {perfil ? (
        <span className="hidden text-sm text-zinc-400 xl:inline">
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
