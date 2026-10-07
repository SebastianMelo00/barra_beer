-- =============================================================================
-- La Barra Beer — Fase 3: imágenes de productos y resumen de turnos
-- =============================================================================

-- Imagen de cada producto (ruta dentro de /public, ej. /productos/poker.webp).
alter table public.productos add column imagen text;
grant insert (imagen), update (imagen) on public.productos to authenticated;

-- Imágenes de los productos iniciales (si ya se corrió el seed).
update public.productos p
   set imagen = v.imagen
  from (values
  ('Club Colombia Dorada', '/productos/club-colombia-dorada.webp'),
  ('Agua', '/productos/agua.webp'),
  ('Agua con gas', '/productos/agua-con-gas.webp'),
  ('Águila', '/productos/aguila.webp'),
  ('Águila Light', '/productos/aguila-light.webp'),
  ('Botella Aguardiente Amarillo', '/productos/botella-aguardiente-amarillo.webp'),
  ('Bretaña', '/productos/bretana.webp'),
  ('Budweiser', '/productos/budweiser.webp'),
  ('Lucky Blanco', '/productos/lucky-blanco.webp'),
  ('Marlboro Fusión', '/productos/marlboro-fusion.webp'),
  ('Marlboro Rojo', '/productos/marlboro-rojo.webp'),
  ('Marlboro Sandía', '/productos/marlboro-sandia.webp'),
  ('Mustang', '/productos/mustang.webp'),
  ('Coca-Cola', '/productos/coca-cola.webp'),
  ('Corona', '/productos/corona.webp'),
  ('Coronita', '/productos/coronita.webp'),
  ('Costeña Bacana', '/productos/costena-bacana.webp'),
  ('Gatorade', '/productos/gatorade.webp'),
  ('Heineken', '/productos/heineken.webp'),
  ('Media Aguardiente Amarillo', '/productos/media-aguardiente-amarillo.webp'),
  ('Media Antioqueño Azul', '/productos/media-antioqueno-azul.webp'),
  ('Media Néctar Rojo', '/productos/media-nectar-rojo.webp'),
  ('Media Néctar Verde', '/productos/media-nectar-verde.webp'),
  ('Poker', '/productos/poker.webp'),
  ('Six pack Águila', '/productos/six-pack-aguila.webp'),
  ('Six pack Poker', '/productos/six-pack-poker.webp'),
  ('Todo Rico Natural', '/productos/todo-rico-natural.webp'),
  ('Todo Rico BBQ', '/productos/todo-rico-bbq.webp')
  ) as v (nombre, imagen)
 where p.nombre = v.nombre and p.imagen is null;

-- Resumen de cada turno para el historial de la admin. security_invoker hace
-- que la vista respete el RLS de quien consulta (el operador solo ve el
-- turno abierto; la admin, todos).
create view public.turnos_resumen
with (security_invoker = true)
as
select
  t.id,
  t.operador_id,
  op.nombre as operador,
  t.inicio,
  t.fin,
  t.estado,
  t.base_caja,
  t.efectivo_esperado,
  t.efectivo_contado,
  t.diferencia,
  t.notas,
  coalesce(pg.efectivo, 0)  as total_efectivo,
  coalesce(pg.daviplata, 0) as total_daviplata,
  coalesce(pg.bre_b, 0)     as total_bre_b,
  coalesce(pg.total, 0)     as total_pagos,
  coalesce(cu.pagadas, 0)   as cuentas_pagadas,
  coalesce(cu.anuladas, 0)  as cuentas_anuladas,
  coalesce(au.eliminados, 0) as items_eliminados
from public.turnos t
left join public.perfiles op on op.id = t.operador_id
left join lateral (
  select sum(monto) filter (where metodo = 'efectivo')  as efectivo,
         sum(monto) filter (where metodo = 'daviplata') as daviplata,
         sum(monto) filter (where metodo = 'bre_b')     as bre_b,
         sum(monto) as total
  from public.pagos where turno_id = t.id
) pg on true
left join lateral (
  select count(*) filter (where estado = 'pagada')  as pagadas,
         count(*) filter (where estado = 'anulada') as anuladas
  from public.cuentas where turno_id = t.id
) cu on true
left join lateral (
  select count(*) as eliminados
  from public.auditoria_items where turno_id = t.id and tipo = 'eliminado'
) au on true;

revoke all on public.turnos_resumen from anon, authenticated;
grant select on public.turnos_resumen to authenticated;
