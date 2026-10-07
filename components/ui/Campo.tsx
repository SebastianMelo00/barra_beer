import { useId, type InputHTMLAttributes } from 'react';

export function Campo({
  etiqueta,
  ayuda,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {etiqueta}
      </label>
      <input
        id={id}
        {...props}
        className="h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      />
      {ayuda ? <p className="text-xs text-zinc-400">{ayuda}</p> : null}
    </div>
  );
}
