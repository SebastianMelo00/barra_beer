'use client';

import { useEffect, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo, Selector } from '@/components/ui/Campo';
import { Insignia } from '@/components/ui/Insignia';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { conSigno, fechaHora, finDiaBogota, hora, inicioDiaBogota } from '@/lib/formato';
import { TIPO_MOVIMIENTO } from '@/lib/inventario';
import { crearCliente } from '@/lib/supabase/cliente';
import type { MovimientoInv, Perfil, Producto, TipoMovimiento } from '@/lib/types';

type Fila = MovimientoInv & {
  cuenta: { nombre: string; mesa: { nombre: string } | null } | null;
};

const PAGINA = 50;

// Historial de movimientos de inventario. La admin ve todo y puede filtrar;
// el operador ve solo los del turno abierto (lo limita RLS en la base de datos).
export function Movimientos({
  productos,
  perfiles,
  esAdmin,
  productoId,
  onProductoId,
  version,
}: {
  productos: Producto[];
  perfiles: Perfil[];
  esAdmin: boolean;
  productoId: number | null;
  onProductoId: (id: number | null) => void;
  version: number;
}) {
  const [tipo, setTipo] = useState<TipoMovimiento | ''>('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [limite, setLimite] = useState(PAGINA);

  const { datos, error, recargar } = useCarga(async () => {
    let q = crearCliente()
      .from('movimientos_inv')
      .select('*, cuenta:cuentas(nombre, mesa:mesas(nombre))')
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
      .limit(limite + 1);
    if (productoId) q = q.or(`producto_id.eq.${productoId},stock_producto_id.eq.${productoId}`);
    if (tipo) q = q.eq('tipo', tipo);
    if (desde) q = q.gte('creado_en', inicioDiaBogota(desde));
    if (hasta) q = q.lt('creado_en', finDiaBogota(hasta));
    const { data, error } = await q.returns<Fila[]>();
    if (error) throw error;
    return data;
  });

  useEffect(() => {
    void recargar();
  }, [productoId, tipo, desde, hasta, limite, version, recargar]);

  useTiempoReal(['movimientos_inv'], recargar);

  const nombreProducto = new Map(productos.map((p) => [p.id, p.nombre]));
  const nombreUsuario = new Map(perfiles.map((p) => [p.id, p.nombre]));
  const filas = (datos ?? []).slice(0, limite);
  const hayMas = (datos?.length ?? 0) > limite;
  const conFiltros = productoId !== null || tipo !== '' || desde !== '' || hasta !== '';

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{esAdmin ? 'Historial de movimientos' : 'Movimientos de este turno'}</h2>

      {esAdmin ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
          <Selector
            etiqueta="Producto"
            value={productoId ?? ''}
            onChange={(e) => onProductoId(e.target.value ? Number(e.target.value) : null)}
            className="col-span-2 md:col-span-1"
          >
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento | '')} className="col-span-2 md:col-span-1">
            <option value="">Todos</option>
            {Object.entries(TIPO_MOVIMIENTO).map(([valor, { texto }]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </Selector>
          <Campo etiqueta="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <Campo etiqueta="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <Boton
            variante="fantasma"
            tamano="lg"
            disabled={!conFiltros}
            className="col-span-2 md:col-span-1"
            onClick={() => {
              onProductoId(null);
              setTipo('');
              setDesde('');
              setHasta('');
              setLimite(PAGINA);
            }}
          >
            Quitar filtros
          </Boton>
        </div>
      ) : null}

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {!datos && !error ? <p className="text-tenue">Cargando movimientos…</p> : null}
      {datos && filas.length === 0 ? (
        <p className="rounded-2xl border border-borde p-6 text-center text-tenue">
          {esAdmin ? 'No hay movimientos con estos filtros.' : 'Aún no hay movimientos en este turno.'}
        </p>
      ) : null}

      {filas.length ? (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {filas.map((m) => {
            const derivado = m.stock_producto_id !== m.producto_id;
            const detalle = m.cuenta
              ? m.cuenta.mesa
                ? `${m.cuenta.mesa.nombre} · ${m.cuenta.nombre}`
                : m.cuenta.nombre
              : null;
            return (
              <li key={m.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[9rem_6.5rem_1fr_5rem_6rem]">
                <span className="text-xs text-tenue sm:text-sm">{esAdmin ? fechaHora(m.creado_en) : hora(m.creado_en)}</span>
                <span className="justify-self-end sm:justify-self-start">
                  <Insignia color={TIPO_MOVIMIENTO[m.tipo].color}>{TIPO_MOVIMIENTO[m.tipo].texto}</Insignia>
                </span>
                <span className="min-w-0">
                  <span className="font-semibold">{nombreProducto.get(m.producto_id) ?? `#${m.producto_id}`}</span>
                  {derivado ? (
                    <span className="text-xs text-tenue">
                      {' '}
                      ({conSigno(m.stock_cantidad)} {nombreProducto.get(m.stock_producto_id)})
                    </span>
                  ) : null}
                  {m.sin_stock ? (
                    <span className="ml-2">
                      <Insignia color="rojo">sin stock</Insignia>
                    </span>
                  ) : null}
                  <span className="block truncate text-xs text-tenue">
                    {[nombreUsuario.get(m.usuario_id ?? ''), detalle, m.motivo].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span
                  className={`text-right text-lg font-bold tabular-nums ${m.cantidad > 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                >
                  {conSigno(m.cantidad)}
                </span>
                <span className="text-right text-xs text-tenue sm:text-sm">
                  quedan <strong className="text-texto">{m.stock_resultante}</strong>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {hayMas ? (
        <Boton variante="secundario" onClick={() => setLimite((l) => l + PAGINA)} className="self-center">
          Ver más movimientos
        </Boton>
      ) : null}
    </section>
  );
}
