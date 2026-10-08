'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { ImagenProducto } from '@/components/ui/ImagenProducto';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { fecha, hora, pesos, transcurrido } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import { useTurno } from '@/lib/turno';
import type { DatosDashboard, TurnoResumen } from '@/lib/types';
import { FeedActividad } from './FeedActividad';

async function cargarDashboard() {
  const supabase = crearCliente();
  const [datos, ultimo] = await Promise.all([
    supabase.rpc('datos_dashboard'),
    supabase.from('turnos_resumen').select('*').eq('estado', 'cerrado').order('inicio', { ascending: false }).limit(1).returns<TurnoResumen[]>(),
  ]);
  if (datos.error) throw datos.error;
  if (ultimo.error) throw ultimo.error;
  return { ...(datos.data as DatosDashboard), ultimo: ultimo.data[0] ?? null };
}

// Pantalla inicial de la dueña: cómo va el turno, en vivo y sin recargar.
export function PanelDashboard() {
  const { turno } = useTurno();
  const { datos, error, recargar } = useCarga(cargarDashboard);
  const enVivo = useTiempoReal(
    ['cuentas', 'cuenta_items', 'pagos', 'turnos', 'productos', 'movimientos_inv', 'auditoria_items'],
    recargar,
  );

  // Los tiempos ("hace 25 min") se refrescan cada 30 segundos.
  const [ahora, setAhora] = useState<Date | undefined>(undefined);
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void recargar();
  }, [turno?.id, recargar]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black">Hoy en La Barra</h1>
          {datos?.turno ? (
            <p className="text-sm text-tenue">
              Turno abierto desde {hora(datos.turno.inicio)} · {datos.turno.operador ?? '—'}
            </p>
          ) : null}
        </div>
        <EstadoEnVivo enVivo={enVivo} actualizado={datos?.generado_en} />
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {!datos && !error ? <p className="text-tenue">Cargando…</p> : null}

      {datos && !datos.turno ? <SinTurno ultimo={datos.ultimo} /> : null}

      {datos?.turno ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Cifras datos={datos} />
            <Alertas datos={datos} />
            <MesasAbiertas datos={datos} ahora={ahora} />
            <MasVendidos datos={datos} />
          </div>
          <div className="min-w-0">
            <FeedActividad />
          </div>
        </div>
      ) : datos ? (
        <FeedActividad />
      ) : null}
    </section>
  );
}

function EstadoEnVivo({ enVivo, actualizado }: { enVivo: boolean; actualizado?: string }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
        enVivo ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'
      }`}
    >
      <span className={`size-2 rounded-full ${enVivo ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`} />
      {enVivo ? 'En vivo' : 'Reconectando…'}
      {actualizado ? <span className="font-normal opacity-75">· {hora(actualizado)}</span> : null}
    </span>
  );
}

function SinTurno({ ultimo }: { ultimo: TurnoResumen | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
      <h2 className="text-lg font-bold">No hay un turno abierto</h2>
      {ultimo ? (
        <>
          <p className="text-sm text-tenue">
            Último turno: <span className="first-letter:uppercase">{fecha(ultimo.inicio)}</span>, {hora(ultimo.inicio)} –{' '}
            {ultimo.fin ? hora(ultimo.fin) : ''} · {ultimo.operador}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cifra titulo="Cobrado" valor={pesos(ultimo.total_pagos)} fuerte />
            <Cifra titulo="Efectivo" valor={pesos(ultimo.total_efectivo)} />
            <Cifra titulo="Daviplata" valor={pesos(ultimo.total_daviplata)} />
            <Cifra titulo="Bre-B" valor={pesos(ultimo.total_bre_b)} />
          </div>
          <CuadreTexto diferencia={ultimo.diferencia} />
          <Link href="/turnos" className="self-start text-sm font-semibold text-cafe underline">
            Ver historial de turnos
          </Link>
        </>
      ) : (
        <p className="text-sm text-tenue">Todavía no se ha cerrado ningún turno.</p>
      )}
    </div>
  );
}

function CuadreTexto({ diferencia }: { diferencia: number | null }) {
  if (diferencia === null || diferencia === 0) return <Aviso tipo="exito">La caja cuadró exacto.</Aviso>;
  if (diferencia > 0) return <Aviso tipo="advertencia">Sobraron {pesos(diferencia)} en la caja.</Aviso>;
  return <Aviso tipo="error">Faltaron {pesos(-diferencia)} en la caja.</Aviso>;
}

function Cifra({ titulo, valor, nota, fuerte }: { titulo: string; valor: string; nota?: string; fuerte?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${fuerte ? 'border-marca bg-marca/10' : 'border-borde bg-superficie'}`}>
      <p className="text-xs font-medium text-tenue">{titulo}</p>
      <p className={`font-black tabular-nums ${fuerte ? 'text-2xl text-cafe' : 'text-xl'}`}>{valor}</p>
      {nota ? <p className="text-xs text-tenue">{nota}</p> : null}
    </div>
  );
}

