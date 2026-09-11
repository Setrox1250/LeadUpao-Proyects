# Continuación: propuestas del bot y del producto

Estado al cerrar la sesión del 2026-09-10. El rediseño del tablero está hecho;
lo que queda son decisiones, no trabajo pendiente de una tarea empezada.

## Lo que se hizo

El tablero de tareas (`apps/web/src/components/admin/`) resuelve los cinco
problemas que dejó la sesión anterior: el área es un filtro con «todas» por
defecto, las tareas generales (`pilar is null`) ya aparecen, cada columna
tiene su scroll, hay búsqueda y filtros, y `fecha_vencimiento` se ve, se
ordena y se edita.

Dos hallazgos salieron probándolo en el navegador, no leyendo el código: una
tarea completada seguía anunciándose como vencida, y el editor de fecha
guardaba en cada `change`, así que teclear la fecha a mano mandaba a la base
un año `0002`. Ambos corregidos.

La regla de permisos sobre tareas vive ahora en un solo sitio
(`lib/actions/tareas.ts`), porque las tareas sin área obligaron a decidir
explícitamente quién las mueve: antes la comparación `perfil.pilar ===
tarea.pilar` se las concedía por coincidencia de NULLs a quien no tiene área.

`lib/fechas.ts` concentra el manejo de fechas de calendario, con nueve pruebas
que corren en `npm run check` bajo zonas de UTC-11 a UTC+14.

## Verificado contra producción

La base estuvo caída media sesión con `544 DatabaseTimeout`: consultas al
catálogo del sistema, sin tocar ninguna tabla, tardaban 11-14 segundos. No era
el esquema ni una consulta lenta, era la instancia sin CPU. Al volver:

- **Migración `0011` aplicada.** `tareas.fecha_vencimiento` existe y es un
  `date` de verdad: rechaza `2026-02-31` y `manzana`.
- **Migración `0010` aplicada.** `anon` tiene revocado el SELECT sobre
  `tareas`, que es lo que hace esa migración.
- La consulta `or=(pilar.is.null,pilar.eq."Área Académica")` responde 200 con
  tildes y espacios en el nombre.
- Seis áreas con rol, categoría y foro de Discord vinculados; ocho cargos con
  su `discord_role_id`.
- `logs_auditoria` devuelve 404: no existe.
- `tareas` está vacía, 0 filas.

## Lo que sigue sin probarse de extremo a extremo

El circuito completo con Discord. Cualquier INSERT en `tareas` abre un hilo
real en un foro del servidor, así que la prueba quedó aplazada a propósito.
Cuando se haga, la secuencia es: crear con fecha → ver el hilo con su etiqueta
→ cambiar el estado desde la web → ver la etiqueta cambiar en Discord →
borrar.

## Las quince decisiones abiertas

Están en el artefacto de la sesión, con el detalle y la recomendación de cada
una. Resumen por si el enlace se pierde:

**Ya resueltas** — 1) la guarda de «el estado no cambió» en el listener.
2) `/tarea-crear` rehecho, con área por autocompletado y fecha.
3) `isFounder` comparaba cargos en inglés y tenía a los siete miembros fuera
de Configuración. 8) `threadCreate` ya guarda el primer mensaje del hilo como
descripción.

**Sigue roto** — 4) la auditoría no guarda nada porque `logs_auditoria` no
existe, y la migración `0001` no puede aplicarse tal cual: declara
`actor_id uuid` contra `miembros.id bigint`.

**Bot, sin decidir** — 5) dónde va la fecha de entrega en Discord; hoy cambia
en silencio. 6) recordatorios de vencimiento. 7) `threadUpdate` para que el
estado vuelva de Discord a la web. 9) `/mis-tareas` depende de
`responsable_id`. 10) borrar un pilar borra el rol de Discord, contra lo que
dice `docs/discord-tareas.md`.

**Producto** — 11) registrar cuentas de la organización sin contraseñas.
12) catálogo de recursos con responsable y última revisión. 13) traspaso al
irse alguien. 14) `tareas.responsable_id`. 15) el panel del Presidente debería
responder «qué necesita atención», no «cómo vamos».

El ítem 1 era requisito de los ítems 5 y 7, y ya está dentro. El 14 desbloquea
el 9, el 6 y la mitad del 13.

## Pendientes que no son de producto

- **Higiene de credenciales: hay trabajo pendiente y NO se detalla aquí.**
  Incluye rotaciones, limpieza de un repositorio y retirada de claves
  heredadas. Este repositorio es público, así que enumerar qué está expuesto y
  dónde mientras sigue expuesto solo sirve a quien busca. La lista vive en el
  canal privado del equipo; el orden importa y está anotado allí.
- Desactivar las claves JWT heredadas en Supabase. Las apps ya usan las nuevas
  (`sb_publishable_` / `sb_secret_`), así que no se rompe nada al hacerlo.
- `DISCORD_GUILD_ID` en Vercel: sin él, el tablero muestra el icono del hilo
  sin enlace. Es opcional y degrada solo.
- Sin verificar en real: el banner de bienvenida y `/verificar`.
- Sueltos en Discord: la categoría `Área de Innovación Tecnológica` vacía y su
  foro, que el script lista en cada ejecución y nunca borra.
