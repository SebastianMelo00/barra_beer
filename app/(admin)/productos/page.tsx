import type { Metadata } from 'next';
import { PanelProductos } from '@/components/productos/PanelProductos';

export const metadata: Metadata = { title: 'Productos · La Barra Beer' };

export default function ProductosPage() {
  return <PanelProductos />;
}
