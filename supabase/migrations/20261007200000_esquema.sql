-- =============================================================================
-- La Barra Beer — 1/5 Esquema de tablas
-- Montos en pesos colombianos (COP) enteros, sin decimales.
-- Todas las fechas son timestamptz; la app las muestra en America/Bogota.
-- =============================================================================

-- Perfiles: uno por usuario de Supabase Auth. Se crean a mano (ver README).
create table public.perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  nombre    text not null check (length(trim(nombre)) > 0),
  rol       text not null check (rol in ('admin', 'operador')),
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Productos. Si descuenta_de no es null, el producto NO tiene stock propio:
-- al venderlo se descuentan factor_descuento unidades del producto base.
create table public.productos (
  id               bigint generated always as identity primary key,
  nombre           text not null check (length(trim(nombre)) > 0),
  categoria        text not null check (length(trim(categoria)) > 0),
  precio_venta     integer not null check (precio_venta >= 0),
  costo            integer check (costo >= 0),
  stock_actual     integer not null default 0,
  stock_minimo     integer not null default 0 check (stock_minimo >= 0),
  activo           boolean not null default true,
  descuenta_de     bigint references public.productos (id),
  factor_descuento integer not null default 1 check (factor_descuento >= 1),
  orden            integer not null default 0,
  creado_en        timestamptz not null default now(),
  constraint productos_no_descuenta_de_si_mismo check (descuenta_de is null or descuenta_de <> id)
);
create unique index productos_nombre_unico on public.productos (lower(nombre));
create index productos_descuenta_de on public.productos (descuenta_de);

create table public.mesas (
  id           bigint generated always as identity primary key,
  nombre       text not null unique,
  orden_visual integer not null default 0,
  es_barra     boolean not null default false
);

create table public.turnos (
  id                bigint generated always as identity primary key,
  operador_id       uuid not null references public.perfiles (id),
  inicio            timestamptz not null default now(),
  fin               timestamptz,
  base_caja         integer not null check (base_caja >= 0),
  efectivo_esperado integer,          -- base_caja + pagos en efectivo (se guarda al cerrar)
  efectivo_contado  integer check (efectivo_contado >= 0),
  diferencia        integer,          -- efectivo_contado - efectivo_esperado
  notas             text,
  estado            text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  cerrado_por       uuid references public.perfiles (id),
  constraint turnos_cierre_completo check (
    estado = 'abierto'
    or (fin is not null and efectivo_esperado is not null and efectivo_contado is not null and diferencia is not null)
  )
);
-- Solo un turno abierto a la vez.
create unique index turnos_un_solo_abierto on public.turnos (estado) where estado = 'abierto';
create index turnos_inicio on public.turnos (inicio desc);

-- Cuentas. mesa_id null = venta rápida. "pagado" es la suma de los pagos de la
-- cuenta (lo mantienen las funciones RPC) y saldo = total - pagado.
create table public.cuentas (
  id               bigint generated always as identity primary key,
  mesa_id          bigint references public.mesas (id),
  turno_id         bigint not null references public.turnos (id),
  nombre           text not null check (length(trim(nombre)) between 1 and 40),
  estado           text not null default 'abierta' check (estado in ('abierta', 'pagada', 'anulada')),
  total            integer not null default 0 check (total >= 0),
  pagado           integer not null default 0 check (pagado >= 0),
  abierta_en       timestamptz not null default now(),
  cerrada_en       timestamptz,
  creada_por       uuid references public.perfiles (id),
  anulada_por      uuid references public.perfiles (id),
  motivo_anulacion text,
  -- Nunca se paga más que el total, y nunca se quitan ítems ya pagados.
  constraint cuentas_pagado_no_supera_total check (pagado <= total),
  constraint cuentas_anulacion_con_motivo check (
    estado <> 'anulada' or (anulada_por is not null and length(trim(coalesce(motivo_anulacion, ''))) > 0)
  )
);
create index cuentas_turno on public.cuentas (turno_id);
create index cuentas_abiertas_por_mesa on public.cuentas (mesa_id) where estado = 'abierta';

