'use client';

import { useRef, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Modal } from '@/components/ui/Modal';
import { useCarga, useTiempoReal } from '@/lib/datos';
import { pesos } from '@/lib/formato';
import { esBase, estadoStock } from '@/lib/inventario';
import { useSesion } from '@/lib/sesion';
import { crearCliente } from '@/lib/supabase/cliente';
import type { Perfil, Producto } from '@/lib/types';
import { FormularioLote } from './FormularioLote';
import { FormularioMerma } from './FormularioMerma';
import { Movimientos } from './Movimientos';
import { TablaStock } from './TablaStock';

async function cargarDatos() {
  const supabase = crearCliente();
  const [productos, perfiles] = await Promise.all([
    supabase.from('productos').select('*').order('orden').returns<Producto[]>(),
    supabase.from('perfiles').select('*').returns<Perfil[]>(),
  ]);
  if (productos.error) throw productos.error;
  if (perfiles.error) throw perfiles.error;
  return { productos: productos.data, perfiles: perfiles.data };
}

type Ventana = { tipo: 'entrada' } | { tipo: 'merma' } | { tipo: 'conteo' } | { tipo: 'ajuste'; producto: Producto };

export function PanelInventario() {
  const { esAdmin, cargando: cargandoSesion } = useSesion();
  const { datos, error, recargar } = useCarga(cargarDatos);
  useTiempoReal(['productos'], recargar);

  const [ventana, setVentana] = useState<Ventana | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [productoHistorial, setProductoHistorial] = useState<number | null>(null);
  const [version, setVersion] = useState(0); // sube con cada registro para refrescar el historial
  const historialRef = useRef<HTMLDivElement>(null);

  const productos = datos?.productos ?? [];
  const base = productos.filter((p) => esBase(p) && p.activo);
  const alertas = base.filter((p) => estadoStock(p.stock_actual, p.stock_minimo) !== 'ok');
  const sinStock = alertas.filter((p) => p.stock_actual <= 0);
  const conCosto = base.filter((p) => p.costo !== null);
  const valorCosto = conCosto.reduce((s, p) => s + Math.max(0, p.stock_actual) * (p.costo ?? 0), 0);

  const cerrar = () => setVentana(null);
  const listo = () => {
    setVentana(null);
    setVersion((v) => v + 1);
    void recargar();
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <div className="flex flex-wrap gap-2">
          <Boton variante="exito" onClick={() => setVentana({ tipo: 'entrada' })} disabled={!datos}>
            + Entrada de mercancía
          </Boton>
          <Boton variante="secundario" onClick={() => setVentana({ tipo: 'merma' })} disabled={!datos}>
            Registrar merma
          </Boton>
          {esAdmin ? (
            <Boton variante="secundario" onClick={() => setVentana({ tipo: 'conteo' })} disabled={!datos}>
              Conteo físico
            </Boton>
          ) : null}
        </div>
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {!datos && !error ? <p className="text-zinc-400">Cargando inventario…</p> : null}

      {datos ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Resumen titulo="Productos con stock propio" valor={String(base.length)} />
            <Resumen
              titulo="Stock bajo"
              valor={String(alertas.length - sinStock.length)}
              color={alertas.length - sinStock.length ? 'text-amber-300' : undefined}
            />
            <Resumen titulo="Agotados o negativos" valor={String(sinStock.length)} color={sinStock.length ? 'text-rose-400' : undefined} />
            {esAdmin ? (
              <Resumen
                titulo="Inventario a costo"
                valor={pesos(valorCosto)}
                nota={conCosto.length < base.length ? `${base.length - conCosto.length} sin costo registrado` : undefined}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Campo
              type="search"
              placeholder="Buscar producto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar producto"
              className="min-w-56 flex-1"
            />
            <div className="flex rounded-xl border border-zinc-700 p-1">
              {[
                { valor: false, texto: 'Todos' },
                { valor: true, texto: `Alertas (${alertas.length})` },
              ].map((op) => (
                <button
                  key={op.texto}
                  type="button"
                  onClick={() => setSoloAlertas(op.valor)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    soloAlertas === op.valor ? 'bg-marca text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {op.texto}
                </button>
              ))}
            </div>
          </div>

          <TablaStock
            productos={productos}
            busqueda={busqueda}
            soloAlertas={soloAlertas}
            esAdmin={esAdmin}
            onAjustar={(p) => setVentana({ tipo: 'ajuste', producto: p })}
            onHistorial={(p) => {
              setProductoHistorial(p.id);
              historialRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />

          <div ref={historialRef} className="scroll-mt-20">
            {cargandoSesion ? null : (
              <Movimientos
                productos={productos}
                perfiles={datos.perfiles}
                esAdmin={esAdmin}
                productoId={productoHistorial}
                onProductoId={setProductoHistorial}
                version={version}
              />
            )}
          </div>
        </>
      ) : null}

      <Modal abierto={ventana?.tipo === 'entrada'} onCerrar={cerrar} titulo="Entrada de mercancía" ancho="lg">
        <FormularioLote modo="entrada" productos={productos} onListo={listo} />
      </Modal>
      <Modal abierto={ventana?.tipo === 'merma'} onCerrar={cerrar} titulo="Registrar merma">
        <FormularioMerma productos={productos} onListo={listo} />
      </Modal>
      <Modal abierto={ventana?.tipo === 'conteo'} onCerrar={cerrar} titulo="Conteo físico" ancho="lg">
        <FormularioLote modo="conteo" productos={productos} onListo={listo} />
      </Modal>
      <Modal
        abierto={ventana?.tipo === 'ajuste'}
        onCerrar={cerrar}
        titulo={ventana?.tipo === 'ajuste' ? `Ajustar ${ventana.producto.nombre}` : 'Ajustar'}
      >
        {ventana?.tipo === 'ajuste' ? (
          <FormularioLote modo="conteo" productos={productos} soloProductoId={ventana.producto.id} onListo={listo} />
        ) : null}
      </Modal>
    </section>
  );
}

function Resumen({ titulo, valor, color, nota }: { titulo: string; valor: string; color?: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs font-medium text-zinc-400">{titulo}</p>
      <p className={`text-2xl font-bold tabular-nums ${color ?? 'text-zinc-100'}`}>{valor}</p>
      {nota ? <p className="text-xs text-zinc-500">{nota}</p> : null}
    </div>
  );
}
