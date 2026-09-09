-- Un foro de tareas por área: cada pilar tiene su categoría y su foro de
-- backlog en Discord. Sustituye el FORUM_CHANNEL_ID único del bot.
-- Diseño completo en docs/discord-tareas.md.
--
-- ADITIVA Y SEGURA: solo añade columnas nulables. No toca datos existentes
-- ni depende de las tablas que la cadena 0001-0004 da por hechas, así que
-- puede aplicarse en producción tal cual.

alter table public.pilares
  add column if not exists discord_category_id varchar(50),
  add column if not exists discord_forum_id    varchar(50);

comment on column public.pilares.discord_category_id is
  'Categoría de Discord del área. La crea el bot; nunca la borra (ver docs/discord-tareas.md).';
comment on column public.pilares.discord_forum_id is
  'Foro de backlog del área. Determina el pilar de las tareas creadas desde Discord.';

-- El bot escucha `pilares` por Realtime para crear los canales al dar de alta
-- un área. La publicación ya incluye esta tabla desde 0003; el bloque es
-- idempotente y no falla si ya está.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pilares'
  ) then
    alter publication supabase_realtime add table public.pilares;
  end if;
end $$;