-- Ítems de una cuenta. Clics repetidos del mismo producto (al mismo precio)
-- suman cantidad en la misma línea.
create table public.cuenta_items (
  id              bigint generated always as identity primary key,
  cuenta_id       bigint not null references public.cuentas (id),
  producto_id     bigint not null references public.productos (id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0), -- congelado al agregar
  sin_stock       boolean not null default false,                -- se vendió sin stock suficiente
  agregado_por    uuid references public.perfiles (id),
  creado_en       timestamptz not null default now(),
  constraint cuenta_items_linea_unica unique (cuenta_id, producto_id, precio_unitario)
);

create table public.pagos (
  id             bigint generated always as identity primary key,
  cuenta_id      bigint not null references public.cuentas (id),
  turno_id       bigint not null references public.turnos (id),
  monto          integer not null check (monto > 0),
  metodo         text not null check (metodo in ('efectivo', 'daviplata', 'bre_b')),
  registrado_por uuid references public.perfiles (id),
  creado_en      timestamptz not null default now()
);
create index pagos_cuenta on public.pagos (cuenta_id);
create index pagos_turno on public.pagos (turno_id);

-- Movimientos de inventario: la ÚNICA forma de cambiar productos.stock_actual.
-- producto_id es el producto del movimiento (ej. "Six pack Poker", -1).
-- stock_producto_id / stock_cantidad dicen qué stock cambió realmente y en
-- cuánto (ej. "Poker", -6). Los llena el trigger; no se envían desde la app.
create table public.movimientos_inv (
  id                bigint generated always as identity primary key,
  producto_id       bigint not null references public.productos (id),
  tipo              text not null check (tipo in ('entrada', 'venta', 'devolucion', 'merma', 'ajuste')),
  cantidad          integer not null check (cantidad <> 0),
  stock_producto_id bigint not null references public.productos (id),
  stock_cantidad    integer not null,
  stock_resultante  integer not null,
  sin_stock         boolean not null default false, -- venta que dejó el stock en negativo
  usuario_id        uuid references public.perfiles (id),
  cuenta_id         bigint references public.cuentas (id),
  turno_id          bigint references public.turnos (id),
  motivo            text,
  creado_en         timestamptz not null default now(),
  constraint movimientos_signo check (
    (tipo in ('entrada', 'devolucion') and cantidad > 0)
    or (tipo in ('venta', 'merma') and cantidad < 0)
    or tipo = 'ajuste'
  ),
  constraint movimientos_motivo check (
    tipo not in ('merma', 'ajuste') or length(trim(coalesce(motivo, ''))) > 0
  )
);
create index movimientos_producto on public.movimientos_inv (producto_id, creado_en desc);
create index movimientos_stock_producto on public.movimientos_inv (stock_producto_id, creado_en desc);
create index movimientos_turno on public.movimientos_inv (turno_id);
create index movimientos_fecha on public.movimientos_inv (creado_en desc);

-- Ítems quitados de una cuenta o movidos entre cuentas.
create table public.auditoria_items (
  id                bigint generated always as identity primary key,
  tipo              text not null check (tipo in ('eliminado', 'movido')),
  producto_id       bigint not null references public.productos (id),
  cantidad          integer not null check (cantidad > 0),
  precio_unitario   integer not null,
  cuenta_origen_id  bigint not null references public.cuentas (id),
  cuenta_destino_id bigint references public.cuentas (id),
  usuario_id        uuid references public.perfiles (id),
  turno_id          bigint references public.turnos (id),
  motivo            text,
  creado_en         timestamptz not null default now(),
  constraint auditoria_eliminado_con_motivo check (
    tipo <> 'eliminado' or length(trim(coalesce(motivo, ''))) > 0
  ),
  constraint auditoria_movido_con_destino check (tipo <> 'movido' or cuenta_destino_id is not null)
);
create index auditoria_turno on public.auditoria_items (turno_id);

-- Feed de actividad en vivo para el dashboard de la admin. Lo escriben solo
-- las funciones RPC.
create table public.actividad (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in (
                'venta', 'pago', 'eliminado', 'movido', 'anulacion',
                'entrada', 'merma', 'ajuste', 'turno')),
  descripcion text not null,
  monto       integer,
  cuenta_id   bigint,
  turno_id    bigint references public.turnos (id),
  usuario_id  uuid references public.perfiles (id),
  creado_en   timestamptz not null default now()
);
create index actividad_fecha on public.actividad (creado_en desc);
create index actividad_turno on public.actividad (turno_id);
