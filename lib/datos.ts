'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mensajeError } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';

/**
 * Carga datos al montar y expone `recargar`. `cargar` puede cambiar en cada
 * render (usa los filtros actuales); quien llama decide cuándo recargar.
 */
export function useCarga<T>(cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false); // true tras la primera carga exitosa
  const cargarRef = useRef(cargar);
  const pedido = useRef(0);

  useEffect(() => {
    cargarRef.current = cargar;
  });

  const recargar = useCallback(async () => {
    const id = ++pedido.current;
    try {
      const resultado = await cargarRef.current();
      // Si llegó una respuesta más nueva mientras tanto, se descarta esta.
      if (id !== pedido.current) return;
      setDatos(resultado);
      setCargado(true);
      setError(null);
    } catch (e) {
      if (id === pedido.current) setError(mensajeError(e));
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, error, cargado, recargar };
}

/**
 * Escucha cambios en vivo (Supabase Realtime) de las tablas indicadas y llama
 * `alCambiar` (agrupando ráfagas). También recarga al volver a la pestaña o
 * al reconectarse, para no perder cambios ocurridos sin conexión.
 * Devuelve si la conexión en vivo está activa.
 */
export function useTiempoReal(tablas: string[], alCambiar: () => void) {
  const [conectado, setConectado] = useState(false);
  const alCambiarRef = useRef(alCambiar);
  const clave = tablas.join(',');

  useEffect(() => {
    alCambiarRef.current = alCambiar;
  });

  useEffect(() => {
    const supabase = crearCliente();
    let espera: ReturnType<typeof setTimeout> | undefined;
    let conectadoAntes = false;

    const avisar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => alCambiarRef.current(), 250);
    };

    const canal = supabase.channel(`vivo:${clave}:${Math.random().toString(36).slice(2)}`);
    for (const tabla of clave.split(',')) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, avisar);
    }
    canal.subscribe((estado) => {
      setConectado(estado === 'SUBSCRIBED');
      if (estado !== 'SUBSCRIBED') return;
      if (conectadoAntes) avisar(); // reconexión: pudo haber cambios
      conectadoAntes = true;
    });

    const alVolver = () => {
      if (document.visibilityState === 'visible') avisar();
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      clearTimeout(espera);
      document.removeEventListener('visibilitychange', alVolver);
      void supabase.removeChannel(canal);
    };
  }, [clave]);

  return conectado;
}
