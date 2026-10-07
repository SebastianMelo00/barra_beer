'use client';

import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CampoCantidad } from '@/components/ui/CampoCantidad';
import { useNotificar } from '@/components/ui/Notificaciones';
import { mensajeError, pesos } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Cuenta, CuentaItem, Producto } from '@/lib/types';

// Mover unidades de un ítem a otra cuenta de la misma mesa (o a una nueva).
// No toca el inventario; queda auditado como "movido".
export function DialogoMoverItem({
  item,
  producto,
  mesaId,
  cuentas,
  onListo,
}: {
  item: CuentaItem;
  producto: Producto | undefined;
  mesaId: number;
  cuentas: Cuenta[]; // otras cuentas abiertas de la mesa
  onListo: () => void;
}) {
  const notificar = useNotificar();
  const [cantidad, setCantidad] = useState<number | null>(item.cantidad);
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const n = Math.min(cantidad ?? 1, item.cantidad);

  async function mover(destino: Cuenta | 'nueva') {
    setError(null);
    setGuardando(true);
    const supabase = crearCliente();
    let destinoId: number;
    let destinoNombre: string;
    if (destino === 'nueva') {
      const { data, error } = await supabase.rpc('crear_cuenta', { p_mesa_id: mesaId, p_nombre: nuevaNombre.trim() || null });
      if (error) {
        setGuardando(false);
        return setError(mensajeError(error));
      }
      const creada = (Array.isArray(data) ? data[0] : data) as Cuenta;
      destinoId = creada.id;
      destinoNombre = creada.nombre;
    } else {
      destinoId = destino.id;
      destinoNombre = destino.nombre;
    }
    const { error } = await supabase.rpc('mover_item', {
      p_item_id: item.id,
      p_cuenta_destino_id: destinoId,
      p_cantidad: n,
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    notificar(`${n} ${producto?.nombre ?? 'producto'} movido(s) a ${destinoNombre}.`);
    onListo();
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        <strong>{producto?.nombre}</strong> · {item.cantidad} en la cuenta
      </p>
      {item.cantidad > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">¿Cuántas mover?</span>
          <CampoCantidad etiqueta="Cantidad a mover" valor={cantidad} onCambio={(v) => setCantidad(v === null ? null : Math.min(v, item.cantidad))} min={1} />
        </div>
      ) : null}

      {cuentas.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Mover a:</span>
          <div className="grid grid-cols-2 gap-2">
            {cuentas.map((c) => (
              <Boton key={c.id} variante="secundario" tamano="xl" disabled={guardando} onClick={() => mover(c)}>
                <span className="flex flex-col items-center leading-tight">
                  <span>{c.nombre}</span>
                  <span className="text-xs font-normal text-tenue">saldo {pesos(c.total - c.pagado)}</span>
                </span>
              </Boton>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl bg-suave p-3">
        <span className="text-sm font-medium">…o a una cuenta nueva</span>
        <div className="flex gap-2">
          <Campo
            placeholder="Nombre (opcional)"
            value={nuevaNombre}
            onChange={(e) => setNuevaNombre(e.target.value)}
            maxLength={40}
            aria-label="Nombre de la cuenta nueva"
            className="flex-1"
          />
          <Boton tamano="lg" disabled={guardando} onClick={() => mover('nueva')}>
            Crear y mover
          </Boton>
        </div>
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
