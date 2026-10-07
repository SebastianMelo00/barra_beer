import type { ReactNode } from 'react';

export type ColorInsignia = 'verde' | 'amarillo' | 'rojo' | 'gris' | 'marca' | 'azul';

const COLORES: Record<ColorInsignia, string> = {
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amarillo: 'bg-amber-50 text-amber-800 ring-amber-200',
  rojo: 'bg-rose-50 text-rose-700 ring-rose-200',
  gris: 'bg-suave text-tenue ring-borde',
  marca: 'bg-marca/15 text-cafe ring-marca/40',
  azul: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export function Insignia({ color = 'gris', children }: { color?: ColorInsignia; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COLORES[color]}`}>
      {children}
    </span>
  );
}
