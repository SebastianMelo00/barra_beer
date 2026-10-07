-- =============================================================================
-- La Barra Beer — Fase 2: operaciones de inventario en lote
-- Cargar un pedido completo de mercancía o un conteo físico de muchos
-- productos en un solo paso (y en una sola transacción).
-- =============================================================================

-- Entrada de mercancía de varios productos (operador y admin).
-- p_items: [{"producto_id": 1, "cantidad": 24}, ...] (cantidades positivas)
create function public.registrar_entrada_lote(p_items jsonb, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := public.exigir_staff();
  v_motivo  text := nullif(trim(p_motivo), '');
  v_item    record;
  v_mov     public.movimientos_inv;
  v_partes  text[] := '{}';
  v_turno   bigint;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Escribe la cantidad de al menos un producto.';
  end if;

  for v_item in
    select (e ->> 'producto_id')::bigint as producto_id, (e ->> 'cantidad')::integer as cantidad
    from jsonb_array_elements(p_items) e
  loop
    if v_item.cantidad is null or v_item.cantidad <= 0 then
      raise exception 'Las cantidades de una entrada deben ser mayores a 0.';
    end if;
    if not exists (select 1 from public.productos where id = v_item.producto_id) then
      raise exception 'Uno de los productos no existe.';
    end if;

    insert into public.movimientos_inv (producto_id, tipo, cantidad, usuario_id, motivo)
    values (v_item.producto_id, 'entrada', v_item.cantidad, v_uid, v_motivo)
    returning * into v_mov;

    v_turno := v_mov.turno_id;
    v_partes := v_partes || ('+' || v_item.cantidad || ' '
      || (select nombre from public.productos where id = v_item.producto_id));
  end loop;

  perform public.registrar_actividad(
    'entrada',
    'Entrada de mercancía: ' || array_to_string(v_partes, ', ') || coalesce(' — ' || v_motivo, ''),
    null, null, v_turno);

  return jsonb_build_object('productos', cardinality(v_partes));
end;
$$;

-- Conteo físico de varios productos (solo admin): para cada producto se indica
-- el stock real contado y se registra la diferencia como ajuste.
-- p_items: [{"producto_id": 1, "stock_real": 30}, ...]
create function public.ajustar_stock_lote(p_items jsonb, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := public.exigir_admin();
  v_motivo  text := coalesce(nullif(trim(p_motivo), ''), 'Conteo físico');
  v_item    record;
  v_prod    public.productos;
  v_dif     integer;
  v_partes  text[] := '{}';
  v_turno   bigint := public.turno_abierto_id();
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Escribe el conteo de al menos un producto.';
  end if;

  for v_item in
    select (e ->> 'producto_id')::bigint as producto_id, (e ->> 'stock_real')::integer as stock_real
    from jsonb_array_elements(p_items) e
  loop
    if v_item.stock_real is null then
      raise exception 'Falta el stock contado de un producto.';
    end if;

    select * into v_prod from public.productos where id = v_item.producto_id for update;
    if not found then
      raise exception 'Uno de los productos no existe.';
    end if;
    if v_prod.descuenta_de is not null then
      raise exception '"%" no tiene stock propio; cuenta el producto base.', v_prod.nombre;
    end if;

    v_dif := v_item.stock_real - v_prod.stock_actual;
    if v_dif <> 0 then
      insert into public.movimientos_inv (producto_id, tipo, cantidad, usuario_id, motivo)
      values (v_prod.id, 'ajuste', v_dif, v_uid, v_motivo);
      v_partes := v_partes || (v_prod.nombre || ' ' || case when v_dif > 0 then '+' else '' end || v_dif
        || ' (queda ' || v_item.stock_real || ')');
    end if;
  end loop;

  if cardinality(v_partes) > 0 then
    perform public.registrar_actividad(
      'ajuste',
      'Conteo físico: ' || array_to_string(v_partes, ', ') || ' — ' || v_motivo,
      null, null, v_turno);
  end if;

  return jsonb_build_object('ajustados', cardinality(v_partes));
end;
$$;

revoke execute on function
  public.registrar_entrada_lote(jsonb, text),
  public.ajustar_stock_lote(jsonb, text)
from public, anon;

grant execute on function
  public.registrar_entrada_lote(jsonb, text),
  public.ajustar_stock_lote(jsonb, text)
to authenticated;
