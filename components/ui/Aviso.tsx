import type { ReactNode } from 'react';

type Tipo = 'error' | 'advertencia' | 'exito' | 'info';

const ESTILOS: Record<Tipo, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  advertencia: 'border-amber-200 bg-amber-50 text-amber-900',
  exito: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-borde bg-superficie text-texto',
};

export function Aviso({ tipo = 'info', children }: { tipo?: Tipo; children: ReactNode }) {
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${ESTILOS[tipo]}`}>
      {children}
    </div>
  );
}
