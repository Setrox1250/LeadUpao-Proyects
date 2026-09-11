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

## Acceso al panel

Tres vías, las tres verificadas en producción:

1. **Discord**, con la cuenta vinculada.
2. **Código de verificación + contraseña.**
3. **`/recuperar`**: tu `LEAD-XXXX` y el bot te manda un código de seis dígitos
   por mensaje directo. Es la salida para quien olvida la contraseña, y no
   depende de correo ni de que otro administrador intervenga.

## Qué pasó y qué se aprendió

Está en [`bitacora-2026-09-11.md`](bitacora-2026-09-11.md). En una línea cada
uno, por si no abres el documento:

- **`REPLICA IDENTITY FULL` nunca se aplicó**, porque la sentencia estaba en
  las últimas líneas de un archivo que llegó truncado al SQL editor. Una
  migración escrita no es una migración aplicada: hay que comprobarla contra la
  base.
- **Realtime recorta el registro anterior de los `DELETE` en tablas con RLS.**
  No lo arregla ninguna migración. Cualquier acción que dependa de datos de una
  fila borrada tiene que leerlos antes de borrar y mandarlos explícitamente.
- **Rotar una clave son cuatro variables en tres sitios**, y las `NEXT_PUBLIC_`
  se incrustan en el bundle al compilar: cambiarlas sin redesplegar no hace
  nada.
- **Un `const { data } = await ...` que ignora el `error` es un fallo silencioso
  esperando su turno.** Cuatro de ellos convirtieron una clave caducada en
  mensajes que culpaban al usuario.

## Decidido: el miembro raso usa la web, no el foro

Editar las etiquetas de un post ajeno en Discord exige `ManageThreads`, que
está en los presets `staff` y `admin` pero **no en `member`**. Como los hilos
de las tareas creadas desde la web pertenecen al bot, un miembro raso no puede
moverlas de columna desde el foro.

**No se le concede el permiso.** Marca la tarea desde el panel web, que ya lo
permite sin ningún cambio: la pestaña Tareas no está restringida, y
`puedeEditarTarea` deja mover cualquier tarea cuyo `pilar` coincida con el
suyo. El camino de vuelta desde el foro queda para líderes, que es quien tiene
`ManageThreads`.

Queda un hueco conocido: las tareas **generales** (`pilar is null`) son de
staff para arriba también en la web. Si algún día se quiere que un miembro las
mueva, hay que tocar `puedeEditarTarea`.

## Lo que sigue abierto

**Lo siguiente es `tareas.responsable_id`**, decidido al cerrar la sesión. Hoy
una tarea pertenece a un área y no a una persona, y con diez personas eso pesa
más que cualquier otra cosa de esta lista. Es columna nueva, no un renombrado:
`autor_id` es texto sin clave foránea y significa otra cosa —quién la creó—,
así que ambas conviven. Desbloquea `/mis-tareas`, los recordatorios dirigidos a
una persona en vez de a un canal, y la mitad del traspaso de responsabilidades.

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

- **Higiene de credenciales: terminada** el 2026-09-11 y comprobada. Claves de
  servicio rotadas y separadas por consumidor, JWT heredadas desactivadas, token
  del bot rotado, y las cuatro variables propagadas a Vercel y Render. Queda
  solo borrar un archivo de depuración en el repositorio `LeadUpao-Web`: al
  desactivarse las claves heredadas dejó de ser urgente, es limpieza.
- **Barrer los `const { data } = await ...` que ignoran el `error`.** Quedan en
  `eliminarMiembro`, `aprobarMiembro` y varios del panel. Es mecánico, y evita
  la clase de tarde del 11 de septiembre: una clave caducada que se manifiesta
  como «tu cuenta no está registrada».
- `DISCORD_GUILD_ID` en Vercel: sin él, el tablero muestra el icono del hilo
  sin enlace. Opcional y degrada solo.
- Sin verificar en real: el banner de bienvenida y `/verificar`.
- **Hilos huérfanos de las pruebas** en `🚀-backlog-tareas`. El bot no borra
  hilos por diseño; hay que quitarlos a mano.
- Sueltos en Discord: la categoría `Área de Innovación Tecnológica` vacía y su
  foro, que el script lista en cada ejecución y nunca borra.
