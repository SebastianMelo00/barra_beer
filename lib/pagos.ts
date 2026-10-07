import type { MetodoPago } from './types';

export const TEXTO_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  daviplata: 'Daviplata',
  bre_b: 'Bre-B',
};

/**
 * Divide un saldo en N partes "a favor de la casa": cada parte se redondea
 * hacia arriba a $ 100 y la última ajusta, así la suma da exacto el saldo.
 * Ej.: $ 25.000 entre 3 → 8.400 + 8.400 + 8.200.
 */
export function dividirSaldo(saldo: number, partes: number): number[] {
  if (partes <= 1 || saldo <= 0) return [saldo];
  const redondeada = Math.ceil(saldo / partes / 100) * 100;
  const ultima = saldo - redondeada * (partes - 1);
  if (ultima > 0) return [...Array<number>(partes - 1).fill(redondeada), ultima];
  // Montos muy pequeños: reparto exacto y el residuo va a la última parte.
  const base = Math.floor(saldo / partes);
  return [...Array<number>(partes - 1).fill(base), saldo - base * (partes - 1)];
}

/** Billetes para calcular las vueltas rápido. */
export const BILLETES = [10000, 20000, 50000, 100000];
