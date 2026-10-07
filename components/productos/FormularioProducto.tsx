'use client';

import { useId, useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo, Selector } from '@/components/ui/Campo';
import { CampoPesos } from '@/components/ui/CampoPesos';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { esBase } from '@/lib/inventario';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Producto } from '@/lib/types';

// Orden para un producto nuevo o que cambia de categoría: al final de su
// categoría; si la categoría es nueva, en una centena nueva al final.
function ordenAlFinal(productos: Producto[], categoria: string, excluirId?: number) {
  const otros = productos.filter((p) => p.id !== excluirId);
  const enCategoria = otros.filter((p) => p.categoria === categoria);
  if (enCategoria.length) return Math.max(...enCategoria.map((p) => p.orden)) + 1;
  const maxCentena = Math.max(0, ...otros.map((p) => Math.floor(p.orden / 100)));
  return (maxCentena + 1) * 100 + 1;
}

export function FormularioProducto({
  producto,
  productos,
  onListo,
}: {
  producto: Producto | null; // null = nuevo
  productos: Producto[];
  onListo: () => void;
}) {
  const notificar = useNotificar();
  const idCategorias = useId();
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [categoria, setCategoria] = useState(producto?.categoria ?? '');
  const [precio, setPrecio] = useState<number | null>(producto?.precio_venta ?? null);
  const [costo, setCosto] = useState<number | null>(producto?.costo ?? null);
  const [stockMinimo, setStockMinimo] = useState(String(producto?.stock_minimo ?? 0));
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [descuenta, setDescuenta] = useState(producto?.descuenta_de != null);
  const [baseId, setBaseId] = useState(producto?.descuenta_de ? String(producto.descuenta_de) : '');
  const [factor, setFactor] = useState(String(producto?.factor_descuento ?? 6));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const categorias = [...new Set(productos.map((p) => p.categoria))];
  const esBaseDeOtros = producto ? productos.some((p) => p.descuenta_de === producto.id) : false;
  const posiblesBases = productos.filter((p) => esBase(p) && p.id !== producto?.id);
  const margen = precio !== null && costo !== null && precio > 0 ? precio - costo : null;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const minimo = Number.parseInt(stockMinimo, 10);
    const fac = Number.parseInt(factor, 10);
    if (!nombre.trim()) return setError('Escribe el nombre del producto.');
    if (!categoria.trim()) return setError('Escribe o elige una categoría.');
    if (precio === null) return setError('Escribe el precio de venta.');
    if (Number.isNaN(minimo) || minimo < 0) return setError('El stock mínimo debe ser 0 o más.');
    if (descuenta && !baseId) return setError('Elige de qué producto descuenta.');
    if (descuenta && (Number.isNaN(fac) || fac < 1)) return setError('Las unidades a descontar deben ser 1 o más.');

    const cat = categoria.trim();
    const datos = {
      nombre: nombre.trim(),
      categoria: cat,
      precio_venta: precio,
      costo,
      stock_minimo: descuenta ? 0 : minimo,
      activo,
      descuenta_de: descuenta ? Number(baseId) : null,
      factor_descuento: descuenta ? fac : 1,
      ...(!producto || producto.categoria !== cat ? { orden: ordenAlFinal(productos, cat, producto?.id) } : {}),
    };

    setGuardando(true);
    const supabase = crearCliente();
    const { error } = producto
      ? await supabase.from('productos').update(datos).eq('id', producto.id)
      : await supabase.from('productos').insert(datos);
    setGuardando(false);

    if (error) return setError(mensajeError(error));
    notificar(producto ? `"${datos.nombre}" actualizado` : `"${datos.nombre}" creado`);
    onListo();
  }

  async function borrar() {
    if (!producto) return;
    if (!confirmarBorrado) return setConfirmarBorrado(true);
    setGuardando(true);
    const { error } = await crearCliente().from('productos').delete().eq('id', producto.id);
    setGuardando(false);
    if (error) {
      setConfirmarBorrado(false);
      return setError(mensajeError(error));
    }
    notificar(`"${producto.nombre}" eliminado`);
    onListo();
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required data-autofocus maxLength={60} />

      <Campo
        etiqueta="Categoría"
        list={idCategorias}
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        required
        maxLength={40}
        ayuda="Elige una existente o escribe una nueva."
      />
      <datalist id={idCategorias}>
        {categorias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-3">
        <CampoPesos etiqueta="Precio de venta" valor={precio} onCambio={setPrecio} required />
        <CampoPesos
          etiqueta="Costo (opcional)"
          valor={costo}
          onCambio={setCosto}
          ayuda={
            margen !== null ? (
              <span className={margen < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                Ganancia {pesos(margen)} ({Math.round((margen / (precio ?? 1)) * 100)}%)
              </span>
            ) : undefined
          }
        />
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-zinc-800 p-3">
        <input
          type="checkbox"
          checked={descuenta}
          onChange={(e) => setDescuenta(e.target.checked)}
          disabled={esBaseDeOtros}
          className="mt-1 size-5 accent-marca"
        />
        <span className="text-sm">
          <span className="font-semibold">No tiene stock propio</span>
          <span className="block text-zinc-400">
            {esBaseDeOtros
              ? 'Otros productos descuentan de este, así que debe tener stock propio.'
              : 'Al venderlo se descuentan unidades de otro producto (ej. Six pack Poker descuenta 6 de Poker).'}
          </span>
        </span>
      </label>

      {descuenta ? (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Selector etiqueta="Descuenta de" value={baseId} onChange={(e) => setBaseId(e.target.value)} required>
            <option value="">Elige un producto…</option>
            {posiblesBases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
          <Campo
            etiqueta="Unidades"
            type="number"
            inputMode="numeric"
            min={1}
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
            className="w-28"
          />
        </div>
      ) : (
        <Campo
          etiqueta="Stock mínimo"
          type="number"
          inputMode="numeric"
          min={0}
          value={stockMinimo}
          onChange={(e) => setStockMinimo(e.target.value)}
          ayuda="Con este stock o menos aparece la alerta de stock bajo."
        />
      )}

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="size-5 accent-marca" />
        <span className="text-sm font-semibold">Activo (se puede vender)</span>
      </label>

      {producto && esBase(producto) ? (
        <p className="text-sm text-zinc-400">
          Stock actual: <strong className="text-zinc-200">{producto.stock_actual}</strong>. El stock se cambia desde
          Inventario (entradas, mermas o ajustes).
        </p>
      ) : null}

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {producto ? (
          <Boton variante={confirmarBorrado ? 'peligro' : 'fantasma'} tamano="md" onClick={borrar} disabled={guardando}>
            {confirmarBorrado ? 'Sí, eliminar definitivamente' : 'Eliminar producto'}
          </Boton>
        ) : (
          <span />
        )}
        <Boton type="submit" cargando={guardando}>
          {producto ? 'Guardar cambios' : 'Crear producto'}
        </Boton>
      </div>
    </form>
  );
}
