'use client';

// Cantidad entera con botones − / + grandes (rápido con mouse o dedo).
// valor null = campo vacío.
export function CampoCantidad({
  valor,
  onCambio,
  min = 0,
  etiqueta,
  placeholder = '0',
  enfocar = false,
}: {
  valor: number | null;
  onCambio: (valor: number | null) => void;
  min?: number;
  etiqueta: string;
  placeholder?: string;
  enfocar?: boolean; // recibe el foco al abrir la ventana modal
}) {
  const actual = valor ?? 0;
  const cambiar = (n: number) => onCambio(Math.max(min, n));

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onCambio(valor === null ? null : Math.max(min, valor - 1))}
        aria-label={`Restar uno a ${etiqueta}`}
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-xl font-bold hover:bg-zinc-700 active:bg-zinc-600"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        aria-label={etiqueta}
        placeholder={placeholder}
        data-autofocus={enfocar || undefined}
        value={valor ?? ''}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onCambio(Number.isNaN(n) ? null : Math.max(min, n));
        }}
        onFocus={(e) => e.target.select()}
        className="h-10 w-16 rounded-lg border border-zinc-700 bg-zinc-900 text-center text-base font-semibold text-zinc-100 placeholder:text-zinc-600 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
      />
      <button
        type="button"
        onClick={() => cambiar(actual + 1)}
        aria-label={`Sumar uno a ${etiqueta}`}
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-xl font-bold hover:bg-zinc-700 active:bg-zinc-600"
      >
        +
      </button>
    </div>
  );
}
