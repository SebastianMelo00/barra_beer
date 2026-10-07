'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CampoCantidad } from '@/components/ui/CampoCantidad';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import type { CuentaItem, Producto } from '@/lib/types';

const MOTIVOS = ['Error al agregar', 'El cliente no lo quiso', 'Cambio por otro producto', 'Producto en mal estado'];

// Quitar unidades de un ítem: devuelve el stock y queda auditado con el motivo.
export function DialogoQuitarItem({
  item,
  producto,
  onListo,
}: {
  item: CuentaItem;
  producto: Producto | undefined;
  onListo: () => void;
}) {
  const notificar = useNotificar();
  const [cantidad, setCantidad] = useState<number | null>(1);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function quitar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Math.min(cantidad ?? 1, item.cantidad);
    if (!motivo.trim()) return setError('Escribe o elige el motivo.');
    setGuardando(true);
    const { error } = await crearCliente().rpc('quitar_item', {
      p_item_id: item.id,
      p_motivo: motivo.trim(),
      p_cantidad: n,
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    notificar(`Se quitó ${n} ${producto?.nombre ?? 'producto'} y volvió al inventario.`);
    onListo();
  }

  return (
    <form onSubmit={quitar} className="flex flex-col gap-4">
      <p>
        <strong>{producto?.nombre}</strong> · {item.cantidad} en la cuenta · {pesos(item.precio_unitario)} c/u
      </p>

      {item.cantidad > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">¿Cuántas quitar?</span>
          <div className="flex items-center gap-2">
            <CampoCantidad etiqueta="Cantidad a quitar" valor={cantidad} onCambio={(v) => setCantidad(v === null ? null : Math.min(v, item.cantidad))} min={1} />
            <Boton variante="secundario" tamano="md" onClick={() => setCantidad(item.cantidad)}>
              Todas
            </Boton>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {MOTIVOS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotivo(m)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
                motivo === m ? 'bg-marca text-texto ring-marca' : 'text-texto ring-borde hover:bg-suave'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <Campo etiqueta="Motivo (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} data-autofocus />
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton type="submit" variante="peligro" tamano="xl" cargando={guardando}>
        Quitar {Math.min(cantidad ?? 1, item.cantidad)} · {pesos(Math.min(cantidad ?? 1, item.cantidad) * item.precio_unitario)}
      </Boton>
    </form>
  );
}
