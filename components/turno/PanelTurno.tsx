'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CampoPesos } from '@/components/ui/CampoPesos';
import { useNotificar } from '@/components/ui/Notificaciones';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { fechaHora, hora, mensajeError, pesos } from '@/lib/formato';
import { crearCliente } from '@/lib/supabase/cliente';
import { useTurno } from '@/lib/turno';
import type { Cuenta, Mesa, ResumenTurno, Turno } from '@/lib/types';
import { AbrirTurno } from './AbrirTurno';

export function PanelTurno() {
  const { turno, cargando, recargar } = useTurno();
  const [cierre, setCierre] = useState<ResumenTurno | null>(null);

  if (cierre) return <ResumenCierre resumen={cierre} onListo={() => setCierre(null)} />;
  if (cargando) return <p className="text-tenue">Cargando turno…</p>;
  if (!turno) return <AbrirTurno />;
  return (
    <TurnoAbierto
      turno={turno}
      onCerrado={(r) => {
        setCierre(r);
        void recargar();
      }}
    />
  );
}

async function cargarTurnoAbierto() {
  const supabase = crearCliente();
  const [resumen, cuentas, mesas] = await Promise.all([
    supabase.rpc('resumen_turno'),
    supabase.from('cuentas').select('*').eq('estado', 'abierta').order('abierta_en').returns<Cuenta[]>(),
    supabase.from('mesas').select('*').returns<Mesa[]>(),
  ]);
  if (resumen.error) throw resumen.error;
  if (cuentas.error) throw cuentas.error;
  if (mesas.error) throw mesas.error;
  return { resumen: resumen.data as ResumenTurno, cuentas: cuentas.data, mesas: mesas.data };
}

