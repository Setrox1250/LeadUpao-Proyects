-- Alinea cargos y áreas con el organigrama oficial de LEAD UPAO (2026-09-08).
--
-- ⚠️ IMPORTANTE — POR QUÉ CADA RENAME LLEVA UN UPDATE MANUAL
--
-- La migración 0002 define `miembros_cargo_fkey` y `miembros_pilar_fkey` con
-- `on update cascade`, pero NINGUNO DE LOS DOS EXISTE en producción: 0002 solo
-- se aplicó en partes. Se comprobó al renombrar `Admin TI` en la 0006, que dejó
-- a tres miembros con un cargo huérfano en lugar de propagarse.
--
-- Por eso aquí cada rename actualiza `miembros` explícitamente. La sección 4
-- crea los FK que faltan para que esto no vuelva a pasar.
--
-- CAMBIOS
--   1. Sanea: repara el huérfano de la 0006 y normaliza `pilar = ''` a NULL.
--   2. Cargos al español del organigrama; se añade `Líder de Área`.
--   3. Áreas: 6, como el organigrama. Se fusionan Liderazgo y Desarrollo
--      Profesional, se da de alta Cooperación y Alianzas, y se retiran
--      Chapter Development y LEAD Academy (sin miembros asignados).
--   4. Se crean los FK ausentes.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Saneamiento previo
-- ─────────────────────────────────────────────────────────────────────────
-- 1.1 Reparar el huérfano que dejó la 0006.
update public.miembros set cargo = 'TI' where cargo = 'Admin TI';

-- 1.2 `pilar` debe admitir NULL: los cargos transversales (Presidente,
--     Vicepresidente, Chief of Staff...) no pertenecen a ningún área.
--     Idempotente: no hace nada si ya era nulable.
alter table public.miembros alter column pilar drop not null;

-- 1.3 Normalizar cadenas vacías a NULL.
--     Presidente y Vicepresidente tenían `pilar = ''`, que no es lo mismo que
--     NULL: un FK admite NULL, pero '' tendría que existir en `pilares`. Es lo
--     que hizo fallar el primer intento de esta migración con
--     «Key (pilar)=() is not present in table pilares».
update public.miembros set pilar = null
 where pilar is not null and btrim(pilar) = '';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Cargos
--    Chief of Staff y Treasure / Fundraising se quedan en inglés: el propio
--    organigrama los rotula así.
-- ─────────────────────────────────────────────────────────────────────────
update public.roles    set nombre = 'Presidente'     where nombre = 'President';
update public.miembros set cargo  = 'Presidente'     where cargo  = 'President';

update public.roles    set nombre = 'Vicepresidente' where nombre = 'Vice-President';
update public.miembros set cargo  = 'Vicepresidente' where cargo  = 'Vice-President';

update public.roles    set nombre = 'Líder de Área'  where nombre = 'Leader';
update public.miembros set cargo  = 'Líder de Área'  where cargo  = 'Leader';

update public.roles    set nombre = 'Miembro'        where nombre = 'Member';
update public.miembros set cargo  = 'Miembro'        where cargo  = 'Member';

-- Jerarquía sin colisiones. `orden` ordena el panel y, con --jerarquia, la
-- posición de los roles en Discord.
update public.roles set orden = 1 where nombre = 'Presidente';
update public.roles set orden = 2 where nombre = 'Vicepresidente';
update public.roles set orden = 3 where nombre = 'TI';
update public.roles set orden = 4 where nombre = 'Chief of Staff';
update public.roles set orden = 5 where nombre = 'Treasure / Fundraising';
update public.roles set orden = 6 where nombre = 'Marketing';
update public.roles set orden = 7 where nombre = 'Líder de Área';
update public.roles set orden = 8 where nombre = 'Miembro';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Áreas
-- ─────────────────────────────────────────────────────────────────────────
-- 3.1 Renombres directos
update public.pilares  set nombre = 'Área Académica'                     where nombre = 'Academic Excellence';
update public.miembros set pilar  = 'Área Académica'                     where pilar  = 'Academic Excellence';

update public.pilares  set nombre = 'Área de Excelencia Femenina'        where nombre = 'Women''s Excellence';
update public.miembros set pilar  = 'Área de Excelencia Femenina'        where pilar  = 'Women''s Excellence';

update public.pilares  set nombre = 'Área de Innovación Tecnológica'     where nombre = 'Technological Innovation';
update public.miembros set pilar  = 'Área de Innovación Tecnológica'     where pilar  = 'Technological Innovation';

update public.pilares  set nombre = 'Área de Impacto Comunitario'        where nombre = 'Community Impact';
update public.miembros set pilar  = 'Área de Impacto Comunitario'        where pilar  = 'Community Impact';

-- 3.2 Fusión: el organigrama muestra Liderazgo y Desarrollo Profesional como
--     una sola área. Se conserva la fila de Leadership y se absorbe la otra.
update public.pilares  set nombre = 'Área de Liderazgo y Desarrollo Profesional' where nombre = 'Leadership';
update public.miembros set pilar  = 'Área de Liderazgo y Desarrollo Profesional'
  where pilar in ('Leadership', 'Professional Development');
delete from public.pilares where nombre = 'Professional Development';

-- 3.3 Área nueva
insert into public.pilares (nombre, orden) values ('Área de Cooperación y Alianzas', 6)
on conflict (nombre) do update set orden = excluded.orden;

-- 3.4 Áreas que el organigrama no contempla. Se comprueba antes de borrar:
--     si alguien quedara asignado, la migración falla en lugar de dejar
--     miembros huérfanos.
do $$
declare afectados int;
begin
  select count(*) into afectados from public.miembros
   where pilar in ('Chapter Development', 'LEAD Academy');
  if afectados > 0 then
    raise exception 'Hay % miembro(s) en Chapter Development o LEAD Academy. Reasignarlos antes de continuar.', afectados;
  end if;
end $$;

delete from public.pilares where nombre in ('Chapter Development', 'LEAD Academy');

update public.pilares set orden = 1 where nombre = 'Área Académica';
update public.pilares set orden = 2 where nombre = 'Área de Excelencia Femenina';
update public.pilares set orden = 3 where nombre = 'Área de Innovación Tecnológica';
update public.pilares set orden = 4 where nombre = 'Área de Impacto Comunitario';
update public.pilares set orden = 5 where nombre = 'Área de Liderazgo y Desarrollo Profesional';
update public.pilares set orden = 6 where nombre = 'Área de Cooperación y Alianzas';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Los FK que 0002 nunca llegó a crear
--    A partir de aquí, renombrar un cargo o un área SÍ se propaga solo.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.miembros drop constraint if exists miembros_cargo_fkey;
alter table public.miembros
  add constraint miembros_cargo_fkey foreign key (cargo)
    references public.roles (nombre) on update cascade;

alter table public.miembros drop constraint if exists miembros_pilar_fkey;
alter table public.miembros
  add constraint miembros_pilar_fkey foreign key (pilar)
    references public.pilares (nombre) on update cascade;

commit;

-- Verificación:
--   select nombre, nivel_permiso, requiere_pilar, orden from public.roles   order by orden;
--   select nombre, orden from public.pilares order by orden;              -- deben ser 6
--   select cargo, pilar, count(*) from public.miembros group by cargo, pilar;
