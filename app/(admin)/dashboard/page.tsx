import type { Metadata } from 'next';
import { PanelDashboard } from '@/components/dashboard/PanelDashboard';

export const metadata: Metadata = { title: 'Dashboard · La Barra Beer' };

export default function DashboardPage() {
  return <PanelDashboard />;
}
