'use client';

import { useState } from 'react';
import { SelectorProductos } from '@/components/cuentas/SelectorProductos';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { ImagenProducto } from '@/components/ui/ImagenProducto';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { TEXTO_METODO } from '@/lib/pagos';
import { crearCliente } from '@/lib/supabase/cliente';
import type { MetodoPago, Producto } from '@/lib/types';
import { CalculoVueltas } from './CalculoVueltas';
import { SelectorMetodo } from './SelectorMetodo';

// Venta sin mesa: elegir productos, método de pago y cobrar en un paso.
export function VentaRapida({ productos, onListo }: { productos: Producto[]; onListo: () => void }) {
  const notificar = useNotificar();
  const [carrito, setCarrito] = useState<Record<number, number>>({});
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [recibido, setRecibido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const porId = new Map(productos.map((p) => [p.id, p]));
  const lineas = Object.entries(carrito)
    .map(([id, n]) => ({ producto: porId.get(Number(id))!, cantidad: n }))
    .filter((l) => l.producto && l.cantidad > 0);
  const total = lineas.reduce((s, l) => s + l.cantidad * l.producto.precio_venta, 0);

  const cambiar = (id: number, delta: number) =>
    setCarrito((c) => {
      const n = (c[id] ?? 0) + delta;
      const copia = { ...c };
      if (n <= 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });

  async function cobrar() {
    setError(null);
    if (!lineas.length) return setError('Agrega al menos un producto.');
    setGuardando(true);
    const { data, error } = await crearCliente().rpc('venta_rapida', {
      p_items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
      p_metodo: metodo,
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    const r = data as { total: number; sin_stock: string[] };
    notificar(`Venta rápida cobrada: ${pesos(r.total)} en ${TEXTO_METODO[metodo]}.`);
    if (r.sin_stock?.length) {
      notificar(`Sin stock suficiente: ${r.sin_stock.join(', ')}. Se vendió igual; revisa el inventario.`, 'advertencia');
    }
    onListo();
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="max-h-[70dvh] min-w-0 overflow-y-auto pr-1">
        <SelectorProductos productos={productos} onElegir={(p) => cambiar(p.id, 1)} enCarrito={carrito} columnas="compacta" enfocarBuscador />
      </div>

      <div className="flex min-w-0 flex-col gap-3 md:sticky md:top-0">
        <h3 className="font-bold">Productos</h3>
        {lineas.length === 0 ? (
          <p className="rounded-xl bg-suave p-4 text-center text-sm text-tenue">Toca los productos que pidió el cliente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde rounded-xl border border-borde">
            {lineas.map(({ producto, cantidad }) => (
              <li key={producto.id} className="flex items-center gap-2 px-2 py-1.5">
                <ImagenProducto producto={producto} tamano={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{producto.nombre}</span>
                <button type="button" onClick={() => cambiar(producto.id, -1)} aria-label={`Quitar uno de ${producto.nombre}`} className="grid size-8 place-items-center rounded-lg bg-suave font-bold hover:bg-suave-2">
                  −
                </button>
                <span className="w-6 text-center font-bold">{cantidad}</span>
                <button type="button" onClick={() => cambiar(producto.id, 1)} aria-label={`Sumar uno de ${producto.nombre}`} className="grid size-8 place-items-center rounded-lg bg-suave font-bold hover:bg-suave-2">
                  +
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-baseline justify-between rounded-xl bg-suave px-4 py-3">
          <span className="text-sm text-tenue">Total</span>
          <span className="text-2xl font-black">{pesos(total)}</span>
        </div>
        <SelectorMetodo valor={metodo} onCambio={setMetodo} tamano="md" />
        {metodo === 'efectivo' && total > 0 ? <CalculoVueltas total={total} recibido={recibido} onRecibido={setRecibido} /> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        <Boton tamano="xl" onClick={cobrar} cargando={guardando} disabled={!lineas.length}>
          Cobrar {pesos(total)}
        </Boton>
      </div>
    </div>
  );
}
