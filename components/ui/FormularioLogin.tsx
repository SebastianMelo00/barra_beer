'use client';

import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { crearCliente } from '@/lib/supabase/cliente';
import { cerrarSesion } from '@/lib/sesion';

export function FormularioLogin() {
  const sinPerfil = useSearchParams().get('error') === 'sin-perfil';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function ingresar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error } = await crearCliente().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setCargando(false);
      setError(
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : `No se pudo ingresar: ${error.message}`,
      );
      return;
    }
    // Recarga completa: el proxy redirige a /dashboard (admin) o /mesas (operador).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/');
  }

  if (sinPerfil) {
    return (
      <div className="flex flex-col gap-4">
        <Aviso tipo="error">
          Tu usuario no tiene un perfil activo en La Barra Beer. Pídele a la administradora que te asigne un rol.
        </Aviso>
        <Boton variante="secundario" onClick={cerrarSesion}>
          Ingresar con otro usuario
        </Boton>
      </div>
    );
  }

  return (
    <form onSubmit={ingresar} className="flex flex-col gap-4">
      <Campo
        etiqueta="Correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Campo
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton type="submit" tamano="xl" cargando={cargando}>
        Ingresar
      </Boton>
    </form>
  );
}
