# Continuación: el circuito de tareas, cerrado y verificado

Estado al cerrar la sesión del 2026-09-10/11. El tablero está rediseñado y el
circuito web ↔ Discord funciona en las dos direcciones, probado de extremo a
extremo contra producción.

## Lo que quedó funcionando

El tablero (`apps/web/src/components/admin/`) resuelve los cinco problemas del
traspaso anterior: área como filtro con «todas» por defecto, tareas generales
visibles, scroll por columna, búsqueda y filtros, y `fecha_vencimiento`
expuesta, ordenable y editable en el sitio.

Verificado en el servidor real, no razonado: creación web → hilo con etiqueta y
fecha; estado web → etiqueta en Discord; **etiqueta en Discord → tablero**;
cambio de fecha anunciado en el hilo; borrado → hilo bloqueado y archivado; y
la auditoría registrando por primera vez desde que existe el proyecto.

## Los dos hallazgos que costaron la sesión

Ninguno se veía leyendo el código. Los dos fallaban **en silencio**, sin
excepción y sin log, y los dos aparecieron probando de verdad.

### 1. `REPLICA IDENTITY FULL` nunca se aplicó

La migración `0008` la declara, pero está en sus últimas líneas y ese archivo
quedó truncado a una línea en el commit `9385912`, restaurado en `33682df`. Lo
que se pegó en el SQL editor fue la versión corta. Verificado:
`relreplident = 'd'`.

Sin ella, Postgres solo publica la clave primaria en el registro anterior de
cada evento, y el bot compara anterior contra nuevo en cinco sitios. Los cinco
concluían «no cambió nada» y no hacían nada. Lo arregla la migración `0013`,
que cubre `tareas`, `roles` y `pilares`.

### 2. Realtime recorta el registro anterior de los `DELETE` con RLS

Medido: en el mismo evento, `payload.old.id` vale 15 y
`payload.old.id_discord_hilo` es `undefined`. Supabase no puede evaluar la
política sobre una fila que ya no existe, así que manda solo la clave primaria.
**`relreplident` no influye**: con la identidad en `full` los `UPDATE` llegan
completos y los `DELETE` siguen llegando pelados.

No hay migración que lo arregle y quitar RLS de `tareas` sería volver al
incidente P0. Por eso el borrado es la única parte del circuito que no viaja
por Realtime: `eliminarTarea` lee el `id_discord_hilo` antes de borrar y se lo
manda al bot por `POST /api/tarea-cerrada`. Ver `docs/discord-tareas.md`.

## Migraciones aplicadas en esta sesión

`0011` (fecha de vencimiento), `0012` (`logs_auditoria` con los tipos reales) y
`0013` (identidad de réplica). Las tres verificadas contra la base después.

## Trampas operativas que conviene recordar

- **Tocar la publicación de Realtime obliga a reiniciar a los suscriptores.**
  Al aplicar la `0013`, el bot dejó de recibir eventos hasta que se reinició.
  No dio ningún error: simplemente dejó de sincronizar.
- **Un handler de evento que lanza puede tumbar el bot.** `index.js` registra
  los eventos sin `try/catch` ni `.catch()`, así que un rechazo no capturado en
  un `execute` async termina el proceso. No ha pasado, pero está a un error de
  distancia.
- **La base estuvo caída media sesión** con `544 DatabaseTimeout`: consultas al
  catálogo del sistema, sin tocar tablas, tardaban 11-14 segundos. No era el
  esquema, era la instancia sin CPU.

## Consecuencia de permisos que hay que decidir

Editar las etiquetas de un post ajeno en Discord exige `ManageThreads`, que
está en los presets `staff` y `admin` pero **no en `member`**. Como los hilos
de las tareas creadas desde la web pertenecen al bot, **un miembro raso no
puede moverlas de columna desde el foro**. Sí puede con las que abra él mismo.
O se le concede el permiso en los foros de tareas, o se asume que el camino de
vuelta es para líderes.

## Lo que sigue abierto

- **Recordatorios de vencimiento.** Necesita una columna de idempotencia
  (`tareas.recordatorio_enviado_en`) y decidir dónde se avisa. Ojo con que el
  servicio de Render no se duerma.
- **`tareas.responsable_id`.** Lo que más falta: hoy una tarea es de un área,
  no de una persona. Desbloquea `/mis-tareas`, los recordatorios dirigidos y la
  mitad del traspaso de responsabilidades.
- **Producto**: registro de cuentas de la organización **sin contraseñas**,
  catálogo de recursos con responsable y última revisión, traspaso al irse
  alguien, y un panel de Presidencia que responda «qué necesita atención» en
  vez de «cómo vamos».

## Pendientes que no son de producto

- **Higiene de credenciales: hay trabajo pendiente y NO se detalla aquí.**
  Incluye rotaciones, limpieza de un repositorio y retirada de claves
  heredadas. Este repositorio es público, así que enumerar qué está expuesto y
  dónde mientras sigue expuesto solo sirve a quien busca. La lista vive en el
  canal privado del equipo; el orden importa y está anotado allí.
- Desactivar las claves JWT heredadas en Supabase. Las apps ya usan las nuevas
  (`sb_publishable_` / `sb_secret_`), así que no se rompe nada al hacerlo.
- `DISCORD_GUILD_ID` en Vercel: sin él, el tablero muestra el icono del hilo
  sin enlace. Opcional y degrada solo.
- Sin verificar en real: el banner de bienvenida y `/verificar`.
- **Hilos huérfanos de las pruebas** en `🚀-backlog-tareas`. El bot no borra
  hilos por diseño; hay que quitarlos a mano.
- Sueltos en Discord: la categoría `Área de Innovación Tecnológica` vacía y su
  foro, que el script lista en cada ejecución y nunca borra.
