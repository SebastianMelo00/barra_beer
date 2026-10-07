import { createBrowserClient } from '@supabase/ssr';
import { supabaseKey, supabaseUrl, verificarConfig } from './config';

// Cliente para componentes de navegador ('use client'). createBrowserClient
// devuelve siempre la misma instancia y guarda la sesión en cookies, así el
// proxy también la ve.
export function crearCliente() {
  verificarConfig();
  return createBrowserClient(supabaseUrl, supabaseKey);
}
