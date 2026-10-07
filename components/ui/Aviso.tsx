import type { ReactNode } from 'react';

type Tipo = 'error' | 'advertencia' | 'exito' | 'info';

const ESTILOS: Record<Tipo, string> = {
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  advertencia: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  exito: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  info: 'border-zinc-700 bg-zinc-900 text-zinc-300',
};

export function Aviso({ tipo = 'info', children }: { tipo?: Tipo; children: ReactNode }) {
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${ESTILOS[tipo]}`}>
      {children}
    </div>
  );
}
