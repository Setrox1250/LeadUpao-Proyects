-- ═══════════════════════════════════════════════════════════════════════════
-- HOTFIX P0 — Consultas de auditoría del incidente
-- Fecha: 2026-09-08
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La tabla `miembros` estuvo escribible por cualquiera con la clave anónima.
-- No hay rastro de auditoría propio: `logs_auditoria` NO EXISTE en producción
-- (la migración 0001 nunca se aplicó; falla por el FK imposible
-- `actor_id uuid references miembros(id)` siendo `miembros.id` un bigint).
--
-- Estas consultas buscan señales de manipulación en los datos mismos.
-- Ejecutarlas ANTES de rotar credenciales, para tener una foto del estado.

-- 1. ¿Hay administradores o staff que el equipo no reconozca?
--    Es el vector más probable: asignarse `rol = 'admin'` a uno mismo.
select id, nombre_completo, correo_institucional, rol, cargo, estado, creado_en
from public.miembros
where rol in ('admin', 'staff')
order by creado_en desc;

-- 2. Últimas filas creadas: ¿coinciden con altas que el equipo hizo?
select id, nombre_completo, correo_institucional, estado, rol, cargo, creado_en
from public.miembros
order by creado_en desc
limit 30;

-- 3. Total de filas: comparar con el número de miembros que el equipo espera.
select count(*) as total_miembros from public.miembros;

-- 4. Filas sin ningún vínculo de identidad: posibles inserciones ajenas.
select count(*) as huerfanos
from public.miembros
where auth_user_id is null and discord_id is null;

-- 5. Distribución de estados: un salto en 'VERIFICADO' sin altas conocidas
--    sugiere escalada de privilegios.
select estado, count(*) from public.miembros group by estado order by 2 desc;

-- ───────────────────────────────────────────────────────────────────────────
-- Complementar con los logs del panel de Supabase (Logs → API / Postgres).
-- En el plan gratuito la retención es corta, así que revisarlos cuanto antes:
-- buscar peticiones a /rest/v1/miembros con apikey anónima y método distinto
-- de GET.
