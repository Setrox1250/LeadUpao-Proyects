-- Catálogo de redes sociales y enlaces de invitación (ej. Discord), editable
-- desde el panel de Configuración (solo President/Vice-President).
--
-- El enlace de Discord se expone también a usuarios anónimos: la página de
-- registro lo muestra para que los nuevos miembros puedan unirse al servidor
-- directamente, sin necesidad de una invitación personal.
create table if not exists public.redes_sociales (
  id          uuid primary key default gen_random_uuid(),
  plataforma  text not null unique,
  url         text not null,
  orden       int not null default 0,
  creado_en   timestamptz not null default now()
);

alter table public.redes_sociales enable row level security;

drop policy if exists "redes_sociales_select_anon" on public.redes_sociales;
create policy "redes_sociales_select_anon" on public.redes_sociales
  for select to anon using (true);

drop policy if exists "redes_sociales_select_authenticated" on public.redes_sociales;
create policy "redes_sociales_select_authenticated" on public.redes_sociales
  for select to authenticated using (true);
