'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { CampoPesos } from '@/components/ui/CampoPesos';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { TEXTO_METODO } from '@/lib/pagos';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Cuenta, MetodoPago } from '@/lib/types';
import { CalculoVueltas } from './CalculoVueltas';
import { SelectorMetodo } from './SelectorMetodo';

// COBRAR: paga todo el saldo y cierra la cuenta.
// ABONAR: paga una parte; aunque cubra todo el saldo, la cuenta sigue abierta
// (cliente que paga por rondas).
export function DialogoPago({
  modo,
  cuenta,
  onListo,
}: {
  modo: 'cobrar' | 'abonar';
  cuenta: Cuenta;
  onListo: (cerrada: boolean) => void;
}) {
  const notificar = useNotificar();
  const saldo = cuenta.total - cuenta.pagado;
  const [monto, setMonto] = useState<number | null>(modo === 'cobrar' ? saldo : null);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [recibido, setRecibido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const valor = modo === 'cobrar' ? saldo : (monto ?? 0);

  async function pagar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (valor <= 0) return setError('Escribe el monto a abonar.');
    if (valor > saldo) return setError(`El abono no puede ser mayor que el saldo (${pesos(saldo)}).`);

    setGuardando(true);
    const { data, error } = await crearCliente().rpc('registrar_pago', {
      p_cuenta_id: cuenta.id,
      p_monto: valor,
      p_metodo: metodo,
      p_cerrar: modo === 'cobrar',
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));

    const resultado = data as { saldo: number; estado: string };
    notificar(
      resultado.estado === 'pagada'
        ? `${cuenta.nombre}: cobrado ${pesos(valor)} en ${TEXTO_METODO[metodo]}. Cuenta cerrada.`
        : `${cuenta.nombre}: abono de ${pesos(valor)} en ${TEXTO_METODO[metodo]}. Saldo ${pesos(resultado.saldo)}.`,
    );
    onListo(resultado.estado === 'pagada');
  }

  return (
    <form onSubmit={pagar} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between rounded-xl bg-suave px-4 py-3">
        <span className="text-sm text-tenue">Saldo de {cuenta.nombre}</span>
        <span className="text-2xl font-black">{pesos(saldo)}</span>
      </div>

      {modo === 'abonar' ? (
        <div className="flex flex-col gap-2">
          <CampoPesos etiqueta="Monto del abono" valor={monto} onCambio={setMonto} data-autofocus />
          <p className="text-xs text-tenue">
            La cuenta sigue abierta aunque el abono cubra todo el saldo (para clientes que pagan por rondas).
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Método de pago</span>
        <SelectorMetodo valor={metodo} onCambio={setMetodo} />
      </div>

      {metodo === 'efectivo' && valor > 0 ? (
        <CalculoVueltas total={valor} recibido={recibido} onRecibido={setRecibido} />
      ) : null}
      {metodo !== 'efectivo' ? (
        <Aviso tipo="advertencia">Confirma en el celular que llegó la transferencia antes de registrar el pago.</Aviso>
      ) : null}

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <Boton type="submit" tamano="xl" cargando={guardando} disabled={valor <= 0} data-autofocus={modo === 'cobrar' || undefined}>
        {modo === 'cobrar' ? `Cobrar ${pesos(valor)}` : `Abonar ${pesos(valor)}`} · {TEXTO_METODO[metodo]}
      </Boton>
    </form>
  );
}
