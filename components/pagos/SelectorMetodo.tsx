'use client';

import { TEXTO_METODO } from '@/lib/pagos';
import type { MetodoPago } from '@/lib/types';

const METODOS: MetodoPago[] = ['efectivo', 'daviplata', 'bre_b'];

// Tres botones grandes: Efectivo, Daviplata, Bre-B.
export function SelectorMetodo({
  valor,
  onCambio,
  tamano = 'lg',
}: {
  valor: MetodoPago | null;
  onCambio: (m: MetodoPago) => void;
  tamano?: 'md' | 'lg';
}) {
  return (
    <div role="radiogroup" aria-label="Método de pago" className="grid grid-cols-3 gap-2">
      {METODOS.map((m) => {
        const activo = valor === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(m)}
            className={`rounded-xl border-2 font-bold transition-colors ${tamano === 'lg' ? 'h-14 text-base' : 'h-11 text-sm'} ${
              activo ? 'border-marca bg-marca/15 text-cafe' : 'border-borde bg-superficie text-texto hover:bg-suave'
            }`}
          >
            {TEXTO_METODO[m]}
          </button>
        );
      })}
    </div>
  );
}
