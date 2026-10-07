import { EnConstruccion } from '@/components/ui/EnConstruccion';
import { VerificacionConexion } from '@/components/ui/VerificacionConexion';

export default function MesasPage() {
  return (
    <EnConstruccion titulo="Mesas" fase={3}>
      <VerificacionConexion />
    </EnConstruccion>
  );
}
