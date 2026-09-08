-- Restructura el modelo de miembro en rol (nivel de permiso del sistema),
-- cargo (posición: President, Leader, etc.) y pilar (solo si el cargo lo
-- requiere). Introduce catálogos editables `roles` y `pilares` que alimentan
-- el nuevo panel de Configuración.
--
-- ⚠️ ANTES DE EJECUTAR ESTA MIGRACIÓN, verificar en el SQL editor de Supabase:
--
--   select distinct rol  from public.miembros;
--   select distinct pilar from public.tareas;
--
-- Todos los valores deben coincidir EXACTAMENTE (mayúsculas/tildes incluidas)
-- con los 6 cargos y 8 pilares seedeados abajo. Si aparece algún valor
-- distinto, corregirlo manualmente antes de continuar: los ALTER ... ADD
-- CONSTRAINT de las secciones 6 y 7 fallarán si hay valores huérfanos.
--
-- ⚠️ COORDINACIÓN CON EL BOT DE DISCORD: el bot probablemente lee
-- `miembros.rol` (hoy contiene el cargo, ej. "President"/"Leader") para
-- asignar permisos/roles jerárquicos en el servidor. Tras esta migración esa
-- información vive en `miembros.cargo`; `miembros.rol` pasa a ser el nivel de
-- permiso ('admin'/'staff'/'member'). Actualizar el comando /verificar del
-- bot para leer `cargo` en vez de `rol` antes de aplicar esto en producción.
-- La asignación de canales por pilar puede seguir leyendo `miembros.pilar`
-- sin cambios.

-- ─────────────────────────────────────────────────────────────────────────
-- 0. Renombrar valores existentes en la base de datos a inglés (migración segura)
-- ─────────────────────────────────────────────────────────────────────────
-- Actualizar niveles de permiso existentes
update public.miembros set rol = 'member' where rol = 'miembro';

-- Actualizar pilares en la tabla de miembros
update public.miembros set pilar = 'Technological Innovation' where pilar = 'Innovación Tecnológica';
update public.miembros set pilar = 'Chapter Development' where pilar = 'Desarrollo del Capítulo';
update public.miembros set pilar = 'Academic Excellence' where pilar = 'Excelencia Académica';
update public.miembros set pilar = 'Leadership' where pilar = 'Liderazgo';
update public.miembros set pilar = 'Professional Development' where pilar = 'Desarrollo Profesional';
update public.miembros set pilar = 'Community Impact' where pilar = 'Impacto Comunitario';
update public.miembros set pilar = 'Women''s Excellence' where pilar = 'Excelencia Femenina';
update public.miembros set pilar = 'LEAD Academy' where pilar = 'LEAD Academia';

-- Actualizar pilares en la tabla de tareas
update public.tareas set pilar = 'Technological Innovation' where pilar = 'Innovación Tecnológica';
update public.tareas set pilar = 'Chapter Development' where pilar = 'Desarrollo del Capítulo';
update public.tareas set pilar = 'Academic Excellence' where pilar = 'Excelencia Académica';
update public.tareas set pilar = 'Leadership' where pilar = 'Liderazgo';
update public.tareas set pilar = 'Professional Development' where pilar = 'Desarrollo Profesional';
update public.tareas set pilar = 'Community Impact' where pilar = 'Impacto Comunitario';
update public.tareas set pilar = 'Women''s Excellence' where pilar = 'Excelencia Femenina';
update public.tareas set pilar = 'LEAD Academy' where pilar = 'LEAD Academia';

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Catálogo de roles (cargos): nombre, nivel de permiso y si requiere pilar
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.roles (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null unique,
  nivel_permiso   text not null check (nivel_permiso in ('admin', 'staff', 'member')),
  requiere_pilar  boolean not null default false,
  orden           int not null default 0,
  creado_en       timestamptz not null default now()
);

insert into public.roles (nombre, nivel_permiso, requiere_pilar, orden) values
  ('President',              'admin',   false, 1),
  ('Vice-President',         'admin',   false, 2),
  ('Chief of Staff',         'staff',   false, 3),
  ('Treasure / Fundraising', 'staff',   false, 4),
  ('Leader',                 'staff',   true,  5),
  ('Member',                 'member',  true,  6)
on conflict (nombre) do update set
  nivel_permiso = excluded.nivel_permiso,
  requiere_pilar = excluded.requiere_pilar,
  orden = excluded.orden;

