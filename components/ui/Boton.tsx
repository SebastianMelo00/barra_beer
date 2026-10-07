import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'exito' | 'fantasma';
type Tamano = 'md' | 'lg' | 'xl';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-amber-400 text-zinc-950 hover:bg-amber-300 active:bg-amber-500',
  secundario: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-700',
  peligro: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700',
  exito: 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600',
  fantasma: 'bg-transparent text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700',
};

const TAMANOS: Record<Tamano, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
  xl: 'h-16 px-6 text-lg',
};

export function Boton({
  variante = 'primario',
  tamano = 'lg',
  cargando = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || cargando}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
    >
      {cargando ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}
