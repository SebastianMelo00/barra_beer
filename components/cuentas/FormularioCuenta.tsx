'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { mensajeError } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Cuenta } from '@/lib/types';

// Crear una cuenta nueva en la mesa (nombre opcional) o renombrar una existente.
export function FormularioCuenta({
  mesaId,
  cuenta,
  onListo,
  enLinea = false,
}: {
  mesaId: number;
  cuenta?: Cuenta; // si viene, se renombra
  onListo: (cuenta: Cuenta) => void;
  enLinea?: boolean; // versión grande para la mesa libre
}) {
  const [nombre, setNombre] = useState(cuenta?.nombre ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const supabase = crearCliente();
    const { data, error } = cuenta
      ? await supabase.rpc('renombrar_cuenta', { p_cuenta_id: cuenta.id, p_nombre: nombre })
      : await supabase.rpc('crear_cuenta', { p_mesa_id: mesaId, p_nombre: nombre.trim() || null });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    // PostgREST devuelve la fila como objeto (o como lista de una fila).
    onListo((Array.isArray(data) ? data[0] : data) as Cuenta);
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <Campo
        etiqueta={cuenta ? 'Nombre de la cuenta' : 'Nombre (opcional)'}
        placeholder={cuenta ? undefined : 'Ej. Juan, Camisa roja… o déjalo vacío'}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={40}
        data-autofocus
        autoFocus={enLinea}
      />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton type="submit" tamano={enLinea ? 'xl' : 'lg'} cargando={guardando}>
        {cuenta ? 'Guardar nombre' : 'Abrir cuenta'}
      </Boton>
    </form>
  );
}
