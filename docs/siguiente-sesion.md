# Continuación: mejora del tablero y propuestas para el bot

Estado al cerrar la sesión del 2026-09-09. La base de datos y la sincronización
con Discord quedaron funcionando; lo que sigue es producto, no infraestructura.

## Punto de partida

Ya aplicado y verificado: monorepo desplegado en Render y Vercel, 6 áreas con su
categoría y foro en Discord, 8 cargos con permisos, circuito de tareas probado en
ambas direcciones, banner sin navegador, y RLS por área en `tareas` y `miembros`.

La migración `0011` ya añadió `tareas.fecha_vencimiento`, pero **nada la usa
todavía**: ni el formulario de creación, ni las Server Actions, ni el tablero.

## Web — rediseño del tablero

`apps/web/src/components/admin/TasksBoard.tsx` (292 líneas).

Problemas concretos, no impresiones:

1. **La Directiva ve un área a la vez.** El filtro es
   `tasks.filter(t => t.pilar === selectedPilar)` con un desplegable de una sola
   selección. El Presidente no puede ver el conjunto, que es justo lo que
   necesita.
2. **Las tareas generales son invisibles.** Ese mismo filtro descarta siempre
   `pilar = null`, y son precisamente las del foro general.
3. **Las columnas crecen sin límite.** Sin `max-height` ni scroll propio: con
   treinta tareas en Backlog la página se vuelve inmanejable.
4. **No hay búsqueda, ni orden, ni filtro por etiqueta o estado.**
5. **Falta exponer `fecha_vencimiento`**: en la tarjeta, en el formulario de
   creación, y como criterio de orden. Con distinción visual de vencida,
   próxima y futura.

Dirección sugerida: conservar el Kanban como vista por defecto y añadir una
vista de **lista densa** para volumen alto, con una barra de filtros común
(área con opción «todas», estado, etiqueta, búsqueda por título). Mostrar el
badge de área en las tarjetas cuando se ven varias áreas a la vez.

Cuidado con las fechas: `fecha_vencimiento` es `date` y viaja como
`'YYYY-MM-DD'`. Construir `new Date(valor)` la interpreta como UTC y en
America/Lima (UTC-5) la muestra un día antes. Compararla y formatearla como
cadena, o fijar la zona explícitamente.

## Bot — propuestas, ninguna decidida

- **Fecha de entrega en Discord.** Hoy el hilo no la refleja. Opciones: mensaje
  inicial, mensaje fijado, o sufijo en el nombre del hilo.
- **Recordatorios de vencimiento.** El bot ya tiene un temporizador propio
  (`services/supabaseKeepAlive.js`) que sirve de modelo.
- **`/tarea-crear` está desactualizado.** Inserta `estado: 'PENDIENTE'`, que ya
  no existe en el contrato, y no acepta área ni fecha.
- **`/mis-tareas`**, que hoy no existe.

## Pendientes que no son de producto

- Rotar el `DISCORD_TOKEN`, que se imprimió por error en una sesión anterior.
- Desactivar las claves JWT heredadas en Supabase. Las apps ya usan las nuevas
  (`sb_publishable_` / `sb_secret_`), así que no se rompe nada.
- Borrar `query_member_debug.js` de `LeadUpao-Web`: contiene la `service_role`
  heredada y el repositorio es público. Rotar primero, borrar después.
- Sin verificar en real: el banner de bienvenida y `/verificar`.
- Sueltos en Discord: la categoría `Área de Innovación Tecnológica` vacía y su
  foro, que quedaron sin uso al adoptar los canales previos del equipo. El
  script los lista en cada ejecución y nunca los borra.
