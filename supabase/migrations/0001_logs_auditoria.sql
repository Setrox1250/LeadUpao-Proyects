-- Tabla de auditoría: registra acciones administrativas críticas
-- (creación/aprobación de miembros, reseteo de contraseñas, mutaciones
-- del tablero de tareas). Solo se escribe desde Server Actions usando el
-- cliente service_role (src/lib/actions/auditoria.ts).
create table if not exists public.logs_auditoria (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.miembros(id) on delete set null,
  actor_nombre  text not null,
  accion        text not null,
  entidad       text not null,
  entidad_id    uuid,
  detalles      jsonb not null default '{}'::jsonb,
  creado_en     timestamptz not null default now()
);

create index if not exists logs_auditoria_creado_en_idx on public.logs_auditoria (creado_en desc);

alter table public.logs_auditoria enable row level security;

-- Solo el backend (service_role) puede leer/escribir. El panel consulta
-- estos logs a través de obtenerLogsAuditoria(), que ya valida que el
-- usuario sea administrador antes de usar el cliente service_role.
-- No se define ninguna policy para 'anon'/'authenticated': por defecto,
-- con RLS habilitado y sin policies, esas conexiones no pueden acceder.
