'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { leerPesos, pesos } from '@/lib/formato';
import { Campo } from './Campo';

// Campo de dinero: muestra "4.000" mientras se escribe y entrega un número entero.
export function CampoPesos({
  valor,
  onCambio,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  etiqueta?: string;
  ayuda?: ReactNode;
  valor: number | null;
  onCambio: (valor: number | null) => void;
}) {
  return (
    <Campo
      {...props}
      prefijo="$"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={valor === null ? '' : pesos(valor).replace('$ ', '')}
      onChange={(e) => onCambio(leerPesos(e.target.value))}
    />
  );
}
