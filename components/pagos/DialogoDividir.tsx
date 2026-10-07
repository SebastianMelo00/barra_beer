'use client';

import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { TEXTO_METODO, dividirSaldo } from '@/lib/pagos';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Cuenta, MetodoPago } from '@/lib/types';

type Parte = { monto: number; metodo: MetodoPago | null };

// Divide el saldo en N partes iguales (redondeadas a favor de la casa) y cada
// persona paga su parte con el método que quiera. La última parte cierra la cuenta.
export function DialogoDividir({ cuenta, onPago, onListo }: {
  cuenta: Cuenta;
  onPago: () => void;
  onListo: () => void;
}) {
  const notificar = useNotificar();
  const saldoInicial = cuenta.total - cuenta.pagado;
  const [partes, setPartes] = useState<Parte[] | null>(null);
  const [pagando, setPagando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pagadas = partes?.filter((p) => p.metodo).length ?? 0;

  function elegirN(n: number) {
    setError(null);
    setPartes(dividirSaldo(saldoInicial, n).map((monto) => ({ monto, metodo: null })));
  }

  async function pagarParte(i: number, metodo: MetodoPago) {
    if (!partes) return;
    setError(null);
    setPagando(i);
    const { data, error } = await crearCliente().rpc('registrar_pago', {
      p_cuenta_id: cuenta.id,
      p_monto: partes[i].monto,
      p_metodo: metodo,
      p_cerrar: true,
    });
    setPagando(null);
    if (error) return setError(mensajeError(error));

    setPartes(partes.map((p, k) => (k === i ? { ...p, metodo } : p)));
    onPago();
    const resultado = data as { estado: string };
    if (resultado.estado === 'pagada') {
      notificar(`${cuenta.nombre}: cuenta dividida y pagada completa.`);
      onListo();
    } else {
      notificar(`Parte ${i + 1} pagada: ${pesos(partes[i].monto)} en ${TEXTO_METODO[metodo]}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between rounded-xl bg-suave px-4 py-3">
        <span className="text-sm text-tenue">Saldo de {cuenta.nombre}</span>
        <span className="text-2xl font-black">{pesos(saldoInicial)}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">¿Entre cuántas personas?</span>
        <div className="grid grid-cols-7 gap-2">
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              disabled={pagadas > 0 || n * 100 > saldoInicial}
              onClick={() => elegirN(n)}
              className={`h-12 rounded-xl border-2 text-lg font-bold disabled:opacity-40 ${
                partes?.length === n ? 'border-marca bg-marca/15 text-cafe' : 'border-borde bg-superficie hover:bg-suave'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-tenue">Cada parte se redondea a $ 100 hacia arriba; la última ajusta para que dé exacto.</p>
      </div>

      {partes ? (
        <ol className="flex flex-col gap-2">
          {partes.map((p, i) => (
            <li
              key={i}
              className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 ${
                p.metodo ? 'border-emerald-200 bg-emerald-50' : 'border-borde bg-superficie'
              }`}
            >
              <span className="w-16 text-sm text-tenue">Parte {i + 1}</span>
              <span className="flex-1 text-xl font-bold">{pesos(p.monto)}</span>
              {p.metodo ? (
                <span className="font-semibold text-emerald-800">✓ Pagada · {TEXTO_METODO[p.metodo]}</span>
              ) : (
                <div className="flex gap-1.5">
                  {(['efectivo', 'daviplata', 'bre_b'] as MetodoPago[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={pagando !== null}
                      onClick={() => pagarParte(i, m)}
                      className="h-11 rounded-lg border border-borde bg-superficie px-3 text-sm font-semibold hover:border-marca hover:bg-marca/10 disabled:opacity-50"
                    >
                      {pagando === i ? '…' : TEXTO_METODO[m]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : null}

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
