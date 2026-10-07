'use client';

import { CampoPesos } from '@/components/ui/CampoPesos';
import { pesos } from '@/lib/formato';
import { BILLETES } from '@/lib/pagos';

// Para pagos en efectivo: cuánto entregó el cliente y cuánto hay que devolver.
export function CalculoVueltas({
  total,
  recibido,
  onRecibido,
}: {
  total: number;
  recibido: number | null;
  onRecibido: (v: number | null) => void;
}) {
  const vueltas = recibido !== null ? recibido - total : null;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-suave p-3">
      <div className="flex flex-wrap gap-2">
        {BILLETES.filter((b) => b >= total || b === BILLETES[BILLETES.length - 1]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onRecibido(b)}
            className="rounded-lg border border-borde bg-superficie px-3 py-2 text-sm font-semibold hover:bg-suave-2"
          >
            {pesos(b)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 items-end gap-3">
        <CampoPesos etiqueta="Recibido (opcional)" valor={recibido} onCambio={onRecibido} />
        <div className="pb-2 text-right">
          {vueltas === null ? (
            <span className="text-sm text-tenue">Escribe cuánto entregó para calcular las vueltas.</span>
          ) : vueltas < 0 ? (
            <span className="text-sm font-semibold text-rose-600">Faltan {pesos(-vueltas)}</span>
          ) : (
            <span className="text-lg font-bold">
              Vueltas: <span className="text-emerald-700">{pesos(vueltas)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
