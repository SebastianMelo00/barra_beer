import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-black text-marca">404</p>
      <h1 className="text-xl font-bold">Esta página no existe</h1>
      <Link href="/" className="rounded-xl bg-marca px-5 py-3 font-semibold text-texto shadow-sm hover:bg-marca-claro">
        Volver al inicio
      </Link>
    </main>
  );
}
