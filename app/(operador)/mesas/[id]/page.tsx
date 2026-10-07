import { Suspense } from 'react';
import { PanelMesa } from '@/components/mesas/PanelMesa';

export default function MesaPage({ params }: PageProps<'/mesas/[id]'>) {
  return (
    <Suspense fallback={<p className="text-tenue">Cargando mesa…</p>}>
      <MesaSegunRuta params={params} />
    </Suspense>
  );
}

async function MesaSegunRuta({ params }: { params: PageProps<'/mesas/[id]'>['params'] }) {
  const { id } = await params;
  return <PanelMesa mesaId={Number(id)} />;
}
