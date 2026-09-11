-- REPLICA IDENTITY FULL en las tres tablas que el bot escucha por Realtime.
--
-- ─── POR QUÉ EXISTE ESTA MIGRACIÓN ─────────────────────────────────────────
--
-- Verificado el 2026-09-11 en producción:
--
--     select relreplident from pg_class where oid = 'public.tareas'::regclass;
--     → 'd'
--
-- La 0008 declara `alter table public.tareas replica identity full`, pero está
-- en sus últimas líneas y ese archivo quedó truncado a una sola línea en el
-- commit 9385912, restaurado después en 33682df. Lo que se pegó en el SQL
-- editor fue, casi con seguridad, la versión corta.
--
-- ─── QUÉ ROMPE, Y POR QUÉ NO SE VIO ANTES ──────────────────────────────────
--
-- Sin REPLICA IDENTITY FULL, Postgres solo publica la CLAVE PRIMARIA en el
-- registro anterior de cada evento: `payload.old` llega como `{ id }`. El bot
-- compara anterior contra nuevo en varios sitios, y todos fallan CALLANDO. No
-- hay excepción, no hay log de error: simplemente no ocurre nada.
--
--   tareas
--     · handleTareaUpdate compara `old.fecha_vencimiento`. Si es undefined,
--       concluye que la fecha no cambió y no avisa en el hilo.
--     · handleTareaDelete lee `old.id_discord_hilo` para saber qué hilo
--       bloquear y archivar. Sin él, el hilo se queda abierto como si la tarea
--       siguiera viva.
--
--   pilares
--     · archivarAreaEliminada() necesita `discord_forum_id`,
--       `discord_category_id` y `discord_role_id` del registro borrado. Sin
--       ellos no retira nada.
--
--   roles
--     · handleRolePilarDelete lee `old.discord_role_id` para borrar el rol.
--     · handleRolePilarUpdate compara `old.nombre` para saber si hubo
--       renombrado; con undefined siempre cree que sí y renombra de más.
--
-- Se detectó probando el circuito de extremo a extremo, no leyendo el código:
-- el síntoma es la ausencia de algo, y eso no aparece en ningún log.
--
-- Idempotente: si una tabla ya está en `full`, se la salta.

begin;

do $$
declare
  t text;
  antes char;
  en_publicacion boolean;
begin
  foreach t in array array['tareas', 'roles', 'pilares'] loop
    select relreplident into antes
      from pg_class where oid = ('public.' || t)::regclass;

    if antes = 'f' then
      raise notice '% : REPLICA IDENTITY ya era full.', rpad(t, 8);
    else
      execute format('alter table public.%I replica identity full', t);
      raise notice '% : REPLICA IDENTITY % -> f  (CORREGIDO)', rpad(t, 8), antes;
    end if;

    -- Sin la tabla en la publicación no llega ningún evento, con identidad o sin ella.
    select exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) into en_publicacion;

    if not en_publicacion then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice '% : AÑADIDA a la publicación supabase_realtime.', rpad(t, 8);
    end if;
  end loop;
end $$;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────────────────
--
--   select relname, relreplident
--     from pg_class
--    where oid in ('public.tareas'::regclass,
--                  'public.roles'::regclass,
--                  'public.pilares'::regclass);
--   -- las tres deben devolver 'f'
--
-- Y en la aplicación, que es donde se ve de verdad: borra una tarea desde el
-- panel. El hilo debe recibir "🚫 Esta tarea fue eliminada desde el panel de
-- control web", quedar bloqueado y archivarse. Si no pasa nada, sigue en 'd'.
