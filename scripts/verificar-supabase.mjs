// Verifica la instalación de La Barra Beer en Supabase y prueba que la persona
// de caja (operador) NO pueda saltarse las reglas llamando a la API directamente.
//
// Uso (desde la carpeta del proyecto):
//   node --env-file=.env.local scripts/verificar-supabase.mjs
//
// Para las pruebas de seguridad, agrega temporalmente a .env.local (o como
// variables de entorno) las credenciales del usuario de caja:
//   OPERADOR_EMAIL=caja@correo.com
//   OPERADOR_PASSWORD=...
// Opcional, para revisar también a la admin: ADMIN_EMAIL y ADMIN_PASSWORD.
//
// Las pruebas no cambian datos: lo que intentan es justo lo que debe fallar, y
// están armadas para que, aun si una regla fallara, no se modifique nada real.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || url.includes('TU-PROYECTO')) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y la llave pública en .env.local.');
  process.exit(1);
}

let fallos = 0;
const ok = (texto) => console.log(`  ✓ ${texto}`);
const mal = (texto, detalle) => {
  fallos++;
  console.log(`  ✗ ${texto}${detalle ? ` → ${detalle}` : ''}`);
};
function revisar(cumple, textoOk, textoMal, detalle) {
  if (cumple) ok(textoOk);
  else mal(textoMal, detalle);
}
const nuevo = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const sinPermiso = (e) => e && (e.code === '42501' || /permission denied|row-level security/i.test(e.message ?? ''));
const noExiste = (e) => e && ['PGRST205', 'PGRST202', '42P01', '42883'].includes(e.code);

const TABLAS = ['perfiles', 'productos', 'mesas', 'turnos', 'cuentas', 'cuenta_items', 'pagos', 'movimientos_inv', 'auditoria_items', 'actividad', 'turnos_resumen'];
const FUNCIONES = {
  abrir_turno: { p_base_caja: 0 },
  registrar_entrada_lote: { p_items: [] },
  datos_dashboard: {},
};

// ---------------------------------------------------------------- instalación
console.log('\n1. Instalación (sin iniciar sesión)');
const anon = nuevo();
for (const t of TABLAS) {
  const { error } = await anon.from(t).select('*').limit(1);
  if (noExiste(error)) mal(`Falta la tabla/vista "${t}": aplica las migraciones`, error.message);
  else if (sinPermiso(error)) ok(`"${t}" existe y no se puede leer sin sesión`);
  else mal(`"${t}" se puede leer SIN sesión`, error?.message ?? 'devolvió datos');
}
for (const [fn, args] of Object.entries(FUNCIONES)) {
  const { error } = await anon.rpc(fn, args);
  if (noExiste(error)) mal(`Falta la función "${fn}": aplica las migraciones`, error.message);
  else if (sinPermiso(error)) ok(`"${fn}" existe y no se puede llamar sin sesión`);
  else mal(`"${fn}" se puede llamar SIN sesión`, error?.message ?? 'respondió');
}

