import type { MetadataRoute } from 'next';

// Permite "Agregar a pantalla de inicio" en el celular de la dueña:
// abre como app, sin barra del navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'La Barra Beer',
    short_name: 'Barra Beer',
    description: 'Mesas, ventas e inventario de La Barra Beer',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    lang: 'es-CO',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
