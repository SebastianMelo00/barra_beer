'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { VentaRapida } from '@/components/pagos/VentaRapida';
import { AbrirTurno } from '@/components/turno/AbrirTurno';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Modal } from '@/components/ui/Modal';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { pesos, transcurrido } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import { useTurno } from '@/lib/turno';
import type { Cuenta, Mesa, Producto } from '@/lib/types';

async function cargarDatos() {
  const supabase = crearCliente();
  const [mesas, cuentas, productos] = await Promise.all([
    supabase.from('mesas').select('*').order('orden_visual').returns<Mesa[]>(),
    supabase.from('cuentas').select('*').eq('estado', 'abierta').returns<Cuenta[]>(),
    supabase.from('productos').select('*').order('orden').returns<Producto[]>(),
  ]);
  if (mesas.error) throw mesas.error;
  if (cuentas.error) throw cuentas.error;
  if (productos.error) throw productos.error;
  return { mesas: mesas.data, cuentas: cuentas.data, productos: productos.data };
}

// Pantalla principal de caja: todas las mesas de un vistazo + venta rápida.
export function PanelMesas() {
  const { turno, cargando: cargandoTurno } = useTurno();
  const { datos, error, recargar } = useCarga(cargarDatos);
  useTiempoReal(['cuentas', 'productos'], recargar);
  const [ventaRapida, setVentaRapida] = useState(false);
  const [ahora, setAhora] = useState<Date | undefined>(undefined);

  // Refresca los tiempos ("hace 25 min") cada 30 segundos.
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Al abrir/cerrar el turno cambian las cuentas visibles.
  useEffect(() => {
    void recargar();
  }, [turno?.id, recargar]);

  if (cargandoTurno) return <p className="text-tenue">Cargando…</p>;
  if (!turno) return <AbrirTurno />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!datos) return <p className="text-tenue">Cargando mesas…</p>;

  const porMesa = new Map<number, Cuenta[]>();
  for (const c of datos.cuentas) {
    if (c.mesa_id === null) continue;
    porMesa.set(c.mesa_id, [...(porMesa.get(c.mesa_id) ?? []), c]);
  }
  const ocupadas = [...porMesa.keys()].length;
  const saldoTotal = datos.cuentas.reduce((s, c) => s + c.total - c.pagado, 0);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Mesas</h1>
          <p className="text-sm text-tenue">
            {ocupadas} de {datos.mesas.length} ocupadas · por cobrar {pesos(saldoTotal)}
          </p>
        </div>
        <Boton tamano="xl" onClick={() => setVentaRapida(true)} className="min-w-64 text-xl tracking-wide">
          ⚡ VENTA RÁPIDA
        </Boton>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {datos.mesas.map((m) => {
          const cuentas = porMesa.get(m.id) ?? [];
          const ocupada = cuentas.length > 0;
          const saldo = cuentas.reduce((s, c) => s + c.total - c.pagado, 0);
          const desde = cuentas.reduce<string | null>((min, c) => (!min || c.abierta_en < min ? c.abierta_en : min), null);
          return (
            <Link
              key={m.id}
              href={`/mesas/${m.id}`}
              prefetch
              className={`flex min-h-36 flex-col justify-between rounded-2xl border-2 p-4 shadow-sm transition hover:shadow-md active:scale-[0.98] ${
                ocupada ? 'border-marca bg-marca/10' : 'border-borde bg-superficie hover:border-marca/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xl font-black">{m.nombre}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    ocupada ? 'bg-marca text-texto' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  }`}
                >
                  {ocupada ? 'Ocupada' : 'Libre'}
                </span>
              </div>
              {ocupada ? (
                <div className="flex flex-col">
                  <span className="text-2xl font-black text-cafe">{saldo > 0 ? pesos(saldo) : 'Al día'}</span>
                  <span className="text-xs text-tenue">
                    {cuentas.length} cuenta{cuentas.length > 1 ? 's' : ''}
                    {desde ? ` · ${transcurrido(desde, ahora)}` : ''}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-tenue">Toca para abrir</span>
              )}
            </Link>
          );
        })}
      </div>

      <Modal abierto={ventaRapida} onCerrar={() => setVentaRapida(false)} titulo="Venta rápida" ancho="xl">
        {ventaRapida ? (
          <VentaRapida
            productos={datos.productos}
            onListo={() => {
              setVentaRapida(false);
              void recargar();
            }}
          />
        ) : null}
      </Modal>
    </section>
  );
}
