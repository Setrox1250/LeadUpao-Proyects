-- Recuperación de contraseña con código de un solo uso por Discord.
--
-- ─── POR QUÉ HACE FALTA ────────────────────────────────────────────────────
--
-- No existía ninguna salida para quien olvidaba su contraseña: las dos
-- pantallas que la cambian viven DENTRO del panel, así que quedarse fuera era
-- definitivo salvo que otro administrador la restableciera.
--
-- ─── POR QUÉ DISCORD Y NO CORREO ───────────────────────────────────────────
--
-- El sistema de contraseñas es propio (`miembros.contrasena_hash`), no el de
-- Supabase Auth, así que el «recuperar por email» de Supabase no aplica. El
-- envío de correo del proyecto no está configurado, y Discord sí: los siete
-- miembros tienen `discord_id` vinculado y es el canal que ya gobierna el
-- acceso a las áreas.
--
-- ─── POR QUÉ COLUMNAS Y NO UNA TABLA ───────────────────────────────────────
--
-- Un código de recuperación es un atributo efímero de UNA fila de `miembros`,
-- nunca hay más de uno vivo por persona, y se sobrescribe al pedir otro. Una
-- tabla aparte añadiría una clave foránea y un trabajo de limpieza para no
-- guardar nada que estas tres columnas no guarden ya.

begin;

alter table public.miembros
  -- El código NUNCA se guarda en claro: mismo scrypt que las contraseñas.
  -- Quien lea la base no debe poder entrar con lo que encuentre allí.
  add column if not exists recuperacion_hash      text,
  add column if not exists recuperacion_expira_en timestamptz,
  -- Sin este contador, seis dígitos se agotan por fuerza bruta.
  add column if not exists recuperacion_intentos  smallint not null default 0;

comment on column public.miembros.recuperacion_hash is
  'Hash scrypt del código de un solo uso. NULL cuando no hay recuperación en curso.';
comment on column public.miembros.recuperacion_expira_en is
  'Caducidad del código. Pasada esta marca no sirve aunque se acierte.';
comment on column public.miembros.recuperacion_intentos is
  'Intentos fallidos del código vigente. Al llegar al máximo se invalida.';

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- NOTA SOBRE PERMISOS
--
-- No se concede nada a nadie: `miembros` no otorga privilegios a `anon` ni a
-- `authenticated` (ver supabase/hotfix/README.md), y estas columnas se leen y
-- escriben solo desde Server Actions con service_role. Es deliberado: la
-- recuperación ocurre SIN sesión, así que si la tabla fuera legible desde el
-- navegador, el hash del código viajaría al cliente.
-- ─────────────────────────────────────────────────────────────────────────
--
-- VERIFICACIÓN
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='miembros'
--      and column_name like 'recuperacion%';
