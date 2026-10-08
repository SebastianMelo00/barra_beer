'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DetalleCuenta, type AccionCuenta } from '@/components/cuentas/DetalleCuenta';
import { DialogoAnularCuenta } from '@/components/cuentas/DialogoAnularCuenta';
import { DialogoMoverItem } from '@/components/cuentas/DialogoMoverItem';
import { DialogoQuitarItem } from '@/components/cuentas/DialogoQuitarItem';
import { FormularioCuenta } from '@/components/cuentas/FormularioCuenta';
import { SelectorProductos } from '@/components/cuentas/SelectorProductos';
import { DialogoDividir } from '@/components/pagos/DialogoDividir';
import { DialogoPago } from '@/components/pagos/DialogoPago';
import { Aviso } from '@/components/ui/Aviso';
import { Modal } from '@/components/ui/Modal';
import { useNotificar } from '@/components/ui/Notificaciones';
import { useTiempoReal } from '@/lib/datos';
import { mensajeError, pesos } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { crearCliente } from '@/lib/supabase/cliente';
import { useTurno } from '@/lib/turno';
import type { Cuenta, CuentaItem, Mesa, Producto } from '@/lib/types';

type Datos = { mesa: Mesa | null; cuentas: Cuenta[]; items: CuentaItem[]; productos: Producto[] };

type Dialogo =
  | { tipo: 'nueva' }
  | { tipo: 'quitar' | 'mover'; item: CuentaItem }
  | { tipo: Exclude<AccionCuenta, 'cerrar'>; cuenta: Cuenta };

const TITULOS: Record<Dialogo['tipo'], string> = {
  nueva: 'Nueva cuenta',
  quitar: 'Quitar producto',
  mover: 'Mover a otra cuenta',
  cobrar: 'Cobrar',
  abonar: 'Abonar',
  dividir: 'Dividir la cuenta',
  anular: 'Anular cuenta',
  renombrar: 'Cambiar nombre',
};

