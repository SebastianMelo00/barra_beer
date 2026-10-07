'use client';

import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Insignia } from '@/components/ui/Insignia';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { fecha, hora, pesos } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import type { AuditoriaItem, Cuenta, Mesa, Perfil, Producto, TurnoResumen } from '@/lib/types';

const PAGINA = 20;

// Historial de turnos (solo admin): totales por método, cuadre de caja,
// cuentas anuladas e ítems quitados de cada turno.
export function HistorialTurnos() {
  const [limite, setLimite] = useState(PAGINA);
  const [abierto, setAbierto] = useState<number | null>(null);

  const { datos, error, recargar } = useCarga(async () => {
    const { data, error } = await crearCliente()
      .from('turnos_resumen')
      .select('*')
      .order('inicio', { ascending: false })
      .limit(limite + 1)
      .returns<TurnoResumen[]>();
    if (error) throw error;
    return data;
  });
  useTiempoReal(['turnos', 'pagos'], recargar);

  const turnos = (datos ?? []).slice(0, limite);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Historial de turnos</h1>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {!datos && !error ? <p className="text-tenue">Cargando turnos…</p> : null}
      {datos && turnos.length === 0 ? <p className="text-tenue">Todavía no hay turnos.</p> : null}

      <ul className="flex flex-col gap-3">
        {turnos.map((t) => (
          <li key={t.id} className="overflow-hidden rounded-2xl border border-borde bg-superficie shadow-sm">
            <button
              type="button"
              onClick={() => setAbierto(abierto === t.id ? null : t.id)}
              aria-expanded={abierto === t.id}
              className="flex w-full flex-col gap-3 p-4 text-left hover:bg-suave/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold capitalize">{fecha(t.inicio)}</p>
                  <p className="text-sm text-tenue">
                    {hora(t.inicio)} – {t.fin ? hora(t.fin) : 'en curso'} · {t.operador ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.estado === 'abierto' ? <Insignia color="verde">Abierto</Insignia> : <CuadreInsignia diferencia={t.diferencia} />}
                  <span className="text-2xl font-black text-cafe">{pesos(t.total_pagos)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
                <Dato titulo="Efectivo" valor={pesos(t.total_efectivo)} />
                <Dato titulo="Daviplata" valor={pesos(t.total_daviplata)} />
                <Dato titulo="Bre-B" valor={pesos(t.total_bre_b)} />
                <Dato titulo="Cuentas" valor={String(t.cuentas_pagadas)} />
                <Dato titulo="Anuladas" valor={String(t.cuentas_anuladas)} alerta={t.cuentas_anuladas > 0} />
                <Dato titulo="Ítems quitados" valor={String(t.items_eliminados)} alerta={t.items_eliminados > 0} />
              </div>
            </button>
            {abierto === t.id ? <DetalleTurno turno={t} /> : null}
          </li>
        ))}
      </ul>

      {(datos?.length ?? 0) > limite ? (
        <Boton variante="secundario" className="self-center" onClick={() => setLimite((l) => l + PAGINA)}>
          Ver turnos anteriores
        </Boton>
      ) : null}
    </section>
  );
}

function Dato({ titulo, valor, alerta }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-lg bg-suave px-2 py-1.5">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className={`font-bold tabular-nums ${alerta ? 'text-rose-600' : ''}`}>{valor}</p>
    </div>
  );
}

function CuadreInsignia({ diferencia }: { diferencia: number | null }) {
  if (diferencia === null || diferencia === 0) return <Insignia color="verde">Cuadró</Insignia>;
  if (diferencia > 0) return <Insignia color="amarillo">Sobró {pesos(diferencia)}</Insignia>;
  return <Insignia color="rojo">Faltó {pesos(-diferencia)}</Insignia>;
}

function DetalleTurno({ turno }: { turno: TurnoResumen }) {
  const { datos, error } = useCarga(async () => {
    const supabase = crearCliente();
    const [anuladas, quitados, mesas, productos, perfiles] = await Promise.all([
      supabase.from('cuentas').select('*').eq('turno_id', turno.id).eq('estado', 'anulada').returns<Cuenta[]>(),
      supabase.from('auditoria_items').select('*').eq('turno_id', turno.id).order('creado_en').returns<AuditoriaItem[]>(),
      supabase.from('mesas').select('*').returns<Mesa[]>(),
      supabase.from('productos').select('id, nombre').returns<Pick<Producto, 'id' | 'nombre'>[]>(),
      supabase.from('perfiles').select('*').returns<Perfil[]>(),
    ]);
    for (const r of [anuladas, quitados, mesas, productos, perfiles]) if (r.error) throw r.error;
    return {
      anuladas: anuladas.data ?? [],
      quitados: quitados.data ?? [],
      mesa: new Map((mesas.data ?? []).map((m) => [m.id, m.nombre])),
      producto: new Map((productos.data ?? []).map((p) => [p.id, p.nombre])),
      persona: new Map((perfiles.data ?? []).map((p) => [p.id, p.nombre])),
    };
  });

  if (error) return <div className="p-4"><Aviso tipo="error">{error}</Aviso></div>;
  if (!datos) return <p className="p-4 text-tenue">Cargando detalle…</p>;

  return (
    <div className="flex flex-col gap-4 border-t border-borde bg-fondo p-4 text-sm">
      {turno.estado === 'cerrado' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Dato titulo="Base de caja" valor={pesos(turno.base_caja)} />
          <Dato titulo="Efectivo esperado" valor={pesos(turno.efectivo_esperado)} />
          <Dato titulo="Efectivo contado" valor={pesos(turno.efectivo_contado)} />
          <Dato titulo="Diferencia" valor={pesos(turno.diferencia)} alerta={(turno.diferencia ?? 0) < 0} />
        </div>
      ) : null}
      {turno.notas ? <p>Notas: {turno.notas}</p> : null}

      <div>
        <h3 className="mb-1 font-bold">Cuentas anuladas</h3>
        {datos.anuladas.length === 0 ? (
          <p className="text-tenue">Ninguna.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {datos.anuladas.map((c) => (
              <li key={c.id} className="rounded-lg bg-superficie px-3 py-2 ring-1 ring-borde">
                <strong>{c.mesa_id ? `${datos.mesa.get(c.mesa_id)} · ` : ''}{c.nombre}</strong> · {pesos(c.total)} · {c.motivo_anulacion}
                <span className="text-tenue"> — {datos.persona.get(c.anulada_por ?? '') ?? '—'}{c.cerrada_en ? `, ${hora(c.cerrada_en)}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-1 font-bold">Ítems quitados y movidos</h3>
        {datos.quitados.length === 0 ? (
          <p className="text-tenue">Ninguno.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {datos.quitados.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-superficie px-3 py-2 ring-1 ring-borde">
                <Insignia color={a.tipo === 'eliminado' ? 'rojo' : 'azul'}>{a.tipo === 'eliminado' ? 'Quitado' : 'Movido'}</Insignia>
                <span>
                  {a.cantidad} {datos.producto.get(a.producto_id)} ({pesos(a.cantidad * a.precio_unitario)})
                </span>
                {a.motivo ? <span className="text-tenue">· {a.motivo}</span> : null}
                <span className="text-tenue">
                  — {datos.persona.get(a.usuario_id ?? '') ?? '—'}, {hora(a.creado_en)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
