'use client';

import { useEffect, useState } from 'react';
import { Insignia, type ColorInsignia } from '@/components/ui/Insignia';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { hora, pesos } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Actividad, Perfil, TipoActividad } from '@/lib/types';

const TIPOS: Record<TipoActividad, { texto: string; color: ColorInsignia }> = {
  venta: { texto: 'Venta', color: 'marca' },
  pago: { texto: 'Pago', color: 'verde' },
  eliminado: { texto: 'Quitado', color: 'rojo' },
  movido: { texto: 'Movido', color: 'azul' },
  anulacion: { texto: 'Anulación', color: 'rojo' },
  entrada: { texto: 'Entrada', color: 'verde' },
  merma: { texto: 'Merma', color: 'amarillo' },
  ajuste: { texto: 'Ajuste', color: 'amarillo' },
  turno: { texto: 'Turno', color: 'gris' },
};

async function cargarActividad() {
  const supabase = crearCliente();
  const [actividad, perfiles] = await Promise.all([
    supabase.from('actividad').select('*').order('id', { ascending: false }).limit(40).returns<Actividad[]>(),
    supabase.from('perfiles').select('id, nombre').returns<Pick<Perfil, 'id' | 'nombre'>[]>(),
  ]);
  if (actividad.error) throw actividad.error;
  if (perfiles.error) throw perfiles.error;
  return { actividad: actividad.data, personas: new Map(perfiles.data.map((p) => [p.id, p.nombre])) };
}

// Lo que pasa en el bar, al instante: ventas, pagos, ítems quitados o movidos,
// anulaciones, mermas y entradas.
export function FeedActividad() {
  const { datos, error, recargar } = useCarga(cargarActividad);
  useTiempoReal(['actividad'], recargar);

  const lista = datos?.actividad ?? [];

  // Lo que llega después de la primera carga se resalta un momento: `umbral`
  // es el último id ya visto y se actualiza cuando termina la animación.
  const [umbral, setUmbral] = useState<number | null>(null);
  const maxId = lista[0]?.id ?? null;
  useEffect(() => {
    if (maxId === null) return;
    const t = setTimeout(() => setUmbral(maxId), 2600);
    return () => clearTimeout(t);
  }, [maxId]);

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-borde bg-superficie shadow-sm">
      <h2 className="border-b border-borde px-4 py-3 font-bold">Actividad en vivo</h2>
      {error ? <p className="p-4 text-sm text-rose-600">{error}</p> : null}
      {!datos && !error ? <p className="p-4 text-sm text-tenue">Cargando…</p> : null}
      {datos && lista.length === 0 ? <p className="p-4 text-sm text-tenue">Todavía no hay movimientos.</p> : null}
      <ol className="max-h-[32rem] divide-y divide-borde overflow-y-auto">
        {lista.map((a) => (
          <li
            key={a.id}
            className={`flex gap-3 px-4 py-2.5 ${umbral !== null && a.id > umbral ? 'recien-llegado' : ''}`}
          >
            <span className="w-16 shrink-0 pt-0.5 text-xs text-tenue">{hora(a.creado_en)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Insignia color={TIPOS[a.tipo]?.color ?? 'gris'}>{TIPOS[a.tipo]?.texto ?? a.tipo}</Insignia>
                <span className="text-xs text-tenue">{datos?.personas.get(a.usuario_id ?? '') ?? ''}</span>
              </div>
              <p className="mt-0.5 text-sm leading-snug">{a.descripcion}</p>
            </div>
            {a.monto && a.tipo !== 'turno' ? (
              <span
                className={`shrink-0 text-sm font-bold tabular-nums ${
                  a.tipo === 'pago' ? 'text-emerald-700' : a.tipo === 'eliminado' || a.tipo === 'anulacion' ? 'text-rose-600' : ''
                }`}
              >
                {pesos(a.monto)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
