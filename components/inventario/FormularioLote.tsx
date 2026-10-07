'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CampoCantidad } from '@/components/ui/CampoCantidad';
import { ImagenProducto } from '@/components/ui/ImagenProducto';
import { useNotificar } from '@/components/ui/Notificaciones';
import { conSigno, mensajeError } from '@/lib/formato';
import { agruparPorCategoria, coincide, esBase } from '@/lib/inventario';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Producto } from '@/lib/types';

// Formulario de varios productos a la vez:
// - "entrada": cuántas unidades llegaron de cada producto (operador y admin).
// - "conteo": cuántas unidades hay realmente (solo admin); se ajusta la diferencia.
export function FormularioLote({
  modo,
  productos,
  soloProductoId,
  onListo,
}: {
  modo: 'entrada' | 'conteo';
  productos: Producto[];
  soloProductoId?: number;
  onListo: () => void;
}) {
  const notificar = useNotificar();
  const [cantidades, setCantidades] = useState<Record<number, number | null>>({});
  const [motivo, setMotivo] = useState(modo === 'conteo' ? 'Conteo físico' : '');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const candidatos = productos.filter((p) => esBase(p) && (soloProductoId ? p.id === soloProductoId : true));
  const grupos = agruparPorCategoria(candidatos.filter((p) => coincide(p, busqueda)));

  const filas = candidatos
    .map((p) => ({ p, n: cantidades[p.id] ?? null }))
    .filter(({ n }) => (modo === 'entrada' ? n !== null && n > 0 : n !== null));
  const totalUnidades = filas.reduce((s, { n }) => s + (n ?? 0), 0);
  const conCambio = modo === 'conteo' ? filas.filter(({ p, n }) => n !== p.stock_actual) : filas;

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (filas.length === 0) {
      return setError(modo === 'entrada' ? 'Escribe la cantidad que llegó de al menos un producto.' : 'Escribe el conteo de al menos un producto.');
    }
    if (modo === 'conteo' && !motivo.trim()) return setError('Escribe el motivo del ajuste.');

    setGuardando(true);
    const supabase = crearCliente();
    const { error } =
      modo === 'entrada'
        ? await supabase.rpc('registrar_entrada_lote', {
            p_items: filas.map(({ p, n }) => ({ producto_id: p.id, cantidad: n })),
            p_motivo: motivo,
          })
        : await supabase.rpc('ajustar_stock_lote', {
            p_items: filas.map(({ p, n }) => ({ producto_id: p.id, stock_real: n })),
            p_motivo: motivo,
          });
    setGuardando(false);

    if (error) return setError(mensajeError(error));
    notificar(
      modo === 'entrada'
        ? `Entrada registrada: ${totalUnidades} unidades de ${filas.length} producto(s)`
        : conCambio.length
          ? `Stock ajustado en ${conCambio.length} producto(s)`
          : 'El conteo coincide con el sistema: no hubo ajustes',
    );
    onListo();
  }

  return (
    <form onSubmit={registrar} className="flex flex-col gap-4">
      <Campo
        etiqueta={modo === 'entrada' ? 'Proveedor o nota (opcional)' : 'Motivo'}
        placeholder={modo === 'entrada' ? 'Ej. Pedido Bavaria' : 'Ej. Conteo físico del lunes'}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={120}
      />

      {soloProductoId ? null : (
        <Campo
          type="search"
          placeholder="Buscar producto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar producto"
          data-autofocus
        />
      )}

      <div className="flex flex-col gap-3">
        {grupos.map(({ categoria, items }) => (
          <div key={categoria}>
            {soloProductoId ? null : (
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-cafe">{categoria}</h3>
            )}
            <ul className="divide-y divide-borde rounded-xl border border-borde">
              {items.map((p) => {
                const n = cantidades[p.id] ?? null;
                const diferencia = modo === 'conteo' && n !== null ? n - p.stock_actual : null;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                    <ImagenProducto producto={p} tamano={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.nombre}</p>
                      <p className="text-xs text-tenue">
                        En sistema: {p.stock_actual}
                        {modo === 'entrada' && n ? <span className="text-emerald-700"> → quedará en {p.stock_actual + n}</span> : null}
                        {diferencia !== null && diferencia !== 0 ? (
                          <span className={diferencia > 0 ? 'text-emerald-700' : 'text-rose-600'}> · ajuste {conSigno(diferencia)}</span>
                        ) : null}
                        {diferencia === 0 ? <span className="text-tenue"> · coincide</span> : null}
                      </p>
                    </div>
                    <CampoCantidad
                      etiqueta={modo === 'entrada' ? `Unidades que llegaron de ${p.nombre}` : `Unidades contadas de ${p.nombre}`}
                      valor={n}
                      onCambio={(v) => setCantidades((c) => ({ ...c, [p.id]: v }))}
                      placeholder={modo === 'conteo' ? '—' : '0'}
                      enfocar={!!soloProductoId}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <div className="sticky -bottom-4 -mx-5 -mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-borde bg-superficie px-5 py-3">
        <p className="text-sm text-texto">
          {modo === 'entrada'
            ? `${filas.length} producto(s) · ${totalUnidades} unidades`
            : `${filas.length} contado(s) · ${conCambio.length} con diferencia`}
        </p>
        <Boton type="submit" cargando={guardando} disabled={filas.length === 0}>
          {modo === 'entrada' ? 'Registrar entrada' : 'Guardar conteo'}
        </Boton>
      </div>
    </form>
  );
}
