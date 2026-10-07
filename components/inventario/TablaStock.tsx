'use client';

import { ImagenProducto } from '@/components/ui/ImagenProducto';
import { Insignia } from '@/components/ui/Insignia';
import { ESTADO_STOCK, agruparPorCategoria, coincide, estadoStock, unidadesDerivado } from '@/lib/inventario';
import type { Producto } from '@/lib/types';

export function TablaStock({
  productos,
  busqueda,
  soloAlertas,
  esAdmin,
  onAjustar,
  onHistorial,
}: {
  productos: Producto[];
  busqueda: string;
  soloAlertas: boolean;
  esAdmin: boolean;
  onAjustar: (p: Producto) => void;
  onHistorial: (p: Producto) => void;
}) {
  const porId = new Map(productos.map((p) => [p.id, p]));

  const visibles = productos.filter((p) => {
    if (!esAdmin && !p.activo) return false;
    if (!coincide(p, busqueda)) return false;
    if (soloAlertas) return p.descuenta_de === null && estadoStock(p.stock_actual, p.stock_minimo) !== 'ok';
    return true;
  });
  const grupos = agruparPorCategoria(visibles);

  if (grupos.length === 0) {
    return <p className="rounded-2xl border border-borde p-6 text-center text-tenue">No hay productos para mostrar.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {grupos.map(({ categoria, items }) => (
        <div key={categoria} className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-cafe">{categoria}</h2>
          <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
            {items.map((p) => {
              const base = p.descuenta_de ? porId.get(p.descuenta_de) : undefined;
              const estado = estadoStock(p.stock_actual, p.stock_minimo);
              return (
                <li key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${p.activo ? '' : 'opacity-60'}`}>
                  <ImagenProducto producto={p} tamano={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {p.nombre}
                      {!p.activo ? <span className="ml-2 text-xs font-normal text-tenue">inactivo</span> : null}
                    </p>
                    {base ? (
                      <p className="text-xs text-tenue">
                        Usa {p.factor_descuento} de {base.nombre} · alcanzan para {unidadesDerivado(p, base)}
                      </p>
                    ) : (
                      <p className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-tenue">
                        <Insignia color={ESTADO_STOCK[estado].color}>{ESTADO_STOCK[estado].texto}</Insignia>
                        mínimo {p.stock_minimo}
                      </p>
                    )}
                  </div>

                  {base ? null : (
                    <span
                      className={`text-right text-2xl font-bold tabular-nums ${
                        estado === 'ok' ? 'text-texto' : estado === 'bajo' ? 'text-amber-600' : 'text-rose-600'
                      }`}
                    >
                      {p.stock_actual}
                    </span>
                  )}

                  {esAdmin ? (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-1">
                      <button
                        type="button"
                        onClick={() => onHistorial(base ?? p)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-texto hover:bg-suave"
                      >
                        Historial
                      </button>
                      {base ? null : (
                        <button
                          type="button"
                          onClick={() => onAjustar(p)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-cafe hover:bg-suave"
                        >
                          Ajustar
                        </button>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
