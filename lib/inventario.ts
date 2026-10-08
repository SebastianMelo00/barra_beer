import type { ColorInsignia } from '@/components/ui/Insignia';
import type { Producto, TipoMovimiento } from './types';

export type EstadoStock = 'ok' | 'bajo' | 'agotado' | 'negativo';

export const ESTADO_STOCK: Record<EstadoStock, { texto: string; color: ColorInsignia }> = {
  ok: { texto: 'OK', color: 'verde' },
  bajo: { texto: 'Bajo', color: 'amarillo' },
  agotado: { texto: 'Agotado', color: 'rojo' },
  negativo: { texto: 'Revisar conteo', color: 'rojo' },
};

export const TIPO_MOVIMIENTO: Record<TipoMovimiento, { texto: string; color: ColorInsignia }> = {
  entrada: { texto: 'Entrada', color: 'verde' },
  venta: { texto: 'Venta', color: 'marca' },
  devolucion: { texto: 'Devolución', color: 'azul' },
  merma: { texto: 'Merma', color: 'rojo' },
  ajuste: { texto: 'Ajuste', color: 'amarillo' },
};

/** Stock negativo = se vendió sin stock (o hay error de conteo). */
export function estadoStock(stock: number, minimo: number): EstadoStock {
  if (stock < 0) return 'negativo';
  if (stock === 0) return 'agotado';
  if (stock <= minimo) return 'bajo';
  return 'ok';
}

/** Productos sin descuenta_de: son los que tienen stock propio. */
export function esBase(p: Producto) {
  return p.descuenta_de === null;
}

/** Unidades vendibles de un producto derivado (ej. six packs que alcanzan con el stock de Poker). */
export function unidadesDerivado(p: Producto, base: Producto | undefined) {
  if (!base) return 0;
  return Math.max(0, Math.floor(base.stock_actual / p.factor_descuento));
}

/** Agrupa por categoría respetando el orden: la categoría va donde está su primer producto. */
export function agruparPorCategoria<T extends Pick<Producto, 'categoria' | 'orden' | 'nombre'>>(productos: T[]) {
  const ordenados = [...productos].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
  const grupos = new Map<string, T[]>();
  for (const p of ordenados) {
    const lista = grupos.get(p.categoria) ?? [];
    lista.push(p);
    grupos.set(p.categoria, lista);
  }
  return [...grupos.entries()].map(([categoria, items]) => ({ categoria, items }));
}

/** Búsqueda sin tildes ni mayúsculas: "aguila" encuentra "Águila". */
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * El producto que mejor coincide con lo escrito: nombre exacto, luego nombre
 * que empieza igual, luego alguna palabra que empieza igual, luego el resto.
 */
export function mejorCoincidencia<T extends Pick<Producto, 'nombre' | 'orden'>>(productos: T[], busqueda: string): T | null {
  const q = normalizar(busqueda);
  if (!q) return null;
  const puntaje = (p: T) => {
    const n = normalizar(p.nombre);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/\s+/).some((palabra) => palabra.startsWith(q))) return 2;
    return 3;
  };
  return [...productos].sort((a, b) => puntaje(a) - puntaje(b) || a.orden - b.orden)[0] ?? null;
}

export function coincide(p: Pick<Producto, 'nombre' | 'categoria'>, busqueda: string) {
  const q = normalizar(busqueda);
  return !q || normalizar(p.nombre).includes(q) || normalizar(p.categoria).includes(q);
}
