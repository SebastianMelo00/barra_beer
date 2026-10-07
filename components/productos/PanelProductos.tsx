'use client';

import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { ImagenProducto } from '@/components/ui/ImagenProducto';
import { Insignia } from '@/components/ui/Insignia';
import { Modal } from '@/components/ui/Modal';
import { useNotificar } from '@/components/ui/Notificaciones';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { mensajeError, pesos } from '@/lib/formato';
import { agruparPorCategoria, coincide } from '@/lib/inventario';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Producto } from '@/lib/types';
import { FormularioProducto } from './FormularioProducto';

async function cargarProductos() {
  const { data, error } = await crearCliente().from('productos').select('*').order('orden').returns<Producto[]>();
  if (error) throw error;
  return data;
}

export function PanelProductos() {
  const notificar = useNotificar();
  const { datos, error, recargar } = useCarga(cargarProductos);
  useTiempoReal(['productos'], recargar);

  const [busqueda, setBusqueda] = useState('');
  const [verInactivos, setVerInactivos] = useState(true);
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const productos = datos ?? [];
  const porId = new Map(productos.map((p) => [p.id, p]));
  const visibles = productos.filter((p) => (verInactivos || p.activo) && coincide(p, busqueda));
  const grupos = agruparPorCategoria(visibles);
  const inactivos = productos.filter((p) => !p.activo).length;

  async function alternarActivo(p: Producto) {
    const { error } = await crearCliente().from('productos').update({ activo: !p.activo }).eq('id', p.id);
    if (error) return notificar(mensajeError(error), 'error');
    notificar(p.activo ? `"${p.nombre}" desactivado: ya no aparece para vender` : `"${p.nombre}" activado`);
    void recargar();
  }

  // Sube o baja un producto dentro de su categoría y renumera la categoría.
  async function mover(p: Producto, direccion: -1 | 1) {
    const lista = agruparPorCategoria(productos.filter((x) => x.categoria === p.categoria))[0]?.items ?? [];
    const i = lista.findIndex((x) => x.id === p.id);
    const j = i + direccion;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];

    const base = Math.floor(Math.min(...lista.map((x) => x.orden)) / 100) * 100;
    const cambios = lista
      .map((x, k) => ({ id: x.id, orden: base + k + 1, antes: x.orden }))
      .filter((c) => c.orden !== c.antes);

    setOcupado(true);
    const supabase = crearCliente();
    const resultados = await Promise.all(
      cambios.map((c) => supabase.from('productos').update({ orden: c.orden }).eq('id', c.id)),
    );
    setOcupado(false);
    const fallo = resultados.find((r) => r.error);
    if (fallo) notificar(mensajeError(fallo.error), 'error');
    void recargar();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-tenue">
            {productos.length} productos{inactivos ? ` · ${inactivos} inactivos` : ''}. Los precios nuevos aplican a lo
            que se agregue desde ahora.
          </p>
        </div>
        <Boton onClick={() => setEditando('nuevo')}>+ Nuevo producto</Boton>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Campo
          etiqueta="Buscar"
          placeholder="Nombre o categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="min-w-56 flex-1"
          type="search"
        />
        <label className="flex h-12 items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            checked={verInactivos}
            onChange={(e) => setVerInactivos(e.target.checked)}
            className="size-5 accent-marca"
          />
          Mostrar inactivos
        </label>
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {!datos && !error ? <p className="text-tenue">Cargando productos…</p> : null}
      {datos && grupos.length === 0 ? <p className="text-tenue">No hay productos que coincidan.</p> : null}

      {grupos.map(({ categoria, items }) => (
        <div key={categoria} className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-cafe">{categoria}</h2>
          <ul className="flex flex-col divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
            {items.map((p, i) => {
              const base = p.descuenta_de ? porId.get(p.descuenta_de) : undefined;
              const margen = p.costo !== null && p.precio_venta > 0 ? p.precio_venta - p.costo : null;
              return (
                <li key={p.id} className={`flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 ${p.activo ? '' : 'opacity-60'}`}>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`Subir ${p.nombre}`}
                      disabled={i === 0 || ocupado || !!busqueda}
                      onClick={() => mover(p, -1)}
                      className="grid h-6 w-8 place-items-center rounded text-tenue hover:bg-suave hover:text-texto disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`Bajar ${p.nombre}`}
                      disabled={i === items.length - 1 || ocupado || !!busqueda}
                      onClick={() => mover(p, 1)}
                      className="grid h-6 w-8 place-items-center rounded text-tenue hover:bg-suave hover:text-texto disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditando(p)}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-lg px-1 py-1 text-left hover:bg-suave sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <ImagenProducto producto={p} tamano={44} />
                      <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.nombre}</span>
                      <span className="flex flex-wrap gap-1.5 pt-0.5 text-xs text-tenue">
                        {base ? (
                          <Insignia color="azul">
                            descuenta {p.factor_descuento} de {base.nombre}
                          </Insignia>
                        ) : (
                          <span>mín. {p.stock_minimo}</span>
                        )}
                        {!p.activo ? <Insignia color="gris">inactivo</Insignia> : null}
                      </span>
                      </span>
                    </span>
                    <span className="flex items-baseline gap-3 sm:flex-col sm:items-end sm:gap-0">
                      <span className="text-lg font-bold tabular-nums">{pesos(p.precio_venta)}</span>
                      {margen !== null ? (
                        <span className={`text-xs tabular-nums ${margen < 0 ? 'text-rose-600' : 'text-tenue'}`}>
                          costo {pesos(p.costo)} · gana {Math.round((margen / p.precio_venta) * 100)}%
                        </span>
                      ) : null}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.activo}
                    aria-label={`${p.activo ? 'Desactivar' : 'Activar'} ${p.nombre}`}
                    onClick={() => alternarActivo(p)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${p.activo ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                  >
                    <span
                      className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${p.activo ? 'left-6' : 'left-1'}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <Modal
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
        titulo={editando === 'nuevo' ? 'Nuevo producto' : `Editar ${editando?.nombre ?? ''}`}
      >
        {editando !== null ? (
          <FormularioProducto
            key={editando === 'nuevo' ? 'nuevo' : editando.id}
            producto={editando === 'nuevo' ? null : editando}
            productos={productos}
            onListo={() => {
              setEditando(null);
              void recargar();
            }}
          />
        ) : null}
      </Modal>
    </section>
  );
}
