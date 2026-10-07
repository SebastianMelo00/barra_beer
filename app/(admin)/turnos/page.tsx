import type { Metadata } from 'next';
import { HistorialTurnos } from '@/components/turno/HistorialTurnos';

export const metadata: Metadata = { title: 'Historial de turnos · La Barra Beer' };

export default function TurnosPage() {
  return <HistorialTurnos />;
}
