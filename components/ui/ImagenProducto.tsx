import Image from 'next/image';
import type { Producto } from '@/lib/types';

// Foto del producto sobre fondo blanco. Sin foto: iniciales del nombre.
export function ImagenProducto({
  producto,
  tamano = 48,
  className = '',
}: {
  producto: Pick<Producto, 'nombre' | 'imagen'>;
  tamano?: number;
  className?: string;
}) {
  const estilo = { width: tamano, height: tamano };

  if (producto.imagen) {
    return (
      <span
        style={estilo}
        className={`relative inline-block shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-borde ${className}`}
      >
        <Image src={producto.imagen} alt="" fill unoptimized sizes={`${tamano}px`} className="object-contain p-0.5" />
      </span>
    );
  }

  const iniciales = producto.nombre
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <span
      style={{ ...estilo, fontSize: Math.max(11, tamano / 3) }}
      className={`inline-grid shrink-0 place-items-center rounded-lg bg-marca/15 font-bold text-cafe ring-1 ring-marca/30 ${className}`}
      aria-hidden
    >
      {iniciales || '?'}
    </span>
  );
}
