import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const CLASE_CONTROL =
  'h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30 disabled:opacity-60';

function Envoltura({ id, etiqueta, ayuda, className, children }: {
  id: string;
  etiqueta?: string;
  ayuda?: ReactNode;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {etiqueta ? (
        <label htmlFor={id} className="text-sm font-medium text-zinc-300">
          {etiqueta}
        </label>
      ) : null}
      {children}
      {ayuda ? <p className="text-xs text-zinc-400">{ayuda}</p> : null}
    </div>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  prefijo,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta?: string; ayuda?: ReactNode; prefijo?: string }) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} className={className}>
      <div className="relative">
        {prefijo ? (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-400">{prefijo}</span>
        ) : null}
        <input id={id} {...props} className={`${CLASE_CONTROL} ${prefijo ? 'pl-9' : ''}`} />
      </div>
    </Envoltura>
  );
}

export function Selector({
  etiqueta,
  ayuda,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta?: string; ayuda?: ReactNode }) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} className={className}>
      <select id={id} {...props} className={CLASE_CONTROL}>
        {children}
      </select>
    </Envoltura>
  );
}
