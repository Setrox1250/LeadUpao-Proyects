-- Fecha de entrega para tareas, eventos y proyectos.
--
-- Se usa `date` y no `timestamptz` a propósito: una fecha de entrega es un día
-- del calendario, no un instante. Guardarla como marca de tiempo obliga a
-- elegir una hora arbitraria y, con el desfase de America/Lima (UTC-5), hace
-- que una entrega del día 10 se muestre como día 9 según desde dónde se mire.
-- Con `date` no hay conversión posible: el valor viaja como 'YYYY-MM-DD'.

begin;

alter table public.tareas
  add column if not exists fecha_vencimiento date;

comment on column public.tareas.fecha_vencimiento is
  'Día de entrega. NULL = sin fecha. Tipo `date` para que no la desplace ninguna zona horaria.';

-- El tablero ordena y filtra por vencimiento; las tareas sin fecha se excluyen
-- del índice porque nunca se consultan por ella.
create index if not exists tareas_fecha_vencimiento_idx
  on public.tareas (fecha_vencimiento)
  where fecha_vencimiento is not null;

commit;
