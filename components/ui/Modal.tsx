'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Ventana modal con <dialog> nativo: Escape y clic afuera la cierran.
export function Modal({
  abierto,
  onCerrar,
  titulo,
  ancho = 'md',
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  ancho?: 'md' | 'lg' | 'xl';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) {
      dialogo.showModal();
      // autoFocus de React corre antes de abrir el <dialog>: se enfoca aquí.
      dialogo.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  const anchos = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar();
      }}
      className={`m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] ${anchos[ancho]} overflow-hidden rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm`}
    >
      {abierto ? (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-borde px-5 py-4">
            <h2 className="text-lg font-bold">{titulo}</h2>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="grid size-9 place-items-center rounded-lg text-2xl leading-none text-tenue hover:bg-suave hover:text-texto"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
