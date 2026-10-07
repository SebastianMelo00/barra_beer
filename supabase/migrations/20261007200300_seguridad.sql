-- =============================================================================
-- La Barra Beer — 4/5 Seguridad: Row Level Security y permisos
--
-- Principio: la app (rol "authenticated") solo puede LEER tablas. Toda
-- escritura pasa por las funciones RPC, que validan rol y reglas de negocio.
-- Única excepción: la admin edita productos y mesas directamente, y aun así
-- no puede tocar productos.stock_actual (permiso por columna + trigger).
-- El rol "anon" (sin sesión) no tiene acceso a nada.
-- =============================================================================

alter table public.perfiles        enable row level security;
alter table public.productos       enable row level security;
alter table public.mesas           enable row level security;
alter table public.turnos          enable row level security;
alter table public.cuentas         enable row level security;
alter table public.cuenta_items    enable row level security;
alter table public.pagos           enable row level security;
alter table public.movimientos_inv enable row level security;
alter table public.auditoria_items enable row level security;
alter table public.actividad       enable row level security;

-- ---------------------------------------------------------------------------
-- Permisos de tabla
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;

grant insert (nombre, categoria, precio_venta, costo, stock_minimo, activo, descuenta_de, factor_descuento, orden)
  on public.productos to authenticated;
grant update (nombre, categoria, precio_venta, costo, stock_minimo, activo, descuenta_de, factor_descuento, orden)
  on public.productos to authenticated;
grant delete on public.productos to authenticated;

grant insert (nombre, orden_visual, es_barra) on public.mesas to authenticated;
grant update (nombre, orden_visual, es_barra) on public.mesas to authenticated;
grant delete on public.mesas to authenticated;

grant usage on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas de lectura
-- El operador solo ve lo del turno abierto; la admin ve todo el historial.
-- ---------------------------------------------------------------------------
create policy "staff lee perfiles" on public.perfiles
  for select to authenticated using ((select public.es_staff()));

create policy "staff lee productos" on public.productos
  for select to authenticated using ((select public.es_staff()));

create policy "staff lee mesas" on public.mesas
  for select to authenticated using ((select public.es_staff()));

create policy "admin lee turnos; operador el abierto" on public.turnos
  for select to authenticated using (
    (select public.es_admin())
    or ((select public.es_staff()) and estado = 'abierto')
  );

create policy "admin lee cuentas; operador las del turno abierto" on public.cuentas
  for select to authenticated using (
    (select public.es_admin())
    or ((select public.es_staff()) and turno_id = (select public.turno_abierto_id()))
  );

create policy "admin lee items; operador los del turno abierto" on public.cuenta_items
  for select to authenticated using (
    (select public.es_admin())
    or (
      (select public.es_staff())
      and cuenta_id in (select id from public.cuentas where turno_id = (select public.turno_abierto_id()))
    )
  );

create policy "admin lee pagos; operador los del turno abierto" on public.pagos
  for select to authenticated using (
    (select public.es_admin())
    or ((select public.es_staff()) and turno_id = (select public.turno_abierto_id()))
  );

create policy "admin lee movimientos; operador los del turno abierto" on public.movimientos_inv
  for select to authenticated using (
    (select public.es_admin())
    or ((select public.es_staff()) and turno_id = (select public.turno_abierto_id()))
  );

create policy "admin lee auditoria; operador la del turno abierto" on public.auditoria_items
  for select to authenticated using (
    (select public.es_admin())
    or ((select public.es_staff()) and turno_id = (select public.turno_abierto_id()))
  );

create policy "solo admin lee actividad" on public.actividad
  for select to authenticated using ((select public.es_admin()));

-- ---------------------------------------------------------------------------
-- Políticas de escritura directa (solo admin, solo productos y mesas)
-- ---------------------------------------------------------------------------
create policy "admin crea productos" on public.productos
  for insert to authenticated with check ((select public.es_admin()));
create policy "admin edita productos" on public.productos
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "admin borra productos" on public.productos
  for delete to authenticated using ((select public.es_admin()));

create policy "admin crea mesas" on public.mesas
  for insert to authenticated with check ((select public.es_admin()));
create policy "admin edita mesas" on public.mesas
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "admin borra mesas" on public.mesas
  for delete to authenticated using ((select public.es_admin()));

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- Por defecto Postgres deja ejecutar cualquier función a todos: se quita y
-- se concede solo lo necesario.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Usadas por las políticas RLS y por la app para saber el rol.
grant execute on function
  public.mi_rol(),
  public.es_admin(),
  public.es_staff(),
  public.turno_abierto_id()
to authenticated;

-- RPC de la app (cada una valida el rol por dentro).
grant execute on function
  public.abrir_turno(integer),
  public.resumen_turno(bigint),
  public.cerrar_turno(integer, text),
  public.crear_cuenta(bigint, text),
  public.renombrar_cuenta(bigint, text),
  public.cerrar_cuenta(bigint),
  public.anular_cuenta(bigint, text, boolean),
  public.agregar_item(bigint, bigint, integer),
  public.quitar_item(bigint, text, integer),
  public.mover_item(bigint, bigint, integer, text),
  public.registrar_pago(bigint, integer, text, boolean),
  public.venta_rapida(jsonb, text),
  public.registrar_movimiento(bigint, text, integer, text),
  public.ajustar_stock(bigint, integer, text)
to authenticated;

-- Las funciones interno_*, exigir_*, registrar_actividad, etiqueta_* y pesos
-- quedan sin permiso para la app: solo las llaman las RPC (que corren como
-- dueño gracias a security definer).
