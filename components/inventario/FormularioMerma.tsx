'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CampoCantidad } from '@/components/ui/CampoCantidad';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError } from '@/lib/formato';
import { agruparPorCategoria, coincide, esBase } from '@/lib/inventario';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Producto } from '@/lib/types';

const MOTIVOS_RAPIDOS = ['Se rompió', 'Se derramó', 'Vencido', 'Cortesía', 'Consumo del personal'];

export function FormularioMerma({ productos, onListo }: { productos: Producto[]; onListo: () => void }) {
  const notificar = useNotificar();
  const [productoId, setProductoId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState<number | null>(1);
  const [motivo, setMotivo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const elegido = productos.find((p) => p.id === productoId);
  const grupos = agruparPorCategoria(productos.filter((p) => esBase(p) && p.activo && coincide(p, busqueda)));

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!elegido) return setError('Elige el producto.');
    if (!cantidad || cantidad < 1) return setError('La cantidad debe ser 1 o más.');
    if (!motivo.trim()) return setError('Escribe o elige el motivo.');

    setGuardando(true);
    const { error } = await crearCliente().rpc('registrar_movimiento', {
      p_producto_id: elegido.id,
      p_tipo: 'merma',
      p_cantidad: cantidad,
      p_motivo: motivo.trim(),
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    notificar(`Merma registrada: ${cantidad} ${elegido.nombre}`);
    onListo();
  }

  return (
    <form onSubmit={registrar} className="flex flex-col gap-4">
      {elegido ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-marca/40 bg-marca/10 px-4 py-3">
          <div>
            <p className="font-semibold">{elegido.nombre}</p>
            <p className="text-xs text-zinc-400">En sistema: {elegido.stock_actual}</p>
          </div>
          <Boton variante="fantasma" tamano="md" onClick={() => setProductoId(null)}>
            Cambiar
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Campo
            type="search"
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar producto"
            data-autofocus
          />
          <div className="flex flex-col gap-3">
            {grupos.map(({ categoria, items }) => (
              <div key={categoria}>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-marca">{categoria}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProductoId(p.id)}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left text-sm font-semibold hover:border-marca"
                    >
                      {p.nombre}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-300">Cantidad</span>
        <CampoCantidad etiqueta="Cantidad de la merma" valor={cantidad} onCambio={setCantidad} min={1} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotivo(m)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
                motivo === m ? 'bg-marca text-zinc-950 ring-marca' : 'text-zinc-300 ring-zinc-700 hover:bg-zinc-800'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <Campo etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} required />
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <Boton type="submit" variante="peligro" tamano="xl" cargando={guardando} disabled={!elegido}>
        Registrar merma
      </Boton>
    </form>
  );
}
