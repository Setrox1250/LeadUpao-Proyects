-- ═══════════════════════════════════════════════════════════════════════════
-- HOTFIX P0 — ETAPA 1: cerrar el acceso público a `miembros`
-- Fecha: 2026-09-08
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DIAGNÓSTICO CONFIRMADO contra la base productiva:
--
--   pg_class.relrowsecurity para public.miembros = FALSE
--   grants sobre public.miembros:
--     anon           → DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--     authenticated  → DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--   políticas sobre public.miembros = ninguna
--
-- `miembros` es la ÚNICA tabla con RLS desactivado; el resto (roles, pilares,
-- tareas, redes_sociales) lo tiene activo y por tanto sus grants están
-- controlados. Con RLS apagado, los grants se aplican sin filtro alguno.
--
-- IMPACTO: la anon key viaja en el bundle público de Next.js. Cualquiera que
-- haya abierto el sitio podía leer la tabla entera —incluidos
-- `contrasena_hash` y `codigo_verificacion`—, modificar cualquier fila
-- (p. ej. asignarse `rol = 'admin'`) y borrarla o truncarla por completo.
--
-- ───────────────────────────────────────────────────────────────────────────
-- POR QUÉ ESTA ETAPA NO ROMPE NADA
-- ───────────────────────────────────────────────────────────────────────────
--
-- Se auditó cada consulta a `miembros` en el código:
--
--   * TODAS las escrituras (crear, aprobar, editar, borrar, contraseñas) usan
--     `createAdminClient()` → service_role, que ignora grants y RLS.
--   * El login (`login-actions.ts`) usa service_role.
--   * El registro público (`lib/actions/miembros.ts`) usa service_role.
--   * El bot usa SUPABASE_KEY (service_role).
--   * La landing (`app/page.tsx`) NO consulta `miembros`.
--
-- Con la clave anónima solo quedan dos accesos, ambos con sesión iniciada
-- (rol `authenticated`, nunca `anon`):
--
--   1. `lib/miembro.ts` → SELECT propio + UPDATE de `auth_user_id`
--   2. `app/admin/(dashboard)/page.tsx` → SELECT del listado (vistas de admin)
--
-- Por eso `anon` puede perder TODO sin consecuencias, y `authenticated`
-- conserva únicamente SELECT y el UPDATE de una sola columna.
--
-- ───────────────────────────────────────────────────────────────────────────

begin;

-- 1. `anon` no necesita absolutamente nada de esta tabla.
revoke all privileges on public.miembros from anon;

-- 2. `authenticated` conserva el mínimo que el código realmente ejerce.
revoke all privileges on public.miembros from authenticated;
grant select on public.miembros to authenticated;
grant update (auth_user_id) on public.miembros to authenticated;

commit;

-- ───────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN (debe devolver solo las filas esperadas)
-- ───────────────────────────────────────────────────────────────────────────
--
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_schema='public' and table_name='miembros'
--     and grantee in ('anon','authenticated');
--
--   -- Esperado: anon sin filas; authenticated con SELECT en todas las
--   -- columnas y UPDATE solo en auth_user_id.
--
-- ───────────────────────────────────────────────────────────────────────────
-- LO QUE ESTA ETAPA **NO** CIERRA
-- ───────────────────────────────────────────────────────────────────────────
--
-- Un usuario autenticado sigue pudiendo leer TODAS las filas, incluidos
-- `contrasena_hash` y `codigo_verificacion` de los demás. Si el registro de
-- Supabase Auth está abierto, cualquiera puede crearse una cuenta y llegar
-- ahí. Eso lo cierra la Etapa 2 (RLS por fila), que requiere un cambio de
-- código y por tanto pasa por PR: ver supabase/hotfix/README.md.
--
-- Mientras tanto, mitigación inmediata sin código: desactivar el alta de
-- usuarios en Authentication → Sign In / Providers → "Allow new users to sign up",
-- si el flujo actual no la necesita.
