import type { Rol } from './types';

export function inicioPorRol(rol: Rol) {
  return rol === 'admin' ? '/dashboard' : '/mesas';
}

export type EnlaceNav = { href: string; texto: string; soloAdmin?: boolean };

export const ENLACES_NAV: EnlaceNav[] = [
  { href: '/dashboard', texto: 'Dashboard', soloAdmin: true },
  { href: '/mesas', texto: 'Mesas' },
  { href: '/turno', texto: 'Turno' },
  { href: '/inventario', texto: 'Inventario' },
  { href: '/productos', texto: 'Productos', soloAdmin: true },
  { href: '/turnos', texto: 'Historial', soloAdmin: true },
];