function TurnoAbierto({ turno, onCerrado }: { turno: Turno; onCerrado: (r: ResumenTurno) => void }) {
  const notificar = useNotificar();
  const { datos, error, recargar } = useCarga(cargarTurnoAbierto);
  useTiempoReal(['pagos', 'cuentas'], recargar);

  const [contado, setContado] = useState<number | null>(null);
  const [notas, setNotas] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!datos) return <p className="text-tenue">Cargando turno…</p>;

  const { resumen, cuentas, mesas } = datos;
  const nombreMesa = new Map(mesas.map((m) => [m.id, m.nombre]));
  const conSaldo = cuentas.filter((c) => c.total - c.pagado > 0);
  const diferencia = contado !== null ? contado - resumen.efectivo_esperado : null;

  async function cerrar(e: FormEvent) {
    e.preventDefault();
    setErrorCierre(null);
    if (contado === null) return setErrorCierre('Cuenta el efectivo de la caja y escríbelo.');
    if (!confirmar) return setConfirmar(true);
    setCerrando(true);
    const { data, error } = await crearCliente().rpc('cerrar_turno', { p_efectivo_contado: contado, p_notas: notas });
    setCerrando(false);
    if (error) {
      setConfirmar(false);
      return setErrorCierre(mensajeError(error));
    }
    notificar('Turno cerrado.');
    onCerrado(data as ResumenTurno);
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black">Turno abierto</h1>
        <p className="text-sm text-tenue">
          Desde {hora(turno.inicio)} · abrió {resumen.operador ?? '—'} · base de caja {pesos(turno.base_caja)}
        </p>
      </div>

      <TotalesPorMetodo pagos={resumen.pagos} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
          <h2 className="text-lg font-bold">Cuentas abiertas ({cuentas.length})</h2>
          {cuentas.length === 0 ? (
            <p className="text-sm text-tenue">No hay cuentas abiertas.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {cuentas.map((c) => {
                const saldo = c.total - c.pagado;
                const etiqueta = c.mesa_id ? `${nombreMesa.get(c.mesa_id)} · ${c.nombre}` : c.nombre;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    {c.mesa_id ? (
                      <Link href={`/mesas/${c.mesa_id}`} className="font-semibold hover:underline">
                        {etiqueta}
                      </Link>
                    ) : (
                      <span className="font-semibold">{etiqueta}</span>
                    )}
                    <span className={saldo > 0 ? 'font-bold text-rose-600' : 'text-sm text-tenue'}>
                      {saldo > 0 ? pesos(saldo) : c.total > 0 ? 'al día (se cierra sola)' : 'vacía (se cierra sola)'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {resumen.items_eliminados || resumen.ventas_sin_stock ? (
            <p className="text-xs text-tenue">
              {resumen.items_eliminados} ítem(s) quitados · {resumen.ventas_sin_stock} venta(s) sin stock en este turno
            </p>
          ) : null}
        </div>

        <form onSubmit={cerrar} className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
          <h2 className="text-lg font-bold">Cerrar turno</h2>
          <div className="flex items-baseline justify-between rounded-xl bg-suave px-4 py-3">
            <span className="text-sm text-tenue">Efectivo esperado en caja</span>
            <span className="text-2xl font-black">{pesos(resumen.efectivo_esperado)}</span>
          </div>
          <p className="-mt-2 text-xs text-tenue">
            Base {pesos(turno.base_caja)} + pagos en efectivo {pesos(resumen.pagos.efectivo)}
          </p>

          {conSaldo.length ? (
            <Aviso tipo="advertencia">
              Para cerrar el turno, cobra o anula las cuentas con saldo pendiente ({conSaldo.length}).
            </Aviso>
          ) : (
            <>
              <CampoPesos
                etiqueta="Efectivo contado en caja"
                valor={contado}
                onCambio={(v) => {
                  setContado(v);
                  setConfirmar(false);
                }}
              />
              {diferencia !== null ? <Diferencia valor={diferencia} /> : null}
              <Campo etiqueta="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={300} />
              {errorCierre ? <Aviso tipo="error">{errorCierre}</Aviso> : null}
              <Boton type="submit" variante={confirmar ? 'peligro' : 'primario'} tamano="xl" cargando={cerrando}>
                {confirmar ? 'Sí, cerrar el turno' : 'Cerrar turno'}
              </Boton>
              {confirmar ? (
                <p className="text-center text-xs text-tenue">Después de cerrar no se pueden registrar más ventas en este turno.</p>
              ) : null}
            </>
          )}
        </form>
      </div>
    </section>
  );
}

function TotalesPorMetodo({ pagos }: { pagos: ResumenTurno['pagos'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        { titulo: 'Total cobrado', valor: pagos.total, fuerte: true },
        { titulo: 'Efectivo', valor: pagos.efectivo },
        { titulo: 'Daviplata', valor: pagos.daviplata },
        { titulo: 'Bre-B', valor: pagos.bre_b },
      ].map((t) => (
        <div
          key={t.titulo}
          className={`rounded-2xl border px-4 py-3 shadow-sm ${t.fuerte ? 'border-marca bg-marca/10' : 'border-borde bg-superficie'}`}
        >
          <p className="text-xs font-medium text-tenue">{t.titulo}</p>
          <p className={`font-black tabular-nums ${t.fuerte ? 'text-2xl text-cafe' : 'text-xl'}`}>{pesos(t.valor)}</p>
        </div>
      ))}
    </div>
  );
}

export function Diferencia({ valor }: { valor: number }) {
  if (valor === 0) return <Aviso tipo="exito">La caja cuadra exacto.</Aviso>;
  if (valor > 0) return <Aviso tipo="advertencia">Sobran {pesos(valor)} en la caja.</Aviso>;
  return <Aviso tipo="error">Faltan {pesos(-valor)} en la caja.</Aviso>;
}

function ResumenCierre({ resumen, onListo }: { resumen: ResumenTurno; onListo: () => void }) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-black">Turno cerrado</h1>
        <p className="text-sm text-tenue">
          {fechaHora(resumen.inicio)} → {resumen.fin ? hora(resumen.fin) : ''} · {resumen.operador}
        </p>
      </div>
      <TotalesPorMetodo pagos={resumen.pagos} />
      <Aviso tipo="info">
        Verifica en el celular que los pagos de <strong>Daviplata ({pesos(resumen.pagos.daviplata)})</strong> y{' '}
        <strong>Bre-B ({pesos(resumen.pagos.bre_b)})</strong> hayan llegado.
      </Aviso>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
        <dt className="text-tenue">Base de caja</dt>
        <dd className="text-right font-semibold">{pesos(resumen.base_caja)}</dd>
        <dt className="text-tenue">Efectivo esperado</dt>
        <dd className="text-right font-semibold">{pesos(resumen.efectivo_esperado)}</dd>
        <dt className="text-tenue">Efectivo contado</dt>
        <dd className="text-right font-semibold">{pesos(resumen.efectivo_contado)}</dd>
        <dt className="text-tenue">Cuentas pagadas / anuladas</dt>
        <dd className="text-right font-semibold">
          {resumen.cuentas.pagadas} / {resumen.cuentas.anuladas}
        </dd>
        <dt className="text-tenue">Ítems quitados</dt>
        <dd className="text-right font-semibold">{resumen.items_eliminados}</dd>
      </dl>
      <Diferencia valor={resumen.diferencia ?? 0} />
      {resumen.notas ? <p className="text-sm text-tenue">Notas: {resumen.notas}</p> : null}
      <Boton tamano="xl" onClick={onListo}>
        Listo
      </Boton>
    </section>
  );
}
