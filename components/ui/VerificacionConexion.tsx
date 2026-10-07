'use client';

import { useEffect, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { pesos, mensajeError } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Mesa, Producto } from '@/lib/types';

// Pantalla de prueba de la Fase 1: confirma que la sesión, el rol y la lectura
// de datos (RLS) funcionan contra Supabase.
export function VerificacionConexion() {
  const { perfil } = useSesion();
  const [mesas, setMesas] = useState<Mesa[] | null>(null);
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = crearCliente();
    Promise.all([
      supabase.from('mesas').select('*').order('orden_visual').returns<Mesa[]>(),
      supabase.from('productos').select('*').order('orden').returns<Producto[]>(),
    ]).then(([m, p]) => {
      if (m.error || p.error) {
        setError(mensajeError(m.error ?? p.error));
        return;
      }
      setMesas(m.data);
      setProductos(p.data);
    });
  }, []);

  if (error) return <Aviso tipo="error">Error al leer datos: {error}</Aviso>;
  if (!mesas || !productos) return <p className="text-tenue">Conectando con Supabase…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Aviso tipo="exito">
        Conectado como <strong>{perfil?.nombre}</strong> ({perfil?.rol}). Se leyeron {mesas.length} mesas y{' '}
        {productos.length} productos.
      </Aviso>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {mesas.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 text-center font-semibold ${m.es_barra ? 'border-marca/40 text-cafe' : 'border-borde'}`}
          >
            {m.nombre}
          </div>
        ))}
      </div>
      <ul className="grid gap-1 text-sm text-texto sm:grid-cols-2 lg:grid-cols-3">
        {productos.map((p) => (
          <li key={p.id} className="flex justify-between gap-2 rounded-lg bg-superficie px-3 py-2">
            <span>
              <span className="text-tenue">{p.categoria} · </span>
              {p.nombre}
            </span>
            <span className="tabular-nums">{pesos(p.precio_venta)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
