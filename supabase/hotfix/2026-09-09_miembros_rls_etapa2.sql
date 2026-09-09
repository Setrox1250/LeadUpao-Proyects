-- ═══════════════════════════════════════════════════════════════════════════
-- HOTFIX P0 — ETAPA 2: cerrar `miembros` también a los usuarios autenticados
-- Fecha: 2026-09-09
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La etapa 1 (2026-09-08) retiró los privilegios de `anon`, que era lo grave:
-- la clave pública viaja en el bundle de Next.js. Pero dejó a `authenticated`
-- con SELECT sobre TODAS las filas, incluidos `contrasena_hash` y
-- `codigo_verificacion` de terceros. Si el alta libre de Supabase Auth está
-- activa, cualquiera puede crearse una cuenta y llegar ahí.
--
-- ───────────────────────────────────────────────────────────────────────────
-- REQUIERE EL CAMBIO DE CÓDIGO QUE ACOMPAÑA A ESTA MIGRACIÓN
-- ───────────────────────────────────────────────────────────────────────────
--
-- Antes, dos rutas leían `miembros` con la clave pública y se romperían:
--
--   1. `lib/miembro.ts` — resolución de identidad. Su segundo paso busca por
--      `discord_id` una fila cuyo `auth_user_id` todavía es null, así que
--      NINGUNA política basada en auth.uid() puede alcanzarla.
--   2. `app/admin/(dashboard)/page.tsx` — los dos listados del panel. Una
--      política que consultara `miembros` para saber si el solicitante es
--      admin se llamaría a sí misma.
--
-- Ambas pasaron a `createAdminClient()` (service_role), que es seguro porque
-- corren solo en servidor, tras `auth.getUser()`, y con un identificador que
-- no elige el cliente. Con eso, NINGÚN camino de la aplicación necesita leer
-- `miembros` con la clave pública, y la tabla puede cerrarse por completo.
--
-- ⚠️ NO aplicar sin desplegar antes ese cambio de código, o el login deja de
--    resolver el perfil y todo el mundo cae en /?error=not_registered.

begin;

-- 1. Sin privilegios para las claves públicas. Ya no hay código que dependa
--    de ellos: ni SELECT ni el UPDATE de auth_user_id que conservaba la etapa 1.
revoke all privileges on public.miembros from anon;
revoke all privileges on public.miembros from authenticated;

-- 2. RLS activo y sin políticas: Postgres deniega por defecto. `service_role`
--    lo omite, que es como opera toda la aplicación.
--
--    Se deja sin políticas a propósito, no por olvido. Añadir una de "solo tu
--    propia fila" invitaría a volver a leer la tabla desde el cliente, y el
--    control de acceso de esta aplicación vive en las Server Actions, que ya
--    comprueban isAdmin/isStaff/isFounder antes de tocar nada. Dos mecanismos
--    de autorización en paralelo se desincronizan.
alter table public.miembros enable row level security;

commit;

-- ───────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ───────────────────────────────────────────────────────────────────────────
--
--   select relrowsecurity from pg_class
--    where oid = 'public.miembros'::regclass;                  -- debe ser true
--
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema='public' and table_name='miembros'
--      and grantee in ('anon','authenticated');                -- sin filas
--
-- Y desde la aplicación: iniciar sesión debe seguir resolviendo el perfil, y
-- el panel debe seguir listando miembros.
