'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { CampoPesos } from '@/components/ui/CampoPesos';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import { useTurno } from '@/lib/turno';

// Abrir turno con la base de caja (el efectivo con el que arranca la caja).
export function AbrirTurno() {
  const notificar = useNotificar();
  const { recargar } = useTurno();
  const [base, setBase] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (base === null) return setError('Escribe la base de caja (puede ser $ 0).');
    setGuardando(true);
    const { error } = await crearCliente().rpc('abrir_turno', { p_base_caja: base });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    notificar(`Turno abierto con base de ${pesos(base)}. ¡Buen turno!`);
    await recargar();
  }

  return (
    <form onSubmit={abrir} className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold">No hay un turno abierto</h2>
        <p className="text-sm text-tenue">Para vender, abre el turno con el efectivo que hay en la caja al empezar.</p>
      </div>
      <CampoPesos etiqueta="Base de caja" valor={base} onCambio={setBase} placeholder="0" autoFocus />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton type="submit" tamano="xl" cargando={guardando}>
        Abrir turno
      </Boton>
    </form>
  );
}
