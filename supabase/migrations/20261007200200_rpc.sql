-- =============================================================================
-- La Barra Beer — 3/5 Funciones RPC (operaciones atómicas)
-- Cada función corre en una sola transacción: o se hace todo o no se hace nada.
-- Las funciones "interno_*" no se exponen a la app (ver 4/5 seguridad).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Internas
-- ---------------------------------------------------------------------------

-- Bloquea la cuenta y verifica que esté abierta y en el turno actual.
create function public.interno_bloquear_cuenta(p_cuenta_id bigint, p_turno_id bigint)
returns public.cuentas
language plpgsql security definer set search_path = ''
as $$
declare
  v_cuenta public.cuentas;
begin
  select * into v_cuenta from public.cuentas where id = p_cuenta_id for update;
  if not found then
    raise exception 'La cuenta no existe.';
  end if;
  if v_cuenta.estado <> 'abierta' then
    raise exception 'La cuenta "%" ya está % y no se puede modificar.',
      v_cuenta.nombre, v_cuenta.estado;
  end if;
  if v_cuenta.turno_id <> p_turno_id then
    raise exception 'La cuenta pertenece a otro turno.';
  end if;
  return v_cuenta;
end;
$$;

-- Agrega un producto a una cuenta ya bloqueada: precio congelado, movimiento
-- de venta (descuenta inventario) y total actualizado.
create function public.interno_agregar_item(
  p_cuenta_id bigint,
  p_producto_id bigint,
  p_cantidad integer,
  p_usuario uuid,
  p_turno_id bigint,
  p_registrar_actividad boolean
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_prod    public.productos;
  v_mov     public.movimientos_inv;
  v_item_id bigint;
begin
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 500 then
    raise exception 'Cantidad inválida.';
  end if;

  select * into v_prod from public.productos where id = p_producto_id;
  if not found then
    raise exception 'El producto no existe.';
  end if;
  if not v_prod.activo then
    raise exception '"%" está inactivo y no se puede vender.', v_prod.nombre;
  end if;

  insert into public.movimientos_inv (producto_id, tipo, cantidad, usuario_id, cuenta_id, turno_id)
  values (p_producto_id, 'venta', -p_cantidad, p_usuario, p_cuenta_id, p_turno_id)
  returning * into v_mov;

  insert into public.cuenta_items (cuenta_id, producto_id, cantidad, precio_unitario, sin_stock, agregado_por)
  values (p_cuenta_id, p_producto_id, p_cantidad, v_prod.precio_venta, v_mov.sin_stock, p_usuario)
  on conflict (cuenta_id, producto_id, precio_unitario) do update
    set cantidad  = public.cuenta_items.cantidad + excluded.cantidad,
        sin_stock = public.cuenta_items.sin_stock or excluded.sin_stock
  returning id into v_item_id;

  update public.cuentas
     set total = total + p_cantidad * v_prod.precio_venta
   where id = p_cuenta_id;

  if p_registrar_actividad then
    perform public.registrar_actividad(
      'venta',
      public.etiqueta_cuenta(p_cuenta_id) || ': +' || p_cantidad || ' ' || v_prod.nombre
        || case when v_mov.sin_stock then ' (SIN STOCK)' else '' end,
      p_cantidad * v_prod.precio_venta,
      p_cuenta_id,
      p_turno_id
    );
  end if;

  return jsonb_build_object(
    'item_id', v_item_id,
    'producto', v_prod.nombre,
    'sin_stock', v_mov.sin_stock,
    'stock_restante', v_mov.stock_resultante
  );
end;
$$;

-- Cierra una cuenta sin consumo (total 0 y sin pagos): si nunca tuvo
-- movimientos se borra; si tuvo (ítems agregados y luego quitados), queda
-- como pagada con total $ 0 para conservar el historial.
create function public.interno_cerrar_cuenta_vacia(p_cuenta_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.cuenta_items where cuenta_id = p_cuenta_id)
     or exists (select 1 from public.movimientos_inv where cuenta_id = p_cuenta_id)
     or exists (select 1 from public.auditoria_items
                where cuenta_origen_id = p_cuenta_id or cuenta_destino_id = p_cuenta_id)
     or exists (select 1 from public.pagos where cuenta_id = p_cuenta_id) then
    update public.cuentas set estado = 'pagada', cerrada_en = now() where id = p_cuenta_id;
  else
    delete from public.cuentas where id = p_cuenta_id;
  end if;
end;
$$;

create function public.interno_resumen_turno(p_turno_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_turno    public.turnos;
  v_efectivo integer;
  v_davi     integer;
  v_breb     integer;
  v_esperado integer;
begin
  select * into v_turno from public.turnos where id = p_turno_id;
  if not found then
    raise exception 'El turno no existe.';
  end if;

  select coalesce(sum(monto) filter (where metodo = 'efectivo'), 0),
         coalesce(sum(monto) filter (where metodo = 'daviplata'), 0),
         coalesce(sum(monto) filter (where metodo = 'bre_b'), 0)
    into v_efectivo, v_davi, v_breb
  from public.pagos
  where turno_id = p_turno_id;

  v_esperado := coalesce(v_turno.efectivo_esperado, v_turno.base_caja + v_efectivo);

  return jsonb_build_object(
    'turno_id', v_turno.id,
    'estado', v_turno.estado,
    'operador', (select nombre from public.perfiles where id = v_turno.operador_id),
    'inicio', v_turno.inicio,
    'fin', v_turno.fin,
    'base_caja', v_turno.base_caja,
    'pagos', jsonb_build_object(
      'efectivo', v_efectivo,
      'daviplata', v_davi,
      'bre_b', v_breb,
      'total', v_efectivo + v_davi + v_breb
    ),
    'efectivo_esperado', v_esperado,
    'efectivo_contado', v_turno.efectivo_contado,
    'diferencia', v_turno.diferencia,
    'notas', v_turno.notas,
    'cuentas', (
      select jsonb_build_object(
        'abiertas', count(*) filter (where estado = 'abierta'),
        'pagadas', count(*) filter (where estado = 'pagada'),
        'anuladas', count(*) filter (where estado = 'anulada'),
        'saldo_pendiente', coalesce(sum(total - pagado) filter (where estado = 'abierta'), 0)
      )
      from public.cuentas where turno_id = p_turno_id
    ),
    'items_eliminados', (
      select count(*) from public.auditoria_items where turno_id = p_turno_id and tipo = 'eliminado'
    ),
    'ventas_sin_stock', (
      select count(*) from public.movimientos_inv where turno_id = p_turno_id and tipo = 'venta' and sin_stock
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Turnos
-- ---------------------------------------------------------------------------

create function public.abrir_turno(p_base_caja integer)
returns public.turnos
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := public.exigir_staff();
  v_turno public.turnos;
begin
  if p_base_caja is null or p_base_caja < 0 then
    raise exception 'La base de caja debe ser 0 o más.';
  end if;
  if exists (select 1 from public.turnos where estado = 'abierto') then
    raise exception 'Ya hay un turno abierto.';
  end if;

  insert into public.turnos (operador_id, base_caja)
  values (v_uid, p_base_caja)
  returning * into v_turno;

  perform public.registrar_actividad(
    'turno', 'Turno abierto con base de caja ' || public.pesos(p_base_caja), null, null, v_turno.id);
  return v_turno;
exception
  when unique_violation then
    raise exception 'Ya hay un turno abierto.';
end;
$$;

-- Resumen de un turno. El operador solo puede ver el turno abierto.
create function public.resumen_turno(p_turno_id bigint default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id bigint := coalesce(p_turno_id, public.turno_abierto_id());
begin
  perform public.exigir_staff();
  if v_id is null then
    raise exception 'No hay un turno abierto.';
  end if;
  if not public.es_admin() and v_id is distinct from public.turno_abierto_id() then
    raise exception 'Solo puedes ver el turno abierto.' using errcode = '42501';
  end if;
  return public.interno_resumen_turno(v_id);
end;
$$;

-- Cierre con cuadre de caja. Las cuentas sin consumo y las ya cubiertas por
-- abonos (saldo 0) se cierran solas; si queda alguna con saldo, no se cierra.
create function public.cerrar_turno(p_efectivo_contado integer, p_notas text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := public.exigir_staff();
  v_turno     public.turnos;
  v_cuenta    record;
  v_pend      text;
  v_efectivo  integer;
  v_esperado  integer;
begin
  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Ingresa el efectivo contado (0 o más).';
  end if;

  select * into v_turno from public.turnos where estado = 'abierto' for update;
  if not found then
    raise exception 'No hay un turno abierto.';
  end if;

  for v_cuenta in
    select id from public.cuentas
    where turno_id = v_turno.id and estado = 'abierta' and total = 0 and pagado = 0
  loop
    perform public.interno_cerrar_cuenta_vacia(v_cuenta.id);
  end loop;

  update public.cuentas
     set estado = 'pagada', cerrada_en = now()
   where turno_id = v_turno.id and estado = 'abierta' and total > 0 and pagado = total;

  select string_agg(public.etiqueta_cuenta(id) || ' (' || public.pesos(total - pagado) || ')', ', ' order by id)
    into v_pend
  from public.cuentas
  where turno_id = v_turno.id and estado = 'abierta';

  if v_pend is not null then
    raise exception 'No se puede cerrar el turno. Cuentas con saldo pendiente: %', v_pend;
  end if;

  select coalesce(sum(monto), 0) into v_efectivo
  from public.pagos
  where turno_id = v_turno.id and metodo = 'efectivo';

  v_esperado := v_turno.base_caja + v_efectivo;

  perform public.registrar_actividad(
    'turno',
    'Turno cerrado. Efectivo esperado ' || public.pesos(v_esperado)
      || ', contado ' || public.pesos(p_efectivo_contado)
      || ', diferencia ' || public.pesos(p_efectivo_contado - v_esperado),
    p_efectivo_contado - v_esperado, null, v_turno.id);

  update public.turnos
     set estado = 'cerrado',
         fin = now(),
         efectivo_esperado = v_esperado,
         efectivo_contado = p_efectivo_contado,
         diferencia = p_efectivo_contado - v_esperado,
         notas = nullif(trim(p_notas), ''),
         cerrado_por = v_uid
   where id = v_turno.id;

  return public.interno_resumen_turno(v_turno.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cuentas
-- ---------------------------------------------------------------------------

-- Nueva cuenta en una mesa. Sin nombre => "Cuenta 1", "Cuenta 2"...
create function public.crear_cuenta(p_mesa_id bigint, p_nombre text default null)
returns public.cuentas
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := public.exigir_staff();
  v_turno  bigint := public.exigir_turno_abierto();
  v_nombre text := nullif(trim(p_nombre), '');
  v_cuenta public.cuentas;
begin
  -- Bloquear la mesa evita dos "Cuenta 2" si se crean al mismo tiempo.
  perform 1 from public.mesas where id = p_mesa_id for update;
  if not found then
    raise exception 'La mesa no existe.';
  end if;

  if v_nombre is null then
    select 'Cuenta ' || n into v_nombre
    from generate_series(1, 1000) n
    where not exists (
      select 1 from public.cuentas
      where mesa_id = p_mesa_id and estado = 'abierta' and lower(nombre) = lower('Cuenta ' || n)
    )
    order by n
    limit 1;
  elsif exists (
    select 1 from public.cuentas
    where mesa_id = p_mesa_id and estado = 'abierta' and lower(nombre) = lower(v_nombre)
  ) then
    raise exception 'Ya hay una cuenta abierta llamada "%" en esta mesa.', v_nombre;
  end if;

  insert into public.cuentas (mesa_id, turno_id, nombre, creada_por)
  values (p_mesa_id, v_turno, v_nombre, v_uid)
  returning * into v_cuenta;
  return v_cuenta;
end;
$$;

create function public.renombrar_cuenta(p_cuenta_id bigint, p_nombre text)
returns public.cuentas
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := public.exigir_staff();
  v_turno  bigint := public.exigir_turno_abierto();
  v_nombre text := nullif(trim(p_nombre), '');
  v_cuenta public.cuentas;
begin
  if v_nombre is null then
    raise exception 'Escribe un nombre para la cuenta.';
  end if;
  v_cuenta := public.interno_bloquear_cuenta(p_cuenta_id, v_turno);
  if v_cuenta.mesa_id is not null and exists (
    select 1 from public.cuentas
    where mesa_id = v_cuenta.mesa_id and estado = 'abierta'
      and id <> p_cuenta_id and lower(nombre) = lower(v_nombre)
  ) then
    raise exception 'Ya hay una cuenta abierta llamada "%" en esta mesa.', v_nombre;
  end if;

  update public.cuentas set nombre = v_nombre where id = p_cuenta_id returning * into v_cuenta;
  return v_cuenta;
end;
$$;

-- Cierra una cuenta cuyo saldo ya es 0 (pagada por abonos) o que quedó vacía.
create function public.cerrar_cuenta(p_cuenta_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := public.exigir_staff();
  v_turno  bigint := public.exigir_turno_abierto();
  v_cuenta public.cuentas := public.interno_bloquear_cuenta(p_cuenta_id, v_turno);
begin
  if v_cuenta.total = 0 and v_cuenta.pagado = 0 then
    perform public.interno_cerrar_cuenta_vacia(p_cuenta_id);
  elsif v_cuenta.pagado = v_cuenta.total then
    update public.cuentas set estado = 'pagada', cerrada_en = now() where id = p_cuenta_id;
  else
    raise exception 'La cuenta tiene un saldo pendiente de %.', public.pesos(v_cuenta.total - v_cuenta.pagado);
  end if;
end;
$$;

-- Solo admin. Devuelve el stock de todos los ítems (salvo que se indique lo
-- contrario, p. ej. si el cliente se fue sin pagar y el producto sí se consumió).
-- Los pagos ya recibidos se conservan: es dinero que está en la caja.
create function public.anular_cuenta(
  p_cuenta_id bigint,
  p_motivo text,
  p_devolver_stock boolean default true
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := public.exigir_admin();
  v_turno  bigint := public.exigir_turno_abierto();
  v_cuenta public.cuentas := public.interno_bloquear_cuenta(p_cuenta_id, v_turno);
  v_item   record;
begin
  if length(trim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Escribe el motivo de la anulación.';
  end if;

  if p_devolver_stock then
    for v_item in
      select producto_id, sum(cantidad)::integer as cantidad
      from public.cuenta_items where cuenta_id = p_cuenta_id
      group by producto_id
    loop
      insert into public.movimientos_inv (producto_id, tipo, cantidad, usuario_id, cuenta_id, turno_id, motivo)
      values (v_item.producto_id, 'devolucion', v_item.cantidad, v_uid, p_cuenta_id, v_turno,
              'Anulación de cuenta: ' || trim(p_motivo));
    end loop;
  end if;

  update public.cuentas
     set estado = 'anulada',
         cerrada_en = now(),
         anulada_por = v_uid,
         motivo_anulacion = trim(p_motivo)
   where id = p_cuenta_id;

  perform public.registrar_actividad(
    'anulacion',
    'Cuenta anulada: ' || public.etiqueta_cuenta(p_cuenta_id) || ' — ' || trim(p_motivo)
      || case when p_devolver_stock then '' else ' (sin devolver stock)' end,
    v_cuenta.total, p_cuenta_id, v_turno);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ítems
-- ---------------------------------------------------------------------------

create function public.agregar_item(p_cuenta_id bigint, p_producto_id bigint, p_cantidad integer default 1)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := public.exigir_staff();
  v_turno bigint := public.exigir_turno_abierto();
begin
  perform public.interno_bloquear_cuenta(p_cuenta_id, v_turno);
  return public.interno_agregar_item(p_cuenta_id, p_producto_id, p_cantidad, v_uid, v_turno, true);
end;
$$;

-- Quita unidades de un ítem (por defecto todas). Devuelve el stock y deja
-- registro en auditoria_items. No se puede si eso deja el saldo negativo.
create function public.quitar_item(p_item_id bigint, p_motivo text, p_cantidad integer default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := public.exigir_staff();
  v_turno  bigint := public.exigir_turno_abierto();
  v_item   public.cuenta_items;
  v_cuenta public.cuentas;
  v_cant   integer;
  v_monto  integer;
  v_nombre text;
begin
  if length(trim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Escribe el motivo para quitar el ítem.';
  end if;

  select cuenta_id into v_item.cuenta_id from public.cuenta_items where id = p_item_id;
  if v_item.cuenta_id is null then
    raise exception 'El ítem ya no existe.';
  end if;
  v_cuenta := public.interno_bloquear_cuenta(v_item.cuenta_id, v_turno);

  select * into v_item from public.cuenta_items where id = p_item_id for update;
  if not found then
    raise exception 'El ítem ya no existe.';
  end if;

  v_cant := coalesce(p_cantidad, v_item.cantidad);
  if v_cant < 1 or v_cant > v_item.cantidad then
    raise exception 'Cantidad inválida: el ítem tiene % unidad(es).', v_item.cantidad;
  end if;

  v_monto := v_cant * v_item.precio_unitario;
  if v_cuenta.total - v_monto < v_cuenta.pagado then
    raise exception 'No se puede quitar: ya se pagaron % y el saldo quedaría negativo.',
      public.pesos(v_cuenta.pagado);
  end if;

  insert into public.movimientos_inv (producto_id, tipo, cantidad, usuario_id, cuenta_id, turno_id, motivo)
  values (v_item.producto_id, 'devolucion', v_cant, v_uid, v_cuenta.id, v_turno, trim(p_motivo));

  insert into public.auditoria_items
    (tipo, producto_id, cantidad, precio_unitario, cuenta_origen_id, usuario_id, turno_id, motivo)
  values
    ('eliminado', v_item.producto_id, v_cant, v_item.precio_unitario, v_cuenta.id, v_uid, v_turno, trim(p_motivo));

  if v_cant = v_item.cantidad then
    delete from public.cuenta_items where id = p_item_id;
  else
    update public.cuenta_items set cantidad = cantidad - v_cant where id = p_item_id;
  end if;

  update public.cuentas set total = total - v_monto where id = v_cuenta.id;

  select nombre into v_nombre from public.productos where id = v_item.producto_id;
  perform public.registrar_actividad(
    'eliminado',
    public.etiqueta_cuenta(v_cuenta.id) || ': quitó ' || v_cant || ' ' || v_nombre || ' — ' || trim(p_motivo),
    v_monto, v_cuenta.id, v_turno);
end;
$$;

-- Mueve unidades de un ítem a otra cuenta abierta de la misma mesa.
-- No toca el inventario; queda en auditoria_items como 'movido'.
create function public.mover_item(
  p_item_id bigint,
  p_cuenta_destino_id bigint,
  p_cantidad integer default null,
  p_motivo text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := public.exigir_staff();
  v_turno   bigint := public.exigir_turno_abierto();
  v_item    public.cuenta_items;
  v_origen  public.cuentas;
  v_destino public.cuentas;
  v_cant    integer;
  v_monto   integer;
  v_nombre  text;
begin
  select cuenta_id into v_item.cuenta_id from public.cuenta_items where id = p_item_id;
  if v_item.cuenta_id is null then
    raise exception 'El ítem ya no existe.';
  end if;
  if v_item.cuenta_id = p_cuenta_destino_id then
    raise exception 'El ítem ya está en esa cuenta.';
  end if;

  -- Bloqueo en orden de id para evitar bloqueos cruzados.
  perform 1 from public.cuentas
  where id in (v_item.cuenta_id, p_cuenta_destino_id)
  order by id
  for update;

  v_origen  := public.interno_bloquear_cuenta(v_item.cuenta_id, v_turno);
  v_destino := public.interno_bloquear_cuenta(p_cuenta_destino_id, v_turno);

  if v_origen.mesa_id is null or v_origen.mesa_id is distinct from v_destino.mesa_id then
    raise exception 'Solo se pueden mover ítems entre cuentas de la misma mesa.';
  end if;

  select * into v_item from public.cuenta_items where id = p_item_id for update;
  if not found then
    raise exception 'El ítem ya no existe.';
  end if;

  v_cant := coalesce(p_cantidad, v_item.cantidad);
  if v_cant < 1 or v_cant > v_item.cantidad then
    raise exception 'Cantidad inválida: el ítem tiene % unidad(es).', v_item.cantidad;
  end if;

  v_monto := v_cant * v_item.precio_unitario;
  if v_origen.total - v_monto < v_origen.pagado then
    raise exception 'No se puede mover: la cuenta "%" ya tiene pagos por % y su saldo quedaría negativo.',
      v_origen.nombre, public.pesos(v_origen.pagado);
  end if;

  if v_cant = v_item.cantidad then
    delete from public.cuenta_items where id = p_item_id;
  else
    update public.cuenta_items set cantidad = cantidad - v_cant where id = p_item_id;
  end if;

  insert into public.cuenta_items (cuenta_id, producto_id, cantidad, precio_unitario, sin_stock, agregado_por)
  values (p_cuenta_destino_id, v_item.producto_id, v_cant, v_item.precio_unitario, v_item.sin_stock, v_uid)
  on conflict (cuenta_id, producto_id, precio_unitario) do update
    set cantidad  = public.cuenta_items.cantidad + excluded.cantidad,
        sin_stock = public.cuenta_items.sin_stock or excluded.sin_stock;

  update public.cuentas set total = total - v_monto where id = v_origen.id;
  update public.cuentas set total = total + v_monto where id = v_destino.id;

  insert into public.auditoria_items
    (tipo, producto_id, cantidad, precio_unitario, cuenta_origen_id, cuenta_destino_id, usuario_id, turno_id, motivo)
  values
    ('movido', v_item.producto_id, v_cant, v_item.precio_unitario, v_origen.id, v_destino.id, v_uid, v_turno,
     nullif(trim(p_motivo), ''));

  select nombre into v_nombre from public.productos where id = v_item.producto_id;
  perform public.registrar_actividad(
    'movido',
    public.etiqueta_cuenta(v_origen.id) || ' → ' || v_destino.nombre || ': ' || v_cant || ' ' || v_nombre,
    v_monto, v_origen.id, v_turno);
end;
$$;

-- ---------------------------------------------------------------------------
-- Pagos
-- ---------------------------------------------------------------------------

-- Registra un pago (saldo completo, abono o una parte de una división).
-- Si con el pago el saldo llega a 0 y p_cerrar es true, la cuenta pasa a
-- 'pagada'. Con p_cerrar = false (abono por rondas) queda abierta en $ 0.
create function public.registrar_pago(
  p_cuenta_id bigint,
  p_monto integer,
  p_metodo text,
  p_cerrar boolean default true
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := public.exigir_staff();
  v_turno  bigint := public.exigir_turno_abierto();
  v_cuenta public.cuentas := public.interno_bloquear_cuenta(p_cuenta_id, v_turno);
  v_saldo  integer := v_cuenta.total - v_cuenta.pagado;
  v_pago   bigint;
begin
  if p_metodo is null or p_metodo not in ('efectivo', 'daviplata', 'bre_b') then
    raise exception 'Elige el método de pago: Efectivo, Daviplata o Bre-B.';
  end if;
  if v_saldo <= 0 then
    raise exception 'La cuenta no tiene saldo pendiente.';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a $ 0.';
  end if;
  if p_monto > v_saldo then
    raise exception 'El monto (%) es mayor que el saldo pendiente (%).', public.pesos(p_monto), public.pesos(v_saldo);
  end if;

  insert into public.pagos (cuenta_id, turno_id, monto, metodo, registrado_por)
  values (p_cuenta_id, v_turno, p_monto, p_metodo, v_uid)
  returning id into v_pago;

  update public.cuentas
     set pagado = pagado + p_monto,
         estado = case when p_cerrar and pagado + p_monto = total then 'pagada' else estado end,
         cerrada_en = case when p_cerrar and pagado + p_monto = total then now() else cerrada_en end
   where id = p_cuenta_id
  returning * into v_cuenta;

  perform public.registrar_actividad(
    'pago',
    'Pago ' || public.etiqueta_metodo(p_metodo) || ' — ' || public.etiqueta_cuenta(p_cuenta_id)
      || case when v_cuenta.estado = 'pagada' then ' (cuenta cerrada)' else '' end,
    p_monto, p_cuenta_id, v_turno);

  return jsonb_build_object(
    'pago_id', v_pago,
    'saldo', v_cuenta.total - v_cuenta.pagado,
    'estado', v_cuenta.estado
  );
end;
$$;

-- Venta rápida: crea una cuenta sin mesa, agrega los productos, la cobra
-- completa y la cierra, todo en un paso.
-- p_items: [{"producto_id": 1, "cantidad": 2}, ...]
create function public.venta_rapida(p_items jsonb, p_metodo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := public.exigir_staff();
  v_turno     bigint := public.exigir_turno_abierto();
  v_cuenta    public.cuentas;
  v_item      record;
  v_res       jsonb;
  v_sin_stock text[] := '{}';
  v_detalle   text;
begin
  if p_metodo is null or p_metodo not in ('efectivo', 'daviplata', 'bre_b') then
    raise exception 'Elige el método de pago: Efectivo, Daviplata o Bre-B.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;

  insert into public.cuentas (mesa_id, turno_id, nombre, creada_por)
  values (null, v_turno, 'Venta rápida', v_uid)
  returning * into v_cuenta;

  for v_item in
    select (e ->> 'producto_id')::bigint as producto_id, (e ->> 'cantidad')::integer as cantidad
    from jsonb_array_elements(p_items) e
  loop
    v_res := public.interno_agregar_item(v_cuenta.id, v_item.producto_id, v_item.cantidad, v_uid, v_turno, false);
    if (v_res ->> 'sin_stock')::boolean then
      v_sin_stock := v_sin_stock || (v_res ->> 'producto');
    end if;
  end loop;

  select * into v_cuenta from public.cuentas where id = v_cuenta.id;

  if v_cuenta.total > 0 then
    insert into public.pagos (cuenta_id, turno_id, monto, metodo, registrado_por)
    values (v_cuenta.id, v_turno, v_cuenta.total, p_metodo, v_uid);
  end if;

  update public.cuentas
     set pagado = total, estado = 'pagada', cerrada_en = now()
   where id = v_cuenta.id
  returning * into v_cuenta;

  select string_agg(ci.cantidad || ' ' || p.nombre, ', ' order by ci.id)
    into v_detalle
  from public.cuenta_items ci
  join public.productos p on p.id = ci.producto_id
  where ci.cuenta_id = v_cuenta.id;

  perform public.registrar_actividad(
    'pago',
    'Venta rápida (' || public.etiqueta_metodo(p_metodo) || '): ' || v_detalle
      || case when cardinality(v_sin_stock) > 0
              then ' (SIN STOCK: ' || array_to_string(v_sin_stock, ', ') || ')' else '' end,
    v_cuenta.total, v_cuenta.id, v_turno);

  return jsonb_build_object(
    'cuenta_id', v_cuenta.id,
    'total', v_cuenta.total,
    'sin_stock', to_jsonb(v_sin_stock)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Inventario
-- ---------------------------------------------------------------------------

-- Entrada de mercancía o merma (operador y admin), o ajuste (solo admin).
-- p_cantidad: positiva para entrada y merma; con signo para ajuste.
create function public.registrar_movimiento(
  p_producto_id bigint,
  p_tipo text,
  p_cantidad integer,
  p_motivo text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := public.exigir_staff();
  v_motivo text := nullif(trim(p_motivo), '');
  v_mov    public.movimientos_inv;
  v_nombre text;
  v_texto  text;
begin
  select nombre into v_nombre from public.productos where id = p_producto_id;
  if v_nombre is null then
    raise exception 'El producto no existe.';
  end if;
  if p_cantidad is null or p_cantidad = 0 then
    raise exception 'La cantidad no puede ser 0.';
  end if;

  if p_tipo = 'entrada' then
    if p_cantidad < 0 then
      raise exception 'La cantidad de una entrada debe ser positiva.';
    end if;
    insert into public.movimientos_inv (producto_id, tipo, cantidad, usuario_id, motivo)
    values (p_producto_id, 'entrada', p_cantidad, v_uid, v_motivo)
    returning * into v_mov;
    v_texto := 'Entrada: +' || p_cantidad || ' ' || v_nombre;

  elsif p_tipo = 'merma' then
    if p_cantidad < 0 then
      raise exception 'Escribe la cantidad de la merma como número positivo.';
    end if;
    if v_motivo is null then
      raise exception 'Escribe el motivo de la merma.';
    end if;
    insert into public.movimientos_inv (producto_id, tipo, cantidad, usuario_id, motivo)
    values (p_producto_id, 'merma', -p_cantidad, v_uid, v_motivo)
    returning * into v_mov;
    v_texto := 'Merma: -' || p_cantidad || ' ' || v_nombre;

  elsif p_tipo = 'ajuste' then
    perform public.exigir_admin();
    if v_motivo is null then
      raise exception 'Escribe el motivo del ajuste.';
    end if;
    insert into public.movimientos_inv (producto_id, tipo, cantidad, usuario_id, motivo)
    values (p_producto_id, 'ajuste', p_cantidad, v_uid, v_motivo)
    returning * into v_mov;
    v_texto := 'Ajuste: ' || case when p_cantidad > 0 then '+' else '' end || p_cantidad || ' ' || v_nombre;

  else
    raise exception 'Tipo de movimiento inválido. Las ventas y devoluciones se registran desde las cuentas.';
  end if;

  perform public.registrar_actividad(
    p_tipo,
    v_texto || ' (stock: ' || v_mov.stock_resultante || ')' || coalesce(' — ' || v_motivo, ''),
    null, null, v_mov.turno_id);

  return jsonb_build_object('movimiento_id', v_mov.id, 'stock_resultante', v_mov.stock_resultante);
end;
$$;

-- Ajuste por conteo físico (solo admin): se indica el stock real contado y el
-- sistema registra la diferencia como ajuste.
create function public.ajustar_stock(p_producto_id bigint, p_stock_real integer, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_prod public.productos;
begin
  perform public.exigir_admin();
  if p_stock_real is null then
    raise exception 'Ingresa el stock real contado.';
  end if;

  select * into v_prod from public.productos where id = p_producto_id for update;
  if not found then
    raise exception 'El producto no existe.';
  end if;
  if v_prod.descuenta_de is not null then
    raise exception '"%" no tiene stock propio; ajusta el producto base.', v_prod.nombre;
  end if;
  if p_stock_real = v_prod.stock_actual then
    return jsonb_build_object('movimiento_id', null, 'stock_resultante', v_prod.stock_actual);
  end if;

  return public.registrar_movimiento(
    p_producto_id, 'ajuste', p_stock_real - v_prod.stock_actual,
    coalesce(nullif(trim(p_motivo), ''), 'Conteo físico'));
end;
$$;
