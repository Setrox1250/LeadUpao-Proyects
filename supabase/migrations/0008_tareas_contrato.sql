-- Repara el contrato de `tareas`, que hoy no soporta ninguna de las dos
-- direcciones de sincronización con Discord.
--
-- ESTADO REAL COMPROBADO EN PRODUCCIÓN (2026-09-08). La tabla solo tiene:
--   id, titulo, etiquetas, autor_id, estado, id_discord_hilo
--
-- Y por eso está todo roto:
--
--   · La web NO puede crear tareas: `crearTarea` inserta `descripcion`
--     (tareas.ts:40) y esa columna no existe.
--   · La web consulta `pilar` al cambiar estado y al borrar (tareas.ts:72,104)
--     sobre una columna inexistente.
--   · El bot NO puede crear tareas: `threadCreate.js` inserta `canal_id` y
--     `creador_id`, que tampoco existen, y el error se traga en el catch.
--   · El bot escribe `estado: 'PENDIENTE'`, que no está en el `EstadoTarea`
--     de la web (BACKLOG | EN_PROGRESO | COMPLETADO), así que ni se mostraría.
--
-- Esta migración deja el esquema alineado con el contrato compartido. Las
-- columnas temporales del calendario (fecha_inicio, fecha_vencimiento,
-- responsable_id...) llegan en la Fase 3.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Columnas que el código ya da por hechas
-- ─────────────────────────────────────────────────────────────────────────
alter table public.tareas
  add column if not exists descripcion text,
  add column if not exists pilar       text,
  add column if not exists created_at  timestamptz not null default now(),
  add column if not exists updated_at  timestamptz not null default now();

-- `pilar` es NULLABLE a propósito: las tareas sin área van al foro general
-- (ver docs/discord-tareas.md).
alter table public.tareas drop constraint if exists tareas_pilar_fkey;
alter table public.tareas
  add constraint tareas_pilar_fkey foreign key (pilar)
    references public.pilares (nombre) on update cascade;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Estado: un solo vocabulario para web y bot
-- ─────────────────────────────────────────────────────────────────────────
-- El bot creaba tareas en 'PENDIENTE', un estado que el Kanban no renderiza.
update public.tareas set estado = 'BACKLOG'
 where estado is null or estado not in ('BACKLOG', 'EN_PROGRESO', 'COMPLETADO');

alter table public.tareas alter column estado set default 'BACKLOG';
alter table public.tareas alter column estado set not null;

alter table public.tareas drop constraint if exists tareas_estado_check;
alter table public.tareas
  add constraint tareas_estado_check
    check (estado in ('BACKLOG', 'EN_PROGRESO', 'COMPLETADO'));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. updated_at automático
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tareas_updated_at on public.tareas;
create trigger trg_tareas_updated_at
  before update on public.tareas
  for each row execute function public.tocar_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Índices de las consultas reales (filtrado por área y por estado)
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists tareas_pilar_idx           on public.tareas (pilar);
create index if not exists tareas_estado_idx          on public.tareas (estado);
create index if not exists tareas_id_discord_hilo_idx on public.tareas (id_discord_hilo);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Realtime
--    El listener del bot compara el registro anterior con el nuevo para
--    decidir si mover la etiqueta del hilo, y eso exige REPLICA IDENTITY FULL
--    (lo documenta supabaseListener.js:209-211).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.tareas replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tareas'
  ) then
    alter publication supabase_realtime add table public.tareas;
  end if;
end $$;

commit;

-- Verificación:
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_schema='public' and table_name='tareas' order by ordinal_position;
