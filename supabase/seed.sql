-- =============================================================================
-- La Barra Beer — Datos iniciales
-- Se puede correr varias veces sin duplicar nada.
-- Stock inicial 0: la dueña carga el stock real con una "entrada" de inventario.
-- =============================================================================

insert into public.mesas (nombre, orden_visual, es_barra) values
  ('Mesa 1', 1, false),
  ('Mesa 2', 2, false),
  ('Mesa 3', 3, false),
  ('Mesa 4', 4, false),
  ('Mesa 5', 5, false),
  ('Mesa 6', 6, false),
  ('Mesa 7', 7, false),
  ('Mesa 8', 8, false),
  ('Mesa 9', 9, false),
  ('Barra', 10, true)
on conflict (nombre) do nothing;

-- El campo "orden" define el orden de las categorías y de los productos en
-- pantalla (centenas = categoría).
insert into public.productos (nombre, categoria, precio_venta, stock_minimo, orden) values
  ('Poker',                       'Cervezas',    4000, 24, 101),
  ('Águila',                      'Cervezas',    4000, 24, 102),
  ('Águila Light',                'Cervezas',    4000, 12, 103),
  ('Corona',                      'Cervezas',    6500, 12, 104),
  ('Coronita',                    'Cervezas',    4500, 12, 105),
  ('Heineken',                    'Cervezas',    4000, 12, 106),
  ('Club Colombia Dorada',        'Cervezas',    5000, 12, 107),
  ('Budweiser',                   'Cervezas',    4000, 12, 108),
  ('Costeña Bacana',              'Cervezas',    3500, 12, 109),

  ('Botella Aguardiente Amarillo', 'Licores',   90000,  2, 301),
  ('Media Aguardiente Amarillo',   'Licores',   47000,  3, 302),
  ('Media Néctar Verde',           'Licores',   38000,  2, 303),
  ('Media Néctar Rojo',            'Licores',   40000,  2, 304),
  ('Media Antioqueño Azul',        'Licores',   49000,  2, 305),

  ('Agua',                        'Sin alcohol', 3000,  6, 401),
  ('Agua con gas',                'Sin alcohol', 3500,  6, 402),
  ('Coca-Cola',                   'Sin alcohol', 3500,  6, 403),
  ('Gatorade',                    'Sin alcohol', 4000,  6, 404),
  ('Bretaña',                     'Sin alcohol', 3500,  6, 405),

  ('Todo Rico BBQ',               'Snacks',      4000,  5, 501),
  ('Todo Rico Natural',           'Snacks',      4000,  5, 502),

  ('Lucky Blanco',                'Cigarrillos', 1400, 20, 601),
  ('Marlboro Sandía',             'Cigarrillos', 1400, 20, 602),
  ('Marlboro Fusión',             'Cigarrillos', 1400, 20, 603),
  ('Marlboro Rojo',               'Cigarrillos', 1400, 20, 604),
  ('Mustang',                     'Cigarrillos', 1200, 20, 605)
on conflict do nothing;

-- Six packs: no tienen stock propio, descuentan 6 unidades de la cerveza base.
insert into public.productos (nombre, categoria, precio_venta, stock_minimo, orden, descuenta_de, factor_descuento)
select v.nombre, 'Six packs', 24000, 0, v.orden, p.id, 6
from (values
  ('Six pack Poker', 'Poker', 201),
  ('Six pack Águila', 'Águila', 202)
) as v (nombre, base, orden)
join public.productos p on p.nombre = v.base
on conflict do nothing;
