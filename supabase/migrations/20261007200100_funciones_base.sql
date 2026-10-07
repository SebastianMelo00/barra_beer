-- =============================================================================
-- La Barra Beer — 2/5 Funciones auxiliares y triggers de inventario
-- Todas las funciones security definer fijan search_path = '' y usan nombres
-- calificados (public.x) para que nadie pueda secuestrarlas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Rol del usuario actual (las usan las políticas RLS y las RPC)
-- ---------------------------------------------------------------------------
create function public.mi_rol()
returns text
language sql stable security definer set search_path = ''
as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo and rol = 'admin')
$$;

create function public.es_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo)
$$;

create function public.turno_abierto_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select id from public.turnos where estado = 'abierto' limit 1
$$;

-- ---------------------------------------------------------------------------
-- Validaciones que lanzan error con mensaje en español
-- ---------------------------------------------------------------------------
create function public.exigir_staff()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_staff() then
    raise exception 'No tienes permiso para esta acción. Inicia sesión de nuevo.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function public.exigir_admin()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Esta acción es solo para administradores.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- Devuelve el turno abierto y lo bloquea en modo compartido, para que nadie
-- pueda cerrarlo mientras se completa la operación en curso.
create function public.exigir_turno_abierto()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  select id into v_id from public.turnos where estado = 'abierto' for share;
  if v_id is null then
    raise exception 'No hay un turno abierto. Abre el turno para empezar a vender.';
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Formato y etiquetas para el feed de actividad
-- ---------------------------------------------------------------------------
create function public.pesos(p_valor integer)
returns text
language sql immutable set search_path = ''
as $$
  select case when p_valor < 0 then '-' else '' end
      || '$ ' || replace(to_char(abs(p_valor), 'FM999,999,999,990'), ',', '.')
$$;

create function public.etiqueta_metodo(p_metodo text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_metodo
    when 'efectivo' then 'Efectivo'
    when 'daviplata' then 'Daviplata'
    when 'bre_b' then 'Bre-B'
    else p_metodo
  end
$$;

-- "Mesa 3 · Juan", o "Venta rápida" si no tiene mesa.
create function public.etiqueta_cuenta(p_cuenta_id bigint)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when m.id is null then c.nombre else m.nombre || ' · ' || c.nombre end
  from public.cuentas c
  left join public.mesas m on m.id = c.mesa_id
  where c.id = p_cuenta_id
$$;

create function public.registrar_actividad(
  p_tipo text,
  p_descripcion text,
  p_monto integer,
  p_cuenta_id bigint,
  p_turno_id bigint
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.actividad (tipo, descripcion, monto, cuenta_id, turno_id, usuario_id)
  values (p_tipo, p_descripcion, p_monto, p_cuenta_id, p_turno_id, auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Trigger: cada movimiento de inventario actualiza el stock del producto que
-- realmente cambia (respetando descuenta_de y factor_descuento).
-- ---------------------------------------------------------------------------
create function public.tg_movimiento_aplicar_stock()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_base   bigint;
  v_factor integer;
begin
  select coalesce(p.descuenta_de, p.id),
         case when p.descuenta_de is null then 1 else p.factor_descuento end
    into v_base, v_factor
  from public.productos p
  where p.id = new.producto_id;

  if v_base is null then
    raise exception 'El producto % no existe.', new.producto_id;
  end if;

  new.stock_producto_id := v_base;
  new.stock_cantidad    := new.cantidad * v_factor;
  new.turno_id          := coalesce(new.turno_id, public.turno_abierto_id());
  new.creado_en         := now();

  update public.productos
     set stock_actual = stock_actual + new.stock_cantidad
   where id = v_base
  returning stock_actual into new.stock_resultante;

  -- Se permite vender sin stock, pero queda marcado.
  new.sin_stock := new.tipo = 'venta' and new.stock_resultante < 0;
  return new;
end;
$$;

create trigger movimientos_aplicar_stock
before insert on public.movimientos_inv
for each row execute function public.tg_movimiento_aplicar_stock();

-- Los movimientos son un historial: no se editan ni se borran.
create function public.tg_movimiento_inmutable()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Los movimientos de inventario no se pueden modificar ni borrar. Registra un ajuste.';
end;
$$;

create trigger movimientos_inmutables
before update or delete on public.movimientos_inv
for each row execute function public.tg_movimiento_inmutable();

-- ---------------------------------------------------------------------------
-- Trigger: protege productos.stock_actual y la relación descuenta_de.
-- El stock solo cambia desde el trigger de movimientos (pg_trigger_depth > 1),
-- ni siquiera desde el SQL Editor.
-- ---------------------------------------------------------------------------
create function public.tg_productos_validar()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.stock_actual <> 0 then
    raise exception 'Los productos se crean con stock 0. Carga el stock con una entrada de inventario.';
  end if;

  if tg_op = 'UPDATE' and new.stock_actual is distinct from old.stock_actual and pg_trigger_depth() < 2 then
    raise exception 'El stock no se edita directamente: registra una entrada, merma o ajuste.';
  end if;

  if new.descuenta_de is not null then
    if exists (select 1 from public.productos where id = new.descuenta_de and descuenta_de is not null) then
      raise exception 'El producto base no puede descontar a su vez de otro producto.';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.productos where descuenta_de = new.id) then
      raise exception 'Este producto es base de otros productos; no puede descontar de otro.';
    end if;
    if new.stock_actual <> 0 then
      raise exception 'Este producto tiene stock propio (%). Llévalo a 0 con un ajuste antes de hacerlo descontar de otro.', new.stock_actual;
    end if;
  end if;

  return new;
end;
$$;

create trigger productos_validar
before insert or update on public.productos
for each row execute function public.tg_productos_validar();
