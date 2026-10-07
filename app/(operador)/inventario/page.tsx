import type { Metadata } from 'next';
import { PanelInventario } from '@/components/inventario/PanelInventario';

export const metadata: Metadata = { title: 'Inventario · La Barra Beer' };

export default function InventarioPage() {
  return <PanelInventario />;
}
