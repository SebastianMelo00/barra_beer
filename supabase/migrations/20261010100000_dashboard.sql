-- =============================================================================
-- La Barra Beer — Fase 4: datos del dashboard de la admin
-- Una sola llamada trae todo lo que la dueña ve en el celular; la pantalla la
-- repite cada vez que Realtime avisa de un cambio.
-- =============================================================================

create function public.datos_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_turno bigint := public.turno_abierto_id();
begin
  perform public.exigir_admin();

  return jsonb_build_object(
    'turno',
      case when v_turno is null then null else public.interno_resumen_turno(v_turno) end,

    -- Lo consumido (cuentas no anuladas) frente a lo cobrado.
    'consumo',
      coalesce((select sum(total) from public.cuentas where turno_id = v_turno and estado <> 'anulada'), 0),

    'cuentas_abiertas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'nombre', c.nombre,
               'mesa_id', c.mesa_id,
               'mesa', m.nombre,
               'total', c.total,
               'pagado', c.pagado,
               'abierta_en', c.abierta_en
             ) order by m.orden_visual, c.abierta_en)
      from public.cuentas c
      left join public.mesas m on m.id = c.mesa_id
      where c.turno_id = v_turno and c.estado = 'abierta'
    ), '[]'::jsonb),

    'mas_vendidos', coalesce((
      select jsonb_agg(x order by x.cantidad desc, x.total desc)
      from (
        select p.id as producto_id, p.nombre, p.imagen,
               sum(ci.cantidad)::integer as cantidad,
               sum(ci.cantidad * ci.precio_unitario)::integer as total
        from public.cuenta_items ci
        join public.cuentas c on c.id = ci.cuenta_id
        join public.productos p on p.id = ci.producto_id
        where c.turno_id = v_turno and c.estado <> 'anulada'
        group by p.id
        order by cantidad desc, total desc
        limit 8
      ) x
    ), '[]'::jsonb),

    'stock_bajo', coalesce((
      select jsonb_agg(jsonb_build_object(
               'producto_id', id,
               'nombre', nombre,
               'imagen', imagen,
               'stock_actual', stock_actual,
               'stock_minimo', stock_minimo
             ) order by stock_actual, nombre)
      from public.productos
      where descuenta_de is null and activo and stock_actual <= stock_minimo
    ), '[]'::jsonb),

    'ventas_sin_stock', coalesce((
      select jsonb_agg(x order by x.creado_en desc)
      from (
        select mv.id, mv.creado_en, p.nombre, -mv.cantidad as cantidad, mv.stock_resultante,
               public.etiqueta_cuenta(mv.cuenta_id) as cuenta
        from public.movimientos_inv mv
        join public.productos p on p.id = mv.producto_id
        where mv.turno_id = v_turno and mv.tipo = 'venta' and mv.sin_stock
        order by mv.creado_en desc
        limit 20
      ) x
    ), '[]'::jsonb),

    'generado_en', now()
  );
end;
$$;

revoke execute on function public.datos_dashboard() from public, anon;
grant execute on function public.datos_dashboard() to authenticated;
