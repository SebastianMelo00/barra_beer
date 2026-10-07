'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Cuenta } from '@/lib/types';

// Solo admin. Anula una cuenta abierta con motivo.
export function DialogoAnularCuenta({ cuenta, onListo }: { cuenta: Cuenta; onListo: () => void }) {
  const notificar = useNotificar();
  const [motivo, setMotivo] = useState('');
  const [devolverStock, setDevolverStock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function anular(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!motivo.trim()) return setError('Escribe el motivo de la anulación.');
    setGuardando(true);
    const { error } = await crearCliente().rpc('anular_cuenta', {
      p_cuenta_id: cuenta.id,
      p_motivo: motivo.trim(),
      p_devolver_stock: devolverStock,
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    notificar(`Cuenta "${cuenta.nombre}" anulada.`);
    onListo();
  }

  return (
    <form onSubmit={anular} className="flex flex-col gap-4">
      <p>
        Vas a anular <strong>{cuenta.nombre}</strong> (total {pesos(cuenta.total)}).
      </p>
      <Campo etiqueta="Motivo (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={160} data-autofocus />
      <label className="flex items-start gap-3 rounded-xl border border-borde p-3">
        <input type="checkbox" checked={devolverStock} onChange={(e) => setDevolverStock(e.target.checked)} className="mt-1 size-5 accent-marca" />
        <span className="text-sm">
          <span className="font-semibold">Devolver los productos al inventario</span>
          <span className="block text-tenue">
            Desmárcalo si los productos sí se consumieron (por ejemplo, el cliente se fue sin pagar).
          </span>
        </span>
      </label>
      {cuenta.pagado > 0 ? (
        <Aviso tipo="advertencia">
          Esta cuenta ya tiene pagos por {pesos(cuenta.pagado)}. Ese dinero sigue contando en la caja del turno.
        </Aviso>
      ) : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton type="submit" variante="peligro" tamano="xl" cargando={guardando}>
        Anular cuenta
      </Boton>
    </form>
  );
}
