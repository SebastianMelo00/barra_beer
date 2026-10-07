'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Perfil } from '@/lib/types';

type EstadoSesion = { perfil: Perfil | null; cargando: boolean };

const SesionContext = createContext<EstadoSesion>({ perfil: null, cargando: true });

// Se pide una sola vez por carga de página y se comparte entre layouts.
let perfilPromesa: Promise<Perfil | null> | null = null;

function cargarPerfil(): Promise<Perfil | null> {
  perfilPromesa ??= (async () => {
    const supabase = crearCliente();
    const { data: claims } = await supabase.auth.getClaims();
    const id = claims?.claims?.sub;
    if (!id) return null;
    const { data } = await supabase.from('perfiles').select('*').eq('id', id).maybeSingle<Perfil>();
    return data ?? null;
  })().catch(() => {
    perfilPromesa = null;
    return null;
  });
  return perfilPromesa;
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ perfil: null, cargando: true });

  useEffect(() => {
    let vigente = true;
    cargarPerfil().then((perfil) => {
      if (vigente) setEstado({ perfil, cargando: false });
    });
    return () => {
      vigente = false;
    };
  }, []);

  return <SesionContext value={estado}>{children}</SesionContext>;
}

export function useSesion() {
  const { perfil, cargando } = useContext(SesionContext);
  return { perfil, cargando, esAdmin: perfil?.rol === 'admin' };
}

export async function cerrarSesion() {
  perfilPromesa = null;
  await crearCliente().auth.signOut();
  // Recarga completa para limpiar cachés y suscripciones en vivo.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/login');
}
