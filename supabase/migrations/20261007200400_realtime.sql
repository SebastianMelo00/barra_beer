-- =============================================================================
-- La Barra Beer — 5/5 Realtime
-- Tablas que emiten cambios en vivo (respetando RLS: cada usuario solo recibe
-- los cambios de filas que puede leer).
-- =============================================================================

alter publication supabase_realtime add table
  public.productos,
  public.turnos,
  public.cuentas,
  public.cuenta_items,
  public.pagos,
  public.movimientos_inv,
  public.auditoria_items,
  public.actividad;
