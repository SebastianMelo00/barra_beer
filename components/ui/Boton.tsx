import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'exito' | 'fantasma';
type Tamano = 'md' | 'lg' | 'xl';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca text-texto shadow-sm hover:bg-marca-claro active:bg-marca-oscuro',
  secundario: 'border border-borde bg-superficie text-texto shadow-sm hover:bg-suave active:bg-suave-2',
  peligro: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:bg-rose-700',
  exito: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700',
  fantasma: 'bg-transparent text-tenue hover:bg-suave hover:text-texto active:bg-suave-2',
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
      className={`inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-oscuro disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
    >
      {cargando ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}
