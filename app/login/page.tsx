import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioLogin } from '@/components/ui/FormularioLogin';

export const metadata: Metadata = { title: 'Ingresar · La Barra Beer' };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-3xl font-black tracking-tight text-amber-400">La Barra Beer</h1>
        <p className="mb-8 text-center text-sm text-zinc-400">Mesas, ventas e inventario</p>
        <Suspense>
          <FormularioLogin />
        </Suspense>
      </div>
    </main>
  );
}
