import type { ReactNode } from 'react';

export function EnConstruccion({ titulo, fase, children }: { titulo: string; fase: number; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <div className="rounded-2xl border border-dashed border-borde p-6 text-tenue">
        Esta pantalla se construye en la <strong className="text-texto">Fase {fase}</strong>.
      </div>
      {children}
    </section>
  );
}
