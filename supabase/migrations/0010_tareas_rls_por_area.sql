-- RLS de `tareas` por área. Revive el Kanban en tiempo real.
--
-- ─── EL PROBLEMA ───────────────────────────────────────────────────────────
--
-- `tareas` tenía RLS activo y CERO políticas, así que Postgres denegaba todo
-- salvo a service_role. Consecuencias:
--
--   · El tablero se cargaba vacío: `page.tsx:121` lee `tareas` con la clave
--     pública, no con privilegios de servicio.
--   · Supabase Realtime comprueba RLS con el JWT del suscriptor, así que el
--     navegador no recibía ningún evento: `TasksBoard.tsx:149` se suscribía a
--     un canal que nunca entregaba nada.
--
-- ─── LA REGLA ──────────────────────────────────────────────────────────────
--
-- Replica la autorización que la aplicación ya aplica en `page.tsx:122-126`:
-- la Directiva ve todas las áreas, y el resto solo la suya. Se añade el caso
-- de las tareas sin área, que viven en el foro general y ve todo el mundo
-- (docs/discord-tareas.md).
--
-- Solo SELECT. Toda escritura pasa por Server Actions con service_role, que ya
-- comprueban isAdmin/isStaff antes de tocar nada; conceder INSERT/UPDATE/DELETE
-- al navegador duplicaría el control de acceso y las dos copias se
-- desincronizarían.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Quién soy, sin recursión
--
--    Una política sobre `tareas` que consultara `miembros` directamente
--    fallaría: `miembros` no concede nada a `authenticated`, y la subconsulta
--    corre con el rol de quien llama. SECURITY DEFINER la ejecuta con el
--    propietario de la función, que sí puede leerla.
--
--    `set search_path` es obligatorio en funciones SECURITY DEFINER: sin él,
--    quien invoca podría anteponer un esquema propio y secuestrar los nombres.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.mi_nivel_permiso()
returns text language sql security definer stable set search_path = public as $$
  select rol from public.miembros where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.mi_pilar()
returns text language sql security definer stable set search_path = public as $$
  select pilar from public.miembros where auth_user_id = auth.uid() limit 1;
$$;

-- Ambas solo revelan datos del propio solicitante, pero no hay motivo para
-- exponerlas a quien no ha iniciado sesión.
revoke execute on function public.mi_nivel_permiso() from public, anon;
revoke execute on function public.mi_pilar()         from public, anon;
grant  execute on function public.mi_nivel_permiso() to authenticated;
grant  execute on function public.mi_pilar()         to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Privilegios mínimos
-- ─────────────────────────────────────────────────────────────────────────
revoke all privileges on public.tareas from anon;
revoke all privileges on public.tareas from authenticated;
grant select on public.tareas to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. La política
--
--    Las llamadas van envueltas en (select ...) a propósito: así Postgres las
--    evalúa una vez por consulta como InitPlan, en lugar de una vez por fila.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.tareas enable row level security;

drop policy if exists "tareas_select_por_area" on public.tareas;
create policy "tareas_select_por_area" on public.tareas
  for select to authenticated
  using (
       (select public.mi_nivel_permiso()) = 'admin'   -- Presidencia, Vicepresidencia, TI
    or pilar is null                                  -- tareas generales
    or pilar = (select public.mi_pilar())             -- el área propia
  );

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────────────────
--
--   select policyname, cmd, roles from pg_policies
--    where schemaname='public' and tablename='tareas';
--
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema='public' and table_name='tareas'
--      and grantee in ('anon','authenticated');   -- solo authenticated/SELECT
--
-- Y en la aplicación: el tablero debe listar tareas, y un cambio de estado
-- desde otra pestaña debe reflejarse solo, sin recargar.
