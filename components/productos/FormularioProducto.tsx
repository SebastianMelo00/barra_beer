'use client';

import { useId, useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo, Selector } from '@/components/ui/Campo';
import { CampoPesos } from '@/components/ui/CampoPesos';
import { ImagenProducto } from '@/components/ui/ImagenProducto';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { IMAGENES_PRODUCTOS } from '@/lib/imagenes';
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
  const [imagen, setImagen] = useState<string | null>(producto?.imagen ?? null);
  const [eligiendoImagen, setEligiendoImagen] = useState(false);
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
      imagen,
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
      <div className="flex items-start gap-3">
        <ImagenProducto producto={{ nombre: nombre || '?', imagen }} tamano={72} />
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-texto">Imagen</span>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" tamano="md" onClick={() => setEligiendoImagen((v) => !v)}>
              {eligiendoImagen ? 'Cerrar' : imagen ? 'Cambiar imagen' : 'Elegir imagen'}
            </Boton>
            {imagen ? (
              <Boton variante="fantasma" tamano="md" onClick={() => setImagen(null)}>
                Quitar
              </Boton>
            ) : null}
          </div>
        </div>
      </div>
      {eligiendoImagen ? (
        <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-borde bg-suave p-2 sm:grid-cols-6">
          {IMAGENES_PRODUCTOS.map((img) => (
            <button
              key={img.ruta}
              type="button"
              title={img.nombre}
              onClick={() => {
                setImagen(img.ruta);
                setEligiendoImagen(false);
              }}
              className={`grid place-items-center rounded-lg p-1 ${imagen === img.ruta ? 'bg-marca/30 ring-2 ring-marca' : 'hover:bg-suave-2'}`}
            >
              <ImagenProducto producto={{ nombre: img.nombre, imagen: img.ruta }} tamano={56} />
            </button>
          ))}
        </div>
      ) : null}

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
              <span className={margen < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                Ganancia {pesos(margen)} ({Math.round((margen / (precio ?? 1)) * 100)}%)
              </span>
            ) : undefined
          }
        />
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-borde p-3">
        <input
          type="checkbox"
          checked={descuenta}
          onChange={(e) => setDescuenta(e.target.checked)}
          disabled={esBaseDeOtros}
          className="mt-1 size-5 accent-marca"
        />
        <span className="text-sm">
          <span className="font-semibold">No tiene stock propio</span>
          <span className="block text-tenue">
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
        <p className="text-sm text-tenue">
          Stock actual: <strong className="text-texto">{producto.stock_actual}</strong>. El stock se cambia desde
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
