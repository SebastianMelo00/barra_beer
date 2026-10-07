import type { Metadata } from 'next';
import { PanelMesas } from '@/components/mesas/PanelMesas';

export const metadata: Metadata = { title: 'Mesas · La Barra Beer' };

export default function MesasPage() {
  return <PanelMesas />;
}