function Cifras({ datos }: { datos: DatosDashboard }) {
  const t = datos.turno!;
  const metodos = [
    { titulo: 'Efectivo', valor: t.pagos.efectivo },
    { titulo: 'Daviplata', valor: t.pagos.daviplata },
    { titulo: 'Bre-B', valor: t.pagos.bre_b },
  ];
  const max = Math.max(1, ...metodos.map((m) => m.valor));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra titulo="Cobrado" valor={pesos(t.pagos.total)} fuerte />
        <Cifra titulo="Por cobrar" valor={pesos(t.cuentas.saldo_pendiente)} nota={`${t.cuentas.abiertas} cuenta(s) abierta(s)`} />
        <Cifra titulo="Consumo del turno" valor={pesos(datos.consumo)} />
        <Cifra titulo="Efectivo en caja" valor={pesos(t.efectivo_esperado)} nota={`base ${pesos(t.base_caja)}`} />
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
        <h2 className="text-sm font-bold">Cobrado por método</h2>
        {metodos.map((m) => (
          <div key={m.titulo} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
            <span className="text-tenue">{m.titulo}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-suave">
              <span className="block h-full rounded-full bg-marca" style={{ width: `${(m.valor / max) * 100}%` }} />
            </span>
            <span className="font-bold tabular-nums">{pesos(m.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Alertas({ datos }: { datos: DatosDashboard }) {
  if (!datos.ventas_sin_stock.length && !datos.stock_bajo.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {datos.ventas_sin_stock.length ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="mb-2 text-sm font-bold text-rose-800">Ventas sin stock en este turno ({datos.ventas_sin_stock.length})</h2>
          <ul className="flex flex-col gap-1 text-sm text-rose-900">
            {datos.ventas_sin_stock.map((v) => (
              <li key={v.id}>
                {hora(v.creado_en)} · {v.cantidad} {v.nombre} · {v.cuenta} · <strong>quedó en {v.stock_resultante}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {datos.stock_bajo.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-amber-900">Stock bajo ({datos.stock_bajo.length})</h2>
            <Link href="/inventario" className="text-xs font-semibold text-cafe underline">
              Ir a inventario
            </Link>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {datos.stock_bajo.map((p) => (
              <li key={p.producto_id} className="flex items-center gap-2 text-sm">
                <ImagenProducto producto={p} tamano={28} />
                <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                <span className={`font-bold tabular-nums ${p.stock_actual <= 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                  {p.stock_actual}
                </span>
                <span className="text-xs text-tenue">/ {p.stock_minimo}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MesasAbiertas({ datos, ahora }: { datos: DatosDashboard; ahora?: Date }) {
  const grupos = new Map<string, DatosDashboard['cuentas_abiertas']>();
  for (const c of datos.cuentas_abiertas) {
    const clave = c.mesa ?? 'Sin mesa';
    grupos.set(clave, [...(grupos.get(clave) ?? []), c]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
      <h2 className="text-sm font-bold">Mesas abiertas ({grupos.size})</h2>
      {grupos.size === 0 ? <p className="text-sm text-tenue">No hay mesas ocupadas en este momento.</p> : null}
      <ul className="grid gap-2 sm:grid-cols-2">
        {[...grupos.entries()].map(([mesa, cuentas]) => {
          const saldo = cuentas.reduce((s, c) => s + c.total - c.pagado, 0);
          const desde = cuentas.reduce((min, c) => (c.abierta_en < min ? c.abierta_en : min), cuentas[0].abierta_en);
          const mesaId = cuentas[0].mesa_id;
          const contenido = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{mesa}</span>
                <span className="font-black text-cafe">{saldo > 0 ? pesos(saldo) : 'al día'}</span>
              </div>
              <p className="text-xs text-tenue">
                {cuentas.length} cuenta(s) · hace {transcurrido(desde, ahora)}
              </p>
              <ul className="mt-1 text-xs text-tenue">
                {cuentas.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{c.nombre}</span>
                    <span className="tabular-nums">{pesos(c.total - c.pagado)}</span>
                  </li>
                ))}
              </ul>
            </>
          );
          return (
            <li key={mesa}>
              {mesaId ? (
                <Link href={`/mesas/${mesaId}`} className="block rounded-xl border border-marca/40 bg-marca/5 p-3 hover:bg-marca/10">
                  {contenido}
                </Link>
              ) : (
                <div className="rounded-xl border border-borde p-3">{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MasVendidos({ datos }: { datos: DatosDashboard }) {
  const max = Math.max(1, ...datos.mas_vendidos.map((p) => p.cantidad));
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
      <h2 className="text-sm font-bold">Más vendidos del turno</h2>
      {datos.mas_vendidos.length === 0 ? <p className="text-sm text-tenue">Aún no hay ventas en este turno.</p> : null}
      <ol className="flex flex-col gap-2">
        {datos.mas_vendidos.map((p) => (
          <li key={p.producto_id} className="flex items-center gap-3">
            <ImagenProducto producto={p} tamano={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{p.nombre}</span>
                <span className="shrink-0 tabular-nums text-tenue">{pesos(p.total)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-suave">
                  <span className="block h-full rounded-full bg-marca" style={{ width: `${(p.cantidad / max) * 100}%` }} />
                </span>
                <span className="w-8 text-right text-sm font-black tabular-nums">{p.cantidad}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
