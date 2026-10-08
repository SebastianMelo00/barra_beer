'use client';

// Si algo falla al mostrar una pantalla, se ofrece reintentar en vez de una
// página en blanco. Los datos no se pierden: todo queda guardado en Supabase.
export default function ErrorPantalla({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">Algo salió mal al mostrar esta pantalla</h1>
      <p className="max-w-md text-sm text-tenue">
        Revisa la conexión a internet e intenta de nuevo. Lo que ya se registró está guardado.
      </p>
      {error.digest ? <p className="text-xs text-tenue">Código: {error.digest}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-marca px-5 py-3 font-semibold text-texto shadow-sm hover:bg-marca-claro"
      >
        Reintentar
      </button>
    </main>
  );
}