-- Si existía el rol 'Miembro', actualizar cualquier referencia existente en la BD y eliminar el viejo rol
update public.miembros set cargo = 'Member' where cargo = 'Miembro';
delete from public.roles where nombre = 'Miembro';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Catálogo de pilares
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.pilares (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  orden       int not null default 0,
  creado_en   timestamptz not null default now()
);

insert into public.pilares (nombre, orden) values
  ('Technological Innovation',  1),
  ('Chapter Development',       2),
  ('Academic Excellence',       3),
  ('Leadership',                4),
  ('Professional Development',  5),
  ('Community Impact',          6),
  ('Women''s Excellence',       7),
  ('LEAD Academy',              8)
on conflict (nombre) do update set
  orden = excluded.orden;

-- Si existían los registros viejos en la tabla pilares, limpiarlos una vez actualizados los miembros/tareas
delete from public.pilares where nombre in (
  'Innovación Tecnológica', 'Desarrollo del Capítulo', 'Excelencia Académica',
  'Liderazgo', 'Desarrollo Profesional', 'Impacto Comunitario',
  'Excelencia Femenina', 'LEAD Academia'
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. miembros: rol (cargo actual) -> cargo
-- ─────────────────────────────────────────────────────────────────────────
alter table public.miembros add column if not exists cargo text;
update public.miembros set cargo = rol where cargo is null;
update public.miembros set cargo = 'Member' where cargo = 'Miembro' or cargo = 'miembro';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Nulificar pilar para cargos que no lo requieren
-- ─────────────────────────────────────────────────────────────────────────
update public.miembros m
set pilar = null
from public.roles r
where r.nombre = m.cargo and r.requiere_pilar = false;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. rol pasa a almacenar el nivel de permiso derivado del cargo
-- ─────────────────────────────────────────────────────────────────────────
update public.miembros m
set rol = r.nivel_permiso
from public.roles r
where r.nombre = m.cargo;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Constraints e integridad referencial
-- ─────────────────────────────────────────────────────────────────────────
alter table public.miembros alter column cargo set not null;
alter table public.miembros alter column pilar drop not null;

-- Eliminar constraints viejos si existen para evitar conflictos al aplicar los nuevos con 'member'
alter table public.miembros drop constraint if exists miembros_rol_check;
alter table public.miembros
  add constraint miembros_rol_check check (rol in ('admin', 'staff', 'member'));

alter table public.miembros drop constraint if exists miembros_cargo_fkey;
alter table public.miembros
  add constraint miembros_cargo_fkey foreign key (cargo)
    references public.roles (nombre) on update cascade;

alter table public.miembros drop constraint if exists miembros_pilar_fkey;
alter table public.miembros
  add constraint miembros_pilar_fkey foreign key (pilar)
    references public.pilares (nombre) on update cascade;

alter table public.tareas drop constraint if exists tareas_pilar_fkey;
alter table public.tareas
  add constraint tareas_pilar_fkey foreign key (pilar)
    references public.pilares (nombre) on update cascade;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Triggers: mantener miembros.rol sincronizado con roles.nivel_permiso
-- ─────────────────────────────────────────────────────────────────────────

-- Al insertar o cambiar el cargo de un miembro, deriva su nivel de permiso.
create or replace function public.sync_miembro_rol()
returns trigger as $$
begin
  select nivel_permiso into new.rol from public.roles where nombre = new.cargo;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_miembros_sync_rol on public.miembros;
create trigger trg_miembros_sync_rol
  before insert or update of cargo on public.miembros
  for each row execute function public.sync_miembro_rol();

-- Si un founder edita el nivel_permiso de un cargo desde Configuración,
-- propaga el cambio a todos los miembros que tengan ese cargo.
create or replace function public.propagate_rol_nivel_permiso()
returns trigger as $$
begin
  if new.nivel_permiso is distinct from old.nivel_permiso then
    update public.miembros set rol = new.nivel_permiso where cargo = new.nombre;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_roles_propagate_nivel on public.roles;
create trigger trg_roles_propagate_nivel
  after update of nivel_permiso on public.roles
  for each row execute function public.propagate_rol_nivel_permiso();

-- ─────────────────────────────────────────────────────────────────────────
-- 8. RLS: lectura de catálogos para usuarios autenticados (selects del panel)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.roles enable row level security;
alter table public.pilares enable row level security;

drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated" on public.roles
  for select to authenticated using (true);

drop policy if exists "pilares_select_authenticated" on public.pilares;
create policy "pilares_select_authenticated" on public.pilares
  for select to authenticated using (true);
