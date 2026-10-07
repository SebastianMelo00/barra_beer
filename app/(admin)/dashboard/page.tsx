import { EnConstruccion } from '@/components/ui/EnConstruccion';
import { VerificacionConexion } from '@/components/ui/VerificacionConexion';

export default function DashboardPage() {
  return (
    <EnConstruccion titulo="Dashboard" fase={4}>
      <VerificacionConexion />
    </EnConstruccion>
  );
}
