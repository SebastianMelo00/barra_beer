'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Turno } from '@/lib/types';

type EstadoTurno = { turno: Turno | null; cargando: boolean; recargar: () => Promise<void> };

const TurnoContext = createContext<EstadoTurno>({ turno: null, cargando: true, recargar: async () => {} });

async function cargarTurno() {
  const { data, error } = await crearCliente().from('turnos').select('*').eq('estado', 'abierto').maybeSingle<Turno>();
  if (error) throw error;
  return data;
}

// Turno abierto, compartido por todas las pantallas y actualizado en vivo.
export function TurnoProvider({ children }: { children: ReactNode }) {
  const { datos, error, cargado, recargar } = useCarga(cargarTurno);
  useTiempoReal(['turnos'], recargar);
  const cargando = !cargado && error === null;
  return <TurnoContext value={{ turno: datos ?? null, cargando, recargar }}>{children}</TurnoContext>;
}

export function useTurno() {
  return useContext(TurnoContext);
}
