// Formato de moneda (COP sin decimales) y fechas en hora de Bogotá.

export const ZONA_HORARIA = 'America/Bogota';

/** 4000 → "$ 4.000"; -500 → "-$ 500". */
export function pesos(valor: number | null | undefined): string {
  const n = Math.round(valor ?? 0);
  return `${n < 0 ? '-' : ''}$ ${miles(Math.abs(n))}`;
}

/** 24000 → "24.000" (sin signo de pesos). */
export function miles(valor: number): string {
  return Math.round(valor)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Lee lo que escribe una persona: "4.000", "$ 4000", "4,000" → 4000. Vacío o inválido → null. */
export function leerPesos(texto: string): number | null {
  const limpio = texto.replace(/[^\d]/g, '');
  if (!limpio) return null;
  const n = Number.parseInt(limpio, 10);
  return Number.isSafeInteger(n) ? n : null;
}

/** Cantidad con signo: 5 → "+5", -3 → "−3". */
export function conSigno(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

const fmtHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const fmtFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const fmtFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "9:45 p. m." */
export function hora(fecha: string | Date): string {
  return fmtHora.format(new Date(fecha));
}

/** "vie, 7 oct" */
export function fecha(f: string | Date): string {
  return fmtFecha.format(new Date(f));
}

/** "7 oct 2026, 9:45 p. m." */
export function fechaHora(f: string | Date): string {
  return fmtFechaHora.format(new Date(f));
}

/** Tiempo transcurrido corto: "5 min", "1 h 20 min". */
export function transcurrido(desde: string | Date, hasta: Date = new Date()): string {
  const min = Math.max(0, Math.floor((hasta.getTime() - new Date(desde).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

/** Fecha de hoy en Bogotá como "AAAA-MM-DD" (para filtros por día). */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(new Date());
}

/** Inicio de un día "AAAA-MM-DD" de Bogotá en ISO (Colombia es UTC-5 todo el año). */
export function inicioDiaBogota(dia: string): string {
  return new Date(`${dia}T00:00:00-05:00`).toISOString();
}

/** Fin (exclusivo) de un día "AAAA-MM-DD" de Bogotá en ISO. */
export function finDiaBogota(dia: string): string {
  return new Date(new Date(`${dia}T00:00:00-05:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

/** Mensaje legible de un error de Supabase/RPC. */
export function mensajeError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Ocurrió un error inesperado. Intenta de nuevo.';
  const { code, message } = error as { code?: string; message?: string };
  const texto = typeof message === 'string' ? message : '';

  if (texto.includes('Failed to fetch') || texto.includes('NetworkError')) {
    return 'Sin conexión. Revisa el internet e intenta de nuevo.';
  }
  if (code === '23505') return 'Ya existe un producto con ese nombre.';
  if (code === '23503') {
    return 'No se puede borrar porque ya tiene ventas, movimientos o productos que dependen de él. Desactívalo en su lugar.';
  }
  if (texto.startsWith('permission denied') || texto.includes('row-level security')) {
    return 'No tienes permiso para esta acción.';
  }
  return texto || 'Ocurrió un error inesperado. Intenta de nuevo.';
}
