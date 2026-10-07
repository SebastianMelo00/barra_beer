// Tipos de las tablas de Supabase (ver supabase/migrations).

export type Rol = 'admin' | 'operador';
export type EstadoTurno = 'abierto' | 'cerrado';
export type EstadoCuenta = 'abierta' | 'pagada' | 'anulada';
export type MetodoPago = 'efectivo' | 'daviplata' | 'bre_b';
export type TipoMovimiento = 'entrada' | 'venta' | 'devolucion' | 'merma' | 'ajuste';
export type TipoActividad =
  | 'venta'
  | 'pago'
  | 'eliminado'
  | 'movido'
  | 'anulacion'
  | 'entrada'
  | 'merma'
  | 'ajuste'
  | 'turno';

export type Perfil = {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creado_en: string;
};

export type Producto = {
  id: number;
  nombre: string;
  categoria: string;
  precio_venta: number;
  costo: number | null;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  descuenta_de: number | null;
  factor_descuento: number;
  orden: number;
  creado_en: string;
};

export type Mesa = {
  id: number;
  nombre: string;
  orden_visual: number;
  es_barra: boolean;
};

export type Turno = {
  id: number;
  operador_id: string;
  inicio: string;
  fin: string | null;
  base_caja: number;
  efectivo_esperado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  notas: string | null;
  estado: EstadoTurno;
  cerrado_por: string | null;
};

export type Cuenta = {
  id: number;
  mesa_id: number | null;
  turno_id: number;
  nombre: string;
  estado: EstadoCuenta;
  total: number;
  pagado: number;
  abierta_en: string;
  cerrada_en: string | null;
  creada_por: string | null;
  anulada_por: string | null;
  motivo_anulacion: string | null;
};

export type CuentaItem = {
  id: number;
  cuenta_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  sin_stock: boolean;
  agregado_por: string | null;
  creado_en: string;
};

export type Pago = {
  id: number;
  cuenta_id: number;
  turno_id: number;
  monto: number;
  metodo: MetodoPago;
  registrado_por: string | null;
  creado_en: string;
};

export type MovimientoInv = {
  id: number;
  producto_id: number;
  tipo: TipoMovimiento;
  cantidad: number;
  stock_producto_id: number;
  stock_cantidad: number;
  stock_resultante: number;
  sin_stock: boolean;
  usuario_id: string | null;
  cuenta_id: number | null;
  turno_id: number | null;
  motivo: string | null;
  creado_en: string;
};

export type AuditoriaItem = {
  id: number;
  tipo: 'eliminado' | 'movido';
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  cuenta_origen_id: number;
  cuenta_destino_id: number | null;
  usuario_id: string | null;
  turno_id: number | null;
  motivo: string | null;
  creado_en: string;
};

export type Actividad = {
  id: number;
  tipo: TipoActividad;
  descripcion: string;
  monto: number | null;
  cuenta_id: number | null;
  turno_id: number | null;
  usuario_id: string | null;
  creado_en: string;
};

// Respuesta de las RPC resumen_turno y cerrar_turno.
export type ResumenTurno = {
  turno_id: number;
  estado: EstadoTurno;
  operador: string | null;
  inicio: string;
  fin: string | null;
  base_caja: number;
  pagos: { efectivo: number; daviplata: number; bre_b: number; total: number };
  efectivo_esperado: number;
  efectivo_contado: number | null;
  diferencia: number | null;
  notas: string | null;
  cuentas: { abiertas: number; pagadas: number; anuladas: number; saldo_pendiente: number };
  items_eliminados: number;
  ventas_sin_stock: number;
};

export const METODOS_PAGO: { valor: MetodoPago; texto: string }[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'daviplata', texto: 'Daviplata' },
  { valor: 'bre_b', texto: 'Bre-B' },
];
