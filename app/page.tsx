import { redirect } from 'next/navigation';

// El proxy envía a cada usuario a su pantalla inicial según el rol
// (/dashboard o /mesas). Esto solo se ve si el proxy no corrió.
export default function Inicio() {
  redirect('/login');
}
