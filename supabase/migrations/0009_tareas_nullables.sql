-- Permite que una tarea exista antes que su hilo de Discord y sin autor.
--
-- Detectado probando el circuito de extremo a extremo: crear una tarea desde
-- la web fallaba con
--
--   null value in column "id_discord_hilo" of relation "tareas"
--   violates not-null constraint
--
-- El modelo lo exige así:
--
--   · `id_discord_hilo` — la web crea la tarea PRIMERO y el bot abre el hilo
--     después, por Realtime, escribiendo el id de vuelta. Exigirlo al insertar
--     invierte el orden de los hechos. Una tarea de un área sin foro asignado
--     tampoco llegará a tener hilo nunca.
--
--   · `autor_id` — guarda el id de Discord de quien creó la tarea. El bot lo
--     conoce (`thread.ownerId`), pero un miembro que crea la tarea desde el
--     panel puede no tener Discord vinculado todavía. El propio tipo `Tarea`
--     de la web ya lo declara `string | null`.
--
-- La 0008 añadió las columnas que faltaban, pero no revisó la nulabilidad de
-- las que ya existían.

begin;

alter table public.tareas alter column id_discord_hilo drop not null;
alter table public.tareas alter column autor_id        drop not null;

commit;

-- Verificación:
--   select column_name, is_nullable from information_schema.columns
--    where table_schema='public' and table_name='tareas'
--      and column_name in ('id_discord_hilo','autor_id');
