-- Ajusta el catálogo de cargos al organigrama real de LEAD UPAO (2026-09-08).
--
-- 1. `Admin TI` pasa a llamarse `TI`. El nombre venía de usarlo como atajo para
--    conceder permisos en la web; ese atajo ya no hace falta, pero el nivel se
--    mantiene en `admin` porque el equipo de tecnología sigue operando la
--    plataforma (alta y aprobación de miembros, auditoría).
--
--    `requiere_pilar` se queda en TRUE. No es incoherente con `admin`: es el
--    mismo patrón que `Leader`, un cargo ligado a un área. Ponerlo en FALSE
--    borraría el pilar de sus miembros en la primera edición, porque la web
--    hace `pilar = requierePilar ? pilarInput : null`.
--
-- 2. Alta de `Marketing`, cargo vigente que existía en Discord pero no en la
--    tabla. Transversal como Chief of Staff: staff y sin pilar.
--
-- 3. `orden` queda sin colisiones. Ordena el panel y, con --jerarquia, la
--    posición de los roles en Discord.
--
-- El rename se propaga solo a `miembros.cargo` por
-- `miembros_cargo_fkey ... on update cascade`.

begin;

-- 1. Admin TI → TI
update public.roles set nombre = 'TI' where nombre = 'Admin TI';

-- 2. Marketing
insert into public.roles (nombre, nivel_permiso, requiere_pilar, orden)
values ('Marketing', 'staff', false, 6)
on conflict (nombre) do update set
  nivel_permiso  = excluded.nivel_permiso,
  requiere_pilar = excluded.requiere_pilar,
  orden          = excluded.orden;

-- 3. Jerarquía sin colisiones
update public.roles set orden = 1 where nombre = 'President';
update public.roles set orden = 2 where nombre = 'Vice-President';
update public.roles set orden = 3 where nombre = 'TI';
update public.roles set orden = 4 where nombre = 'Chief of Staff';
update public.roles set orden = 5 where nombre = 'Treasure / Fundraising';
update public.roles set orden = 6 where nombre = 'Marketing';
update public.roles set orden = 7 where nombre = 'Leader';
update public.roles set orden = 8 where nombre = 'Member';

commit;

-- Verificación:
--   select nombre, nivel_permiso, requiere_pilar, orden from public.roles order by orden;
--   select cargo, count(*) from public.miembros group by cargo;   -- 'Admin TI' debe haber desaparecido