// ---------------------------------------------------------------- operador
async function entrar(email, password) {
  const c = nuevo();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se pudo iniciar sesión con ${email}: ${error.message}`);
  return { c, id: data.user.id };
}

if (process.env.OPERADOR_EMAIL && process.env.OPERADOR_PASSWORD) {
  console.log('\n2. Seguridad: lo que la persona de caja NO debe poder hacer');
  const { c, id } = await entrar(process.env.OPERADOR_EMAIL, process.env.OPERADOR_PASSWORD);

  const perfil = await c.from('perfiles').select('*').eq('id', id).maybeSingle();
  if (perfil.data?.rol === 'operador') ok(`Perfil "${perfil.data.nombre}" con rol operador`);
  else mal('El usuario de prueba no tiene rol operador', JSON.stringify(perfil.data ?? perfil.error));

  const productos = await c.from('productos').select('id, nombre, precio_venta, stock_actual, imagen').order('id');
  const mesas = await c.from('mesas').select('id');
  if ((productos.data?.length ?? 0) > 0 && (mesas.data?.length ?? 0) > 0) {
    ok(`Lee ${productos.data.length} productos y ${mesas.data.length} mesas`);
  } else mal('No hay productos o mesas: corre supabase/seed.sql');
  const sinImagen = (productos.data ?? []).filter((p) => !p.imagen).length;
  if (productos.data?.length) console.log(`    (productos sin imagen: ${sinImagen})`);
  const p = productos.data?.[0];

  if (p) {
    const stock = await c.from('productos').update({ stock_actual: p.stock_actual }).eq('id', p.id);
    revisar(sinPermiso(stock.error), 'No puede editar el stock directamente', 'PUDO editar stock_actual', stock.error?.message);

    const precio = await c.from('productos').update({ precio_venta: p.precio_venta }).eq('id', p.id).select();
    revisar(!precio.error && precio.data?.length === 0, 'No puede cambiar precios', 'PUDO cambiar precios', precio.error?.message);
  }

  const crear = await c.from('productos').insert({ nombre: `PRUEBA SEGURIDAD ${Date.now()}`, categoria: 'Prueba', precio_venta: 1 });
  revisar(sinPermiso(crear.error), 'No puede crear productos', 'PUDO crear un producto (bórralo desde la admin)', crear.error?.message);

  const rol = await c.from('perfiles').update({ rol: 'admin' }).eq('id', id);
  revisar(sinPermiso(rol.error), 'No puede cambiarse el rol a admin', 'PUDO cambiar su rol', rol.error?.message);

  const perfilNuevo = await c.from('perfiles').insert({ id, nombre: 'x', rol: 'admin' });
  revisar(sinPermiso(perfilNuevo.error), 'No puede crear perfiles', 'PUDO crear perfiles', perfilNuevo.error?.message);

  for (const [tabla, fila] of [
    ['pagos', { cuenta_id: -1, turno_id: -1, monto: 1, metodo: 'efectivo' }],
    ['movimientos_inv', { producto_id: -1, tipo: 'entrada', cantidad: 1 }],
    ['cuentas', { turno_id: -1, nombre: 'x' }],
    ['cuenta_items', { cuenta_id: -1, producto_id: -1, cantidad: 1, precio_unitario: 0 }],
    ['actividad', { tipo: 'venta', descripcion: 'x' }],
  ]) {
    const r = await c.from(tabla).insert(fila);
    revisar(sinPermiso(r.error), `No puede escribir directo en "${tabla}"`, `PUDO escribir en "${tabla}"`, r.error?.message);
  }

  const totalCero = await c.from('cuentas').update({ total: 0 }).eq('id', -1);
  revisar(sinPermiso(totalCero.error), 'No puede editar totales de cuentas', 'PUDO editar cuentas', totalCero.error?.message);

  for (const [fn, args, texto] of [
    ['anular_cuenta', { p_cuenta_id: -1, p_motivo: 'prueba' }, 'anular cuentas'],
    ['ajustar_stock', { p_producto_id: -1, p_stock_real: 0, p_motivo: 'prueba' }, 'hacer ajustes de inventario'],
    ['ajustar_stock_lote', { p_items: [] }, 'hacer conteos físicos'],
    ['datos_dashboard', {}, 'ver el dashboard'],
  ]) {
    const { error } = await c.rpc(fn, args);
    revisar(error && /administradores/.test(error.message), `No puede ${texto}`, `PUDO ${texto}`, error?.message ?? 'respondió sin error');
  }

  for (const fn of ['interno_agregar_item', 'registrar_actividad', 'interno_resumen_turno']) {
    const { error } = await c.rpc(fn, {});
    revisar(error && (sinPermiso(error) || noExiste(error)), `No puede llamar "${fn}" (interna)`, `PUDO llamar "${fn}"`, error?.message);
  }

  const actividad = await c.from('actividad').select('id').limit(1);
  revisar(!actividad.error && actividad.data.length === 0, 'No ve el feed de actividad', 'Ve el feed de actividad');

  const cerrados = await c.from('turnos').select('id').eq('estado', 'cerrado').limit(1);
  revisar(!cerrados.error && cerrados.data.length === 0, 'No ve turnos anteriores', 'Ve turnos anteriores');

  const abierto = await c.from('turnos').select('id').eq('estado', 'abierto').maybeSingle();
  const pagos = await c.from('pagos').select('turno_id');
  const ajenos = (pagos.data ?? []).filter((x) => x.turno_id !== abierto.data?.id).length;
  revisar(!pagos.error && ajenos === 0, 'Solo ve pagos del turno abierto', 'Ve pagos de otros turnos', `${ajenos} pagos`);

  const historial = await c.from('turnos_resumen').select('id, estado');
  revisar(!historial.error && historial.data.every((t) => t.estado === 'abierto'), 'El historial de turnos solo le muestra el abierto', 'Ve el historial de turnos');

  await c.auth.signOut();
} else {
  console.log('\n2. Seguridad del operador: omitida (define OPERADOR_EMAIL y OPERADOR_PASSWORD).');
}

// ---------------------------------------------------------------- admin (solo lectura)
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  console.log('\n3. Admin');
  const { c, id } = await entrar(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const perfil = await c.from('perfiles').select('rol').eq('id', id).maybeSingle();
  revisar(perfil.data?.rol === 'admin', 'Perfil con rol admin', 'El usuario no tiene rol admin');
  const dash = await c.rpc('datos_dashboard');
  revisar(!dash.error, 'Ve el dashboard', 'No ve el dashboard', dash.error?.message);
  const act = await c.from('actividad').select('id').limit(1);
  revisar(!act.error, 'Ve el feed de actividad', 'No ve la actividad', act.error?.message);
  await c.auth.signOut();
}

console.log(fallos ? `\n${fallos} problema(s). Revisa los ✗ de arriba.` : '\nTodo en orden ✓');
process.exit(fallos ? 1 : 0);
