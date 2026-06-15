-- ─── MIGRACIÓN V2: Registro solo por administrador + login con código ────────
-- Ejecuta este script en el SQL Editor de tu panel de Supabase.
-- Es ADITIVO (no borra datos existentes).

-- 1. discord_id ya no es obligatorio al crear el miembro: se vincula después
--    desde Discord con el comando /verificar y el código de verificación.
ALTER TABLE public.miembros
  ALTER COLUMN discord_id DROP NOT NULL;

-- 2. auth_user_id vincula el registro de 'miembros' con el usuario de
--    Supabase Auth (Discord OAuth o login por código).
-- 3. codigo_verificacion: código autogenerado por el administrador al crear
--    el miembro, usado para /verificar en Discord y para el login web alterno.
ALTER TABLE public.miembros
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS codigo_verificacion varchar(20) UNIQUE;