export function PanelMesa({ mesaId }: { mesaId: number }) {
  const router = useRouter();
  const notificar = useNotificar();
  const { esAdmin } = useSesion();
  const { turno, cargando: cargandoTurno } = useTurno();

  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  // Clics de productos: se muestran al instante y se guardan agrupados.
  // Clave "cuentaId:productoId" → unidades aún no confirmadas.
  const [optimista, setOptimista] = useState<Record<string, number>>({});
  const porEnviar = useRef(new Map<string, number>());
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cola = useRef<Promise<void>>(Promise.resolve());

  const cargar = useCallback(async (): Promise<Datos> => {
    const supabase = crearCliente();
    const [mesa, cuentas, productos] = await Promise.all([
      supabase.from('mesas').select('*').eq('id', mesaId).maybeSingle<Mesa>(),
      supabase.from('cuentas').select('*').eq('mesa_id', mesaId).eq('estado', 'abierta').order('abierta_en').order('id').returns<Cuenta[]>(),
      supabase.from('productos').select('*').order('orden').returns<Producto[]>(),
    ]);
    if (mesa.error) throw mesa.error;
    if (cuentas.error) throw cuentas.error;
    if (productos.error) throw productos.error;
    const ids = cuentas.data.map((c) => c.id);
    let items: CuentaItem[] = [];
    if (ids.length) {
      const r = await supabase.from('cuenta_items').select('*').in('cuenta_id', ids).order('creado_en').order('id').returns<CuentaItem[]>();
      if (r.error) throw r.error;
      items = r.data;
    }
    return { mesa: mesa.data, cuentas: cuentas.data, items, productos: productos.data };
  }, [mesaId]);

  const recargar = useCallback(async () => {
    try {
      const d = await cargar();
      setDatos(d);
      setError(null);
      return d;
    } catch (e) {
      setError(mensajeError(e));
      return null;
    }
  }, [cargar]);

  useEffect(() => {
    let vigente = true;
    cargar().then(
      (d) => vigente && setDatos(d),
      (e) => vigente && setError(mensajeError(e)),
    );
    return () => {
      vigente = false;
    };
  }, [cargar]);
  useTiempoReal(['cuentas', 'cuenta_items', 'productos'], recargar);

  const enviar = useCallback(() => {
    const lote = [...porEnviar.current.entries()];
    porEnviar.current.clear();
    if (!lote.length) return;
    cola.current = cola.current.then(async () => {
      const supabase = crearCliente();
      for (const [clave, cantidad] of lote) {
        const [cuentaId, productoId] = clave.split(':').map(Number);
        const { data, error } = await supabase.rpc('agregar_item', {
          p_cuenta_id: cuentaId,
          p_producto_id: productoId,
          p_cantidad: cantidad,
        });
        if (error) notificar(mensajeError(error), 'error');
        else if ((data as { sin_stock: boolean }).sin_stock) {
          const r = data as { producto: string; stock_restante: number };
          notificar(`${r.producto}: no había stock suficiente (queda ${r.stock_restante}). Se vendió igual; revisa el inventario.`, 'advertencia');
        }
      }
      const d = await cargar().catch(() => null);
      // Datos nuevos y quitar lo ya confirmado, en el mismo render.
      if (d) setDatos(d);
      setOptimista((o) => {
        const n = { ...o };
        for (const [clave, c] of lote) {
          n[clave] = (n[clave] ?? 0) - c;
          if (n[clave] <= 0) delete n[clave];
        }
        return n;
      });
    });
  }, [cargar, notificar]);

  // Al salir de la pantalla se guarda lo que esté pendiente.
  useEffect(
    () => () => {
      clearTimeout(temporizador.current);
      enviar();
    },
    [enviar],
  );

  const cuentas = datos?.cuentas ?? [];
  const cuentaSel = cuentas.find((c) => c.id === seleccion) ?? cuentas[0] ?? null;
  const productosPorId = new Map((datos?.productos ?? []).map((p) => [p.id, p]));

  function agregar(p: Producto) {
    if (!cuentaSel) return;
    const clave = `${cuentaSel.id}:${p.id}`;
    porEnviar.current.set(clave, (porEnviar.current.get(clave) ?? 0) + 1);
    setOptimista((o) => ({ ...o, [clave]: (o[clave] ?? 0) + 1 }));
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(enviar, 350);
  }

  function pendientesDe(cuentaId: number) {
    const m = new Map<number, number>();
    for (const [clave, n] of Object.entries(optimista)) {
      const [c, p] = clave.split(':').map(Number);
      if (c === cuentaId) m.set(p, n);
    }
    return m;
  }

  function elegirCuenta(id: number) {
    clearTimeout(temporizador.current);
    enviar();
    setSeleccion(id);
  }

  // Tras cerrar o anular una cuenta: pasa a la siguiente o vuelve a las mesas.
  async function trasCerrarCuenta() {
    setDialogo(null);
    const d = await recargar();
    if (d && d.cuentas.length === 0) {
      notificar(`${d.mesa?.nombre ?? 'La mesa'} quedó libre.`);
      router.push('/mesas');
    }
  }

  async function accion(a: AccionCuenta) {
    if (!cuentaSel) return;
    if (a === 'cerrar') {
      const { error } = await crearCliente().rpc('cerrar_cuenta', { p_cuenta_id: cuentaSel.id });
      if (error) return notificar(mensajeError(error), 'error');
      notificar(`${cuentaSel.nombre}: cuenta cerrada.`);
      return trasCerrarCuenta();
    }
    setDialogo({ tipo: a, cuenta: cuentaSel });
  }

  if (error && !datos) return <Aviso tipo="error">{error}</Aviso>;
  if (!datos || cargandoTurno) return <p className="text-tenue">Cargando mesa…</p>;
  if (!datos.mesa) return <Aviso tipo="error">Esta mesa no existe.</Aviso>;

  const cuentaDialogo = dialogo && 'cuenta' in dialogo ? cuentas.find((c) => c.id === dialogo.cuenta.id) ?? dialogo.cuenta : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/mesas" className="rounded-xl border border-borde bg-superficie px-4 py-2.5 font-semibold shadow-sm hover:bg-suave">
          ← Mesas
        </Link>
        <h1 className="text-2xl font-black">{datos.mesa.nombre}</h1>
        {cuentas.length ? (
          <span className="text-sm text-tenue">
            {cuentas.length} cuenta{cuentas.length > 1 ? 's' : ''} · saldo {pesos(cuentas.reduce((s, c) => s + c.total - c.pagado, 0))}
          </span>
        ) : null}
      </div>

      {!turno ? (
        <Aviso tipo="advertencia">
          No hay un turno abierto.{' '}
          <Link href="/turno" className="font-bold underline">
            Abre el turno
          </Link>{' '}
          para poder vender.
        </Aviso>
      ) : cuentas.length === 0 ? (
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
          <h2 className="text-xl font-bold">Mesa libre</h2>
          <p className="text-sm text-tenue">Abre la primera cuenta. Si la dejas sin nombre se llamará “Cuenta 1”.</p>
          <FormularioCuenta mesaId={mesaId} enLinea onListo={(c) => { setSeleccion(c.id); void recargar(); }} />
        </div>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Cuentas de la mesa">
            {cuentas.map((c) => {
              const activa = c.id === cuentaSel?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => elegirCuenta(c.id)}
                  className={`flex shrink-0 flex-col items-start rounded-xl border-2 px-4 py-2 text-left ${
                    activa ? 'border-marca bg-marca/15' : 'border-borde bg-superficie hover:bg-suave'
                  }`}
                >
                  <span className="font-bold">{c.nombre}</span>
                  <span className="text-xs text-tenue">{c.total - c.pagado > 0 ? `saldo ${pesos(c.total - c.pagado)}` : c.total > 0 ? 'al día' : 'vacía'}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setDialogo({ tipo: 'nueva' })}
              className="shrink-0 rounded-xl border-2 border-dashed border-borde px-4 py-2 font-bold text-cafe hover:bg-suave"
            >
              + Nueva cuenta
            </button>
          </div>

          {cuentaSel ? (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <aside className="min-w-0 lg:sticky lg:top-20 lg:order-2">
                <DetalleCuenta
                  cuenta={cuentaSel}
                  items={datos.items.filter((i) => i.cuenta_id === cuentaSel.id)}
                  productos={productosPorId}
                  pendientes={pendientesDe(cuentaSel.id)}
                  esAdmin={esAdmin}
                  puedeMover
                  onAccion={accion}
                  onQuitar={(item) => setDialogo({ tipo: 'quitar', item })}
                  onMover={(item) => setDialogo({ tipo: 'mover', item })}
                />
              </aside>
              <div className="min-w-0 lg:order-1">
                <SelectorProductos productos={datos.productos} onElegir={agregar} />
              </div>
            </div>
          ) : null}
        </>
      )}

      <Modal abierto={dialogo !== null} onCerrar={() => setDialogo(null)} titulo={dialogo ? TITULOS[dialogo.tipo] : ''} ancho={dialogo?.tipo === 'dividir' ? 'lg' : 'md'}>
        {dialogo?.tipo === 'nueva' ? (
          <FormularioCuenta
            mesaId={mesaId}
            onListo={(c) => {
              setDialogo(null);
              setSeleccion(c.id);
              void recargar();
            }}
          />
        ) : null}
        {dialogo?.tipo === 'renombrar' && cuentaDialogo ? (
          <FormularioCuenta
            mesaId={mesaId}
            cuenta={cuentaDialogo}
            onListo={() => {
              setDialogo(null);
              void recargar();
            }}
          />
        ) : null}
        {dialogo?.tipo === 'quitar' ? (
          <DialogoQuitarItem
            item={dialogo.item}
            producto={productosPorId.get(dialogo.item.producto_id)}
            onListo={() => {
              setDialogo(null);
              void recargar();
            }}
          />
        ) : null}
        {dialogo?.tipo === 'mover' ? (
          <DialogoMoverItem
            item={dialogo.item}
            producto={productosPorId.get(dialogo.item.producto_id)}
            mesaId={mesaId}
            cuentas={cuentas.filter((c) => c.id !== dialogo.item.cuenta_id)}
            onListo={() => {
              setDialogo(null);
              void recargar();
            }}
          />
        ) : null}
        {(dialogo?.tipo === 'cobrar' || dialogo?.tipo === 'abonar') && cuentaDialogo ? (
          <DialogoPago
            modo={dialogo.tipo}
            cuenta={cuentaDialogo}
            onListo={(cerrada) => {
              if (cerrada) void trasCerrarCuenta();
              else {
                setDialogo(null);
                void recargar();
              }
            }}
          />
        ) : null}
        {dialogo?.tipo === 'dividir' && cuentaDialogo ? (
          <DialogoDividir cuenta={cuentaDialogo} onPago={() => void recargar()} onListo={() => void trasCerrarCuenta()} />
        ) : null}
        {dialogo?.tipo === 'anular' && cuentaDialogo ? (
          <DialogoAnularCuenta cuenta={cuentaDialogo} onListo={() => void trasCerrarCuenta()} />
        ) : null}
      </Modal>
    </section>
  );
}
