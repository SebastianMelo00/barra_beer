'use client';

import { Boton } from '@/components/ui/Boton';
import { ImagenProducto } from '@/components/ui/ImagenProducto';
import { pesos, transcurrido } from '@/lib/formato';
import type { Cuenta, CuentaItem, Producto } from '@/lib/types';

export type AccionCuenta = 'cobrar' | 'abonar' | 'dividir' | 'cerrar' | 'anular' | 'renombrar';

type Linea = {
  clave: string;
  item: CuentaItem | null; // null = aún no confirmado por el servidor
  producto: Producto | undefined;
  cantidad: number;
  pendiente: number;
  precio: number;
};

// Ítems, totales y acciones de la cuenta seleccionada. `pendientes` son
// unidades ya tocadas que se están guardando (se muestran al instante).
export function DetalleCuenta({
  cuenta,
  items,
  productos,
  pendientes,
  esAdmin,
  puedeMover,
  onAccion,
  onQuitar,
  onMover,
}: {
  cuenta: Cuenta;
  items: CuentaItem[];
  productos: Map<number, Producto>;
  pendientes: Map<number, number>; // productoId -> unidades sin confirmar
  esAdmin: boolean;
  puedeMover: boolean;
  onAccion: (accion: AccionCuenta) => void;
  onQuitar: (item: CuentaItem) => void;
  onMover: (item: CuentaItem) => void;
}) {
  const lineas: Linea[] = items.map((it) => ({
    clave: `i${it.id}`,
    item: it,
    producto: productos.get(it.producto_id),
    cantidad: it.cantidad,
    pendiente: 0,
    precio: it.precio_unitario,
  }));
  for (const [productoId, n] of pendientes) {
    const p = productos.get(productoId);
    const precio = p?.precio_venta ?? 0;
    const existente = lineas.find((l) => l.item?.producto_id === productoId && l.precio === precio);
    if (existente) existente.pendiente += n;
    else lineas.push({ clave: `p${productoId}`, item: null, producto: p, cantidad: 0, pendiente: n, precio });
  }

  const totalPendiente = lineas.reduce((s, l) => s + l.pendiente * l.precio, 0);
  const total = cuenta.total + totalPendiente;
  const saldo = total - cuenta.pagado;
  const guardando = pendientes.size > 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-borde bg-superficie shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-borde px-4 py-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onAccion('renombrar')}
            className="truncate text-left text-lg font-bold hover:underline"
            title="Cambiar nombre"
          >
            {cuenta.nombre} <span className="text-sm font-normal text-tenue">✎</span>
          </button>
          <p className="text-xs text-tenue">Abierta hace {transcurrido(cuenta.abierta_en)}</p>
        </div>
        {esAdmin ? (
          <Boton variante="fantasma" tamano="md" onClick={() => onAccion('anular')} className="text-rose-600">
            Anular
          </Boton>
        ) : null}
      </div>

      {lineas.length === 0 ? (
        <p className="px-4 py-8 text-center text-tenue">Toca un producto para agregarlo a esta cuenta.</p>
      ) : (
        <ul className="max-h-[45vh] divide-y divide-borde overflow-y-auto">
          {lineas.map((l) => (
            <li key={l.clave} className={`flex items-center gap-2 px-3 py-2 ${l.item ? '' : 'opacity-70'}`}>
              {l.producto ? <ImagenProducto producto={l.producto} tamano={36} /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  <span className="mr-1 font-black text-cafe">{l.cantidad + l.pendiente}×</span>
                  {l.producto?.nombre ?? 'Producto'}
                  {l.item?.sin_stock ? <span className="ml-1 text-xs font-bold text-rose-600">sin stock</span> : null}
                </p>
                <p className="text-xs text-tenue">
                  {pesos(l.precio)} c/u{l.pendiente ? ' · guardando…' : ''}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums">{pesos((l.cantidad + l.pendiente) * l.precio)}</span>
              {l.item ? (
                <div className="flex gap-1">
                  {puedeMover ? (
                    <button
                      type="button"
                      onClick={() => onMover(l.item!)}
                      title="Mover a otra cuenta"
                      aria-label={`Mover ${l.producto?.nombre ?? ''} a otra cuenta`}
                      className="grid size-9 place-items-center rounded-lg text-tenue hover:bg-suave hover:text-texto"
                    >
                      ⇄
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onQuitar(l.item!)}
                    title="Quitar"
                    aria-label={`Quitar ${l.producto?.nombre ?? ''}`}
                    className="grid size-9 place-items-center rounded-lg text-lg font-bold text-rose-600 hover:bg-rose-50"
                  >
                    −
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-3 gap-2 border-t border-borde bg-suave px-4 py-3 text-center">
        <div>
          <dt className="text-xs text-tenue">Total</dt>
          <dd className="text-lg font-bold">{pesos(total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">Pagado</dt>
          <dd className="text-lg font-bold text-emerald-700">{pesos(cuenta.pagado)}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">Saldo</dt>
          <dd className="text-xl font-black text-cafe">{pesos(saldo)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 p-3">
        {saldo > 0 ? (
          <>
            <Boton tamano="xl" onClick={() => onAccion('cobrar')} disabled={guardando}>
              COBRAR {pesos(saldo)}
            </Boton>
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" onClick={() => onAccion('abonar')} disabled={guardando}>
                ABONAR
              </Boton>
              <Boton variante="secundario" onClick={() => onAccion('dividir')} disabled={guardando || saldo < 200}>
                DIVIDIR
              </Boton>
            </div>
          </>
        ) : (
          <Boton variante="exito" tamano="xl" onClick={() => onAccion('cerrar')} disabled={guardando}>
            {total > 0 ? 'Cuenta al día · Cerrar cuenta' : 'Cerrar cuenta vacía'}
          </Boton>
        )}
        {guardando ? <p className="text-center text-xs text-tenue">Guardando productos…</p> : null}
      </div>
    </div>
  );
}
