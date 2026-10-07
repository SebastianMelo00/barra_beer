import type { ReactNode } from 'react';

export type ColorInsignia = 'verde' | 'amarillo' | 'rojo' | 'gris' | 'marca' | 'azul';

const COLORES: Record<ColorInsignia, string> = {
  verde: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  amarillo: 'bg-amber-400/15 text-amber-200 ring-amber-400/30',
  rojo: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  gris: 'bg-zinc-800 text-zinc-300 ring-zinc-700',
  marca: 'bg-marca/15 text-marca ring-marca/30',
  azul: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
};

export function Insignia({ color = 'gris', children }: { color?: ColorInsignia; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COLORES[color]}`}>
      {children}
    </span>
  );
}
