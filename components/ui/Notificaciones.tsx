'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tipo = 'exito' | 'error' | 'advertencia';
type Notificacion = { id: number; texto: string; tipo: Tipo };

const NotificarContext = createContext<(texto: string, tipo?: Tipo) => void>(() => {});

const ESTILOS: Record<Tipo, string> = {
  exito: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
  advertencia: 'bg-amber-400 text-texto',
};

let siguienteId = 1;

// Mensajes cortos que aparecen abajo y se van solos.
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Notificacion[]>([]);

  const notificar = useCallback((texto: string, tipo: Tipo = 'exito') => {
    const id = siguienteId++;
    setLista((l) => [...l.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setLista((l) => l.filter((n) => n.id !== id)), tipo === 'exito' ? 2500 : 5000);
  }, []);

  return (
    <NotificarContext value={notificar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {lista.map((n) => (
          <div
            key={n.id}
            role={n.tipo === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${ESTILOS[n.tipo]}`}
          >
            {n.texto}
          </div>
        ))}
      </div>
    </NotificarContext>
  );
}

export function useNotificar() {
  return useContext(NotificarContext);
}
