'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';
import { ENLACES_NAV } from '@/lib/rutas';
import { hora } from '@/lib/formato';
import { SesionProvider, cerrarSesion, useSesion } from '@/lib/sesion';
import { TurnoProvider, useTurno } from '@/lib/turno';
import { NotificacionesProvider } from './Notificaciones';

// Estructura común de las pantallas con sesión: barra superior + contenido.
export function Marco({ children }: { children: ReactNode }) {
  return (
    <SesionProvider>
      <TurnoProvider>
        <NotificacionesProvider>
          <div className="flex min-h-dvh flex-col">
            <header className="sticky top-0 z-30 border-b border-borde bg-superficie/95 backdrop-blur">
              <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
                <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="La Barra Beer, inicio">
                  <Image src="/logo_barrabeer.jpeg" alt="" width={36} height={36} className="size-9 rounded-lg" priority />
                  <span className="hidden text-lg font-black tracking-tight text-cafe lg:inline">La Barra Beer</span>
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
      </TurnoProvider>
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
              esActivo(e.href) ? 'bg-marca text-texto' : 'text-texto hover:bg-suave'
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
          className="flex items-center gap-2 rounded-lg bg-suave px-3 py-2 text-sm font-semibold"
        >
          <span aria-hidden>☰</span>
          {actual?.texto ?? 'Menú'}
        </button>
        {menuAbierto ? (
          <nav
            id="menu-movil"
            aria-label="Principal"
            className="absolute inset-x-0 top-full grid grid-cols-2 gap-2 border-b border-borde bg-superficie p-4 shadow-2xl"
          >
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                onClick={() => setMenuAbierto(false)}
                aria-current={esActivo(e.href) ? 'page' : undefined}
                className={`rounded-xl px-4 py-4 text-center text-base font-semibold ${
                  esActivo(e.href) ? 'bg-marca text-texto' : 'bg-suave text-texto'
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
  const { turno, cargando } = useTurno();
  return (
    <div className="flex shrink-0 items-center gap-2">
      {cargando ? null : (
        <Link
          href="/turno"
          title={turno ? `Turno abierto desde ${hora(turno.inicio)}` : 'No hay turno abierto'}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
            turno ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-suave text-tenue ring-borde'
          }`}
        >
          <span className={`size-2 rounded-full ${turno ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
          <span className="hidden sm:inline">{turno ? `Turno ${hora(turno.inicio)}` : 'Sin turno'}</span>
        </Link>
      )}
      {perfil ? (
        <span className="hidden text-sm text-tenue xl:inline">
          {perfil.nombre} · {perfil.rol === 'admin' ? 'Admin' : 'Caja'}
        </span>
      ) : null}
      <button
        type="button"
        onClick={cerrarSesion}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-tenue hover:bg-suave hover:text-texto"
      >
        Salir
      </button>
    </div>
  );
}
