-- Auditoría, esta vez aplicable.
--
-- ─── POR QUÉ HAY UNA SEGUNDA ───────────────────────────────────────────────
--
-- La migración 0001 nunca llegó a aplicarse y la tabla no existe en
-- producción (verificado: /rest/v1/logs_auditoria → 404). Declaraba
--
--     actor_id   uuid references public.miembros(id)
--
-- y `miembros.id` es `bigint`. Ese FK no puede crearse, así que la migración
-- aborta entera. Como `registrarAuditoria()` traga el error a console.error
-- para no revertir la acción principal, TODAS las escrituras de auditoría se
-- han descartado en silencio desde el primer día.
--
-- No se corrige 0001 in situ: tocar una migración ya versionada es lo que
-- hace que el historial deje de describir lo que pasó. 0001 queda como está,
-- documentando el intento fallido.
--
-- ─── LOS TIPOS, VERIFICADOS CONTRA PRODUCCIÓN ──────────────────────────────
--
--   miembros.id  bigint        tareas.id  bigint
--   roles.id     uuid          pilares.id uuid
--
-- De ahí las dos decisiones de tipo:
--
--   · `actor_id bigint` con FK a `miembros`, que sí puede crearse.
--   · `entidad_id text`, SIN FK: apunta a cuatro tablas con dos tipos de
--     clave distintos. Una referencia polimórfica no puede tener integridad
--     referencial, y fingir que sí (con `uuid`) es lo que rompió 0001.

begin;

create table if not exists public.logs_auditoria (
  id            uuid primary key default gen_random_uuid(),
  actor_id      bigint references public.miembros(id) on delete set null,
  -- Se guarda el nombre además del id porque el registro debe seguir siendo
  -- legible cuando la persona ya no esté en `miembros`, que es justo cuando
  -- más falta hace consultarlo.
  actor_nombre  text not null,
  accion        text not null,
  entidad       text not null,
  entidad_id    text,
  detalles      jsonb not null default '{}'::jsonb,
  creado_en     timestamptz not null default now()
);

comment on column public.logs_auditoria.entidad_id is
  'Id de la fila afectada, como texto: `tareas` y `miembros` usan bigint, `roles` y `pilares` uuid.';

-- El panel lee las últimas 200 entradas ordenadas por fecha descendente.
create index if not exists logs_auditoria_creado_en_idx
  on public.logs_auditoria (creado_en desc);

-- Para responder "qué se hizo sobre esta tarea" sin recorrer la tabla entera.
create index if not exists logs_auditoria_entidad_idx
  on public.logs_auditoria (entidad, entidad_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Acceso: solo el servidor
--
-- Se escribe únicamente desde Server Actions con service_role, que omite RLS.
-- El panel lee vía obtenerLogsAuditoria(), que comprueba isAdmin ANTES de
-- usar ese cliente. Con RLS activo y cero políticas, `anon` y `authenticated`
-- no pueden tocar nada, que es exactamente lo que se quiere: un registro de
-- auditoría que el propio auditado pueda editar no sirve de nada.
--
-- Los revoke son explícitos porque Supabase concede permisos amplios por
-- defecto en el esquema `public`, y esa combinación —permisos amplios y RLS
-- sin activar— ya causó el incidente P0 de `miembros`.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.logs_auditoria enable row level security;

revoke all privileges on public.logs_auditoria from anon;
revoke all privileges on public.logs_auditoria from authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────────────────
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema='public' and table_name='logs_auditoria'
--    order by ordinal_position;
--
--   select relrowsecurity from pg_class where oid='public.logs_auditoria'::regclass;
--
-- Y en la aplicación: mueve una tarea de columna y recarga la pestaña
-- Auditoría. Antes de esta migración la tabla salía siempre vacía.
