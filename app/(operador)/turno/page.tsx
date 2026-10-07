import type { Metadata } from 'next';
import { PanelTurno } from '@/components/turno/PanelTurno';

export const metadata: Metadata = { title: 'Turno · La Barra Beer' };

export default function TurnoPage() {
  return <PanelTurno />;
}
