-- ─── MIGRACIÓN V3: Login con código de verificación + contraseña ─────────────
-- Ejecuta este script en el SQL Editor de tu panel de Supabase.
-- Es ADITIVO/de limpieza (no borra miembros existentes).

-- 1. contrasena_hash: contraseña del miembro (hash + salt, formato "salt:hash"),
--    definida por el administrador al crear el miembro y modificable luego
--    por el propio miembro. Junto con codigo_verificacion reemplaza el login
--    por correo + código.
ALTER TABLE public.miembros
  ADD COLUMN IF NOT EXISTS contrasena_hash text;

-- 2. aprobado_por: columna sin uso en la web ni en el bot de Discord, se elimina.
ALTER TABLE public.miembros
  DROP COLUMN IF EXISTS aprobado_por;
