'use client';

import { useState, type KeyboardEvent } from 'react';
import { ImagenProducto } from '@/components/ui/ImagenProducto';
import { pesos } from '@/lib/formato';
import { agruparPorCategoria, coincide, unidadesDerivado } from '@/lib/inventario';
import type { Producto } from '@/lib/types';

// Botones grandes con foto: un clic agrega una unidad, varios clics suman.
// En el buscador, Enter agrega el primer resultado.
export function SelectorProductos({
  productos,
  onElegir,
  enCarrito = {},
  columnas = 'normal',
}: {
  productos: Producto[];
  onElegir: (p: Producto) => void;
  enCarrito?: Record<number, number>; // cantidades ya elegidas, para mostrarlas sobre el botón
  columnas?: 'normal' | 'compacta';
}) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);

  const porId = new Map(productos.map((p) => [p.id, p]));
  const activos = productos.filter((p) => p.activo);
  const categorias = agruparPorCategoria(activos).map((g) => g.categoria);
  const visibles = activos.filter((p) => coincide(p, busqueda) && (busqueda || !categoria || p.categoria === categoria));
  const grupos = agruparPorCategoria(visibles);

  function disponible(p: Producto) {
    if (p.descuenta_de === null) return p.stock_actual;
    return unidadesDerivado(p, porId.get(p.descuenta_de));
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const primero = grupos[0]?.items[0];
      if (primero) {
        onElegir(primero);
        setBusqueda('');
      }
    }
    if (e.key === 'Escape') setBusqueda('');
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        onKeyDown={alTeclear}
        placeholder="Buscar producto… (Enter agrega el primero)"
        aria-label="Buscar producto"
        className="h-12 w-full rounded-xl border border-borde bg-superficie px-4 text-base placeholder:text-tenue/70 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {[null, ...categorias].map((c) => (
          <button
            key={c ?? 'todas'}
            type="button"
            onClick={() => setCategoria(c)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset ${
              categoria === c && !busqueda ? 'bg-marca text-texto ring-marca' : 'bg-superficie text-texto ring-borde hover:bg-suave'
            }`}
          >
            {c ?? 'Todas'}
          </button>
        ))}
      </div>

      {grupos.length === 0 ? <p className="py-6 text-center text-tenue">No hay productos que coincidan.</p> : null}

      {grupos.map(({ categoria: cat, items }) => (
        <section key={cat} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cafe">{cat}</h3>
          <div
            className={`grid gap-2 ${
              columnas === 'compacta' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 xl:grid-cols-5'
            }`}
          >
            {items.map((p) => {
              const stock = disponible(p);
              const cantidad = enCarrito[p.id] ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onElegir(p)}
                  className="relative flex flex-col items-center gap-1 rounded-2xl border border-borde bg-superficie p-2 pb-2.5 text-center shadow-sm transition active:scale-[0.97] hover:border-marca hover:shadow"
                >
                  <ImagenProducto producto={p} tamano={64} className="ring-0" />
                  <span className="line-clamp-2 min-h-[2.5em] text-sm font-semibold leading-tight">{p.nombre}</span>
                  <span className="text-sm font-bold text-cafe">{pesos(p.precio_venta)}</span>
                  {stock <= 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      SIN STOCK
                    </span>
                  ) : null}
                  {cantidad > 0 ? (
                    <span className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-marca text-sm font-black text-texto shadow">
                      {cantidad}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
