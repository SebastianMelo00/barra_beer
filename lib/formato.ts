// Formato de moneda (COP sin decimales) y fechas en hora de Bogotá.

export const ZONA_HORARIA = 'America/Bogota';

/** 4000 → "$ 4.000"; -500 → "-$ 500". */
export function pesos(valor: number | null | undefined): string {
  const n = Math.round(valor ?? 0);
  const miles = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}$ ${miles}`;
}

/** Lee lo que escribe una persona: "4.000", "$ 4000", "4,000" → 4000. Vacío o inválido → null. */
export function leerPesos(texto: string): number | null {
  const limpio = texto.replace(/[^\d]/g, '');
  if (!limpio) return null;
  const n = Number.parseInt(limpio, 10);
  return Number.isSafeInteger(n) ? n : null;
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

/** Rango [inicio, fin) en ISO para un día "AAAA-MM-DD" de Bogotá (UTC-5, sin horario de verano). */
export function rangoDiaBogota(dia: string): { desde: string; hasta: string } {
  const desde = new Date(`${dia}T00:00:00-05:00`);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

/** Mensaje legible de un error de Supabase/RPC. */
export function mensajeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
