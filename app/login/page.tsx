import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import { FormularioLogin } from '@/components/ui/FormularioLogin';
import logo from '@/public/logo_barrabeer.jpeg';

export const metadata: Metadata = { title: 'Ingresar · La Barra Beer' };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Image
          src={logo}
          alt="La Barra Beer — Familia y amigos"
          priority
          placeholder="blur"
          sizes="224px"
          className="mx-auto mb-6 size-56 rounded-3xl shadow-2xl shadow-marca/10 ring-1 ring-borde"
        />
        <h1 className="sr-only">La Barra Beer</h1>
        <Suspense>
          <FormularioLogin />
        </Suspense>
      </div>
    </main>
  );
}
