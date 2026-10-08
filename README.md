# La Barra Beer

Sistema de mesas, ventas e inventario para un bar pequeño en Bogotá. La dueña
(admin) ve en tiempo real, desde el celular, cómo van las ventas, las mesas y el
inventario; la persona de caja (operador) trabaja desde un computador.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Supabase
  (Postgres, Auth, Realtime, RLS).
- **Moneda:** COP sin decimales (`$ 4.000`). **Zona horaria:** America/Bogota.

## Puesta en marcha

### 1. Variables de entorno

Copia `.env.example` como `.env.local` y llena los valores desde Supabase →
**Project Settings → API Keys** (la *publishable key* o la *anon key*) y
**Data API** (la URL del proyecto):

```
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Agrega **las mismas dos variables** en Vercel → *Settings → Environment
Variables* (Production, Preview y Development) y vuelve a desplegar.

> Nunca uses la `service_role` / *secret key* en este proyecto: todo el código
> que llega al navegador usa la llave pública, y la seguridad la ponen RLS y las
> funciones RPC de la base de datos.

### 2. Base de datos

Las migraciones están en `supabase/migrations/` y se aplican **en este orden**:

1. `20261007200000_esquema.sql` — tablas
2. `20261007200100_funciones_base.sql` — roles, triggers de inventario
3. `20261007200200_rpc.sql` — operaciones atómicas (ventas, pagos, turnos…)
4. `20261007200300_seguridad.sql` — RLS y permisos
5. `20261007200400_realtime.sql` — tablas en tiempo real
6. `20261008100000_inventario_lotes.sql` — entradas y conteos de varios productos a la vez (Fase 2)
7. `20261009100000_fase3_imagenes_turnos.sql` — imagen de cada producto y resumen de turnos (Fase 3)

**Opción A — integración Supabase ↔ GitHub (recomendada).** En Supabase →
*Project Settings → Integrations → GitHub*, verifica que el repositorio esté
conectado, que *Supabase directory* sea `.` (la carpeta `supabase/` está en la
raíz) y que **Deploy to production** esté activado con la rama `main`. Así, cada
push a `main` aplica las migraciones nuevas automáticamente.

**Opción B — a mano.** Si no tienes la integración (o *Deploy to production*
está apagado), abre el **SQL Editor** y ejecuta el contenido de cada archivo,
uno por uno, en el orden de arriba. Si usas esta opción, no actives luego
*Deploy to production* sin revisarlo: intentaría crear las tablas otra vez.

**En ambos casos**, el seed **no** se aplica solo en producción: ejecuta
`supabase/seed.sql` en el SQL Editor (se puede correr varias veces sin duplicar).

### 3. Usuarios

1. Supabase → *Authentication → Sign In / Providers*: deja **Email** activo y
   **apaga "Allow new users to sign up"** (nadie debe poder registrarse solo).
2. *Authentication → Users → Add user → Create new user*: crea a la dueña y a
   la persona de caja con correo y contraseña, marcando **Auto Confirm User**.
3. En el SQL Editor, asigna nombre y rol (cambia correos y nombres):

```sql
insert into public.perfiles (id, nombre, rol)
select id, 'Nombre de la dueña', 'admin' from auth.users where email = 'duena@correo.com'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, activo = true;

insert into public.perfiles (id, nombre, rol)
select id, 'Nombre de caja', 'operador' from auth.users where email = 'caja@correo.com'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, activo = true;
```

Para quitarle el acceso a alguien sin perder su historial:
`update public.perfiles set activo = false where id = (select id from auth.users where email = '...');`
(No borres usuarios que ya tienen ventas registradas: la base de datos lo impide
para no perder el historial.)

### 4. Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Cómo está organizado

```
app/
  login/                     ingreso
  (operador)/mesas, turno, inventario    pantallas de caja (computador)
  (admin)/dashboard, productos, turnos   pantallas de la dueña (celular)
