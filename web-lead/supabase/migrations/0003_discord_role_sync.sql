-- Prepara los catálogos `roles` y `pilares` para la sincronización
-- automatizada con el bot de Discord (vía Supabase Realtime).
--
-- El bot escucha cambios en estas tablas, crea/actualiza el rol
-- correspondiente en el servidor de Discord y escribe de vuelta el
-- `discord_role_id` generado. La web NO llama a la API de Discord: solo
-- expone la columna para lectura/visualización en el panel de Configuración.

alter table public.roles
  add column if not exists discord_role_id varchar(50);

alter table public.pilares
  add column if not exists discord_role_id varchar(50);

-- Asegura que el bot (vía Realtime) reciba los cambios de estas tablas
-- (no falla si ya estaban agregadas a la publicación).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roles'
  ) then
    alter publication supabase_realtime add table public.roles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pilares'
  ) then
    alter publication supabase_realtime add table public.pilares;
  end if;
end $$;