components/ui/               componentes propios (botones, campos, marco)
lib/supabase/                clientes de navegador, servidor y proxy
lib/types.ts, lib/formato.ts tipos de las tablas, formato COP y fechas
proxy.ts                     protección de rutas por rol
supabase/migrations/, seed.sql
```

> **`proxy.ts` en vez de `middleware.ts`:** en Next.js 16 el archivo
> `middleware.ts` quedó obsoleto y se llama `proxy.ts`. Hace exactamente lo
> mismo: refresca la sesión y redirige según el rol.

## Seguridad

- La app solo puede **leer** tablas. Toda escritura pasa por funciones RPC
  (`security definer`) que validan el rol y las reglas de negocio en una sola
  transacción. Única excepción: la admin edita productos y mesas directamente.
- `productos.stock_actual` no se puede editar ni desde la app ni desde el SQL
  Editor: solo cambia con movimientos de inventario (trigger).
- El operador solo ve los datos del **turno abierto**; la admin ve todo el
  historial. El feed de actividad es solo para la admin.
- Un usuario sin perfil (o desactivado) no ve ni puede hacer nada.

| Regla | Dónde se hace cumplir |
| --- | --- |
| Operador no edita productos/precios | RLS `admin edita productos` |
| Operador no anula cuentas | RPC `anular_cuenta` → `exigir_admin()` |
| Operador no hace ajustes de inventario | RPC `registrar_movimiento` / `ajustar_stock` |
| Operador no ve turnos anteriores | RLS de turnos, cuentas, ítems, pagos, movimientos |
| Stock nunca se edita directo | permisos por columna + trigger `productos_validar` |
| Sin turno abierto no hay ventas | `exigir_turno_abierto()` en cada RPC |
| No pagar más que el saldo / no dejar saldo negativo | RPC + `check (pagado <= total)` |

## Funciones RPC

| Función | Quién | Qué hace |
| --- | --- | --- |
| `abrir_turno(base_caja)` | staff | Abre el turno (solo uno a la vez) |
| `resumen_turno(turno_id?)` | staff | Totales por método y cuadre (operador: solo el abierto) |
| `cerrar_turno(efectivo_contado, notas?)` | staff | Cierra con cuadre de caja |
| `crear_cuenta(mesa_id, nombre?)` | staff | Nueva cuenta en una mesa ("Cuenta 1", "Cuenta 2"…) |
| `renombrar_cuenta(cuenta_id, nombre)` | staff | Cambia el nombre de la cuenta |
| `agregar_item(cuenta_id, producto_id, cantidad?)` | staff | Agrega y descuenta inventario |
| `quitar_item(item_id, motivo, cantidad?)` | staff | Quita, devuelve stock y audita |
| `mover_item(item_id, cuenta_destino, cantidad?, motivo?)` | staff | Mueve entre cuentas de la misma mesa |
| `registrar_pago(cuenta_id, monto, metodo, cerrar?)` | staff | Cobro, abono o parte de una división |
| `cerrar_cuenta(cuenta_id)` | staff | Cierra una cuenta con saldo $ 0 o vacía |
| `venta_rapida(items, metodo)` | staff | Venta sin mesa en un paso |
| `anular_cuenta(cuenta_id, motivo, devolver_stock?)` | admin | Anula y devuelve stock |
| `registrar_movimiento(producto_id, tipo, cantidad, motivo?)` | staff / admin | Entrada, merma (staff) o ajuste (admin) |
| `ajustar_stock(producto_id, stock_real, motivo)` | admin | Ajuste por conteo físico |
| `registrar_entrada_lote(items, motivo?)` | staff | Entrada de mercancía de varios productos |
| `ajustar_stock_lote(items, motivo?)` | admin | Conteo físico de varios productos |

## Pantallas

### Productos (`/productos`, solo admin)
- Lista por categoría con precio, costo y % de ganancia.
- Flechas ▲▼ para ordenar dentro de la categoría (es el orden en que aparecen al vender).
- Interruptor para activar/desactivar en un toque (un producto inactivo no se puede vender).
- Crear/editar: nombre, categoría, precio, costo, stock mínimo y "no tiene stock
  propio" (descuenta N unidades de otro producto, como los six packs).
- Un producto con ventas o movimientos no se borra: se desactiva.

### Inventario (`/inventario`)
- Stock por categoría con estado (OK, Bajo, Agotado, Revisar conteo si es negativo),
  buscador y filtro de alertas. Se actualiza en vivo.
- **Entrada de mercancía** (caja y admin): varios productos a la vez, con proveedor
  o nota opcional. Ideal para cargar el stock inicial.
- **Merma** (caja y admin): producto, cantidad y motivo (botones rápidos: se rompió,
  se derramó, vencido, cortesía, consumo del personal).
- **Conteo físico** y **Ajustar** (solo admin): se escribe lo que realmente hay y el
  sistema registra la diferencia como ajuste.
- **Historial** (admin): todos los movimientos, filtrables por producto (incluye los
  six packs del producto base), tipo y fechas. Caja solo ve los de su turno.
- Admin ve además el valor del inventario a costo.

### Turno (`/turno`)
- Abrir turno con la base de caja (también aparece directo en Mesas si no hay turno).
- Resumen en vivo: total cobrado y por método (Efectivo, Daviplata, Bre-B), efectivo
  esperado en caja y cuentas abiertas.
- Cerrar turno: se escribe el efectivo contado y se ve al instante si sobra o falta.
  No deja cerrar con cuentas con saldo; las vacías o ya pagadas por abonos se cierran
  solas. Al final muestra el resumen y recuerda verificar Daviplata y Bre-B en el celular.
- En la barra superior siempre se ve si hay turno abierto (punto verde) o no.

### Mesas (`/mesas` y `/mesas/[id]`)
- Cuadrícula de Mesa 1 a 9 + Barra: libre/ocupada, cuentas, saldo y tiempo abierta.
- Botón grande **VENTA RÁPIDA**: productos, método de pago, vueltas y cobrar.
- En la mesa: pestañas con las cuentas abiertas + "Nueva cuenta" (nombre opcional).
  Si la mesa está libre, se abre la primera cuenta con un Enter.
- Productos con foto por categoría. Un clic agrega; varios clics suman y se guardan
  agrupados en segundo plano, así se ven al instante. En el buscador, Enter agrega la
  mejor coincidencia (resaltada).
- Por ítem: **−** quitar (con motivo) y **⇄** mover a otra cuenta de la mesa o a una nueva.
- **COBRAR** (todo el saldo, cierra la cuenta), **ABONAR** (cobro por rondas: aunque
  cubra todo, la cuenta sigue abierta "al día"), **DIVIDIR** en N partes redondeadas
  hacia arriba a $ 100 (la última ajusta). En efectivo calcula las vueltas.
- Admin: **Anular** con motivo, devolviendo o no el stock (cliente que se fue sin pagar).
- Al cerrar la última cuenta, vuelve solo a Mesas.

### Historial de turnos (`/turnos`, solo admin)
- Cada turno con total por método, cuadre (cuadró / sobró / faltó), cuentas anuladas
  e ítems quitados; al tocarlo muestra el detalle con motivos, quién y a qué hora.

### En el celular
- Menú desplegable (☰) con botones grandes.
- Se puede "Agregar a pantalla de inicio" y abre como app con el logo.
