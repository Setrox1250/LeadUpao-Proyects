# Estructura de tareas en Discord — un foro por área

Decidido el 2026-09-08. Sustituye el `FORUM_CHANNEL_ID` único.

## Estructura objetivo

Una categoría por pilar, con su foro de backlog dentro:

```text
📁 Technological Innovation        ← categoría, permisos por rol de pilar
   └── 📋 backlog-tareas           ← foro; cada post es una tarea
📁 Chapter Development
   └── 📋 backlog-tareas
   ...                             (8 pilares)

📋 backlog-general                 ← fuera de las categorías, visible a todos
```

La categoría puede contener otros canales del área (chat, voz). El bot solo
gestiona el foro de tareas; el resto es del equipo.

### Adopción de canales existentes

Un área que ya tenía su espacio en Discord no recibe una estructura paralela:
el script la **adopta** por id mediante el mapa `ADOPCION` de
`scripts/bootstrap-discord-areas.mjs`, y **no la renombra**. El nombre canónico
de la BD manda para los roles, pero un canal con historia y convenciones
propias conserva el nombre que su equipo le puso. Los permisos sí se
sincronizan, para que la Directiva tenga acceso.

Así se resolvió `Área de Innovación Tecnológica`, que adopta
`🚀 INNOVACIÓN TECNOLÓGICA` y su `🚀-backlog-tareas` —una categoría con canales
de trabajo reales— en vez de duplicarla. Las etiquetas de estado se añaden
conservando las que el equipo ya usaba.

Los canales que el script llegó a crear y quedan sin referencia se listan al
final de cada ejecución, para borrarlos a mano si se quiere. El script nunca
los borra.

## Por qué el canal es el dato

Hoy una tarea creada desde Discord no tiene forma de saber a qué área
pertenece: `threadCreate.js` no fija `pilar`. Con un foro por área, **el canal
donde se publica determina el pilar**. La búsqueda inversa
`thread.parentId → pilares.discord_forum_id` lo resuelve sin pedirle nada al
usuario.

## Esquema

Dos columnas en `pilares`, calcadas de la que ya existe (`discord_role_id`):

```sql
alter table public.pilares
  add column if not exists discord_category_id varchar(50),
  add column if not exists discord_forum_id    varchar(50);
```

`tareas.pilar` **admite NULL** (ver «Tareas sin área»), con FK a
`pilares(nombre) on update cascade`, igual que `miembros.pilar`.

> `tareas.pilar` no existe hoy en producción pese a que el tipo `Tarea` de la
> web lo declara obligatorio. Esta columna se crea en la Fase 1.

## Las dos direcciones

| Dirección | Resolución |
|---|---|
| Web → Discord | `tarea.pilar` → `pilares.discord_forum_id`; si es NULL → foro general |
| Discord → Web | `thread.parentId` → pilar inverso; si es el foro general → `pilar = NULL` |

## Permisos

Los resuelve Discord, no el código, mediante overwrites en la **categoría**:

- `@everyone` → denegar *Ver canal*
- rol del pilar (`pilares.discord_role_id`) → permitir
- roles con `nivel_permiso = 'admin'` (`roles.discord_role_id`) → permitir

Así la Directiva ve todas las áreas sin lógica adicional. En la web la
visibilidad equivalente es RLS por pilar con excepción para admin, planificada
en la Fase 1.

El bot necesita **Gestionar canales** y **Gestionar roles**, y su propio rol
debe estar por encima de los roles de pilar.

## Ciclo de vida: el bot crea, nunca borra

Extiende el patrón que ya funciona para roles (`supabaseListener.js:254`,
`index.js:112`): fila en la BD → objeto en Discord → id escrito de vuelta.

| Evento en `pilares` | Acción del bot |
|---|---|
| INSERT | Crea categoría, crea el foro dentro, aplica overwrites, guarda ambos IDs |
| UPDATE de `nombre` | Renombra categoría y foro |
| DELETE | Retira al rol del área el acceso a su categoría. No borra nada |

La asimetría en DELETE es deliberada. Un foro de área acumula meses de hilos y
Discord no tiene papelera, así que el borrado de canales queda como acción
manual y deliberada dentro de Discord. El bot solo retira el acceso, que se
revierte volviendo a conceder el permiso.

Tampoco se borra el rol del área. La versión anterior de este documento decía
que para un rol era aceptable porque «se recrea en dos clics»: no es cierto.
Recrearlo exige además repartirlo de nuevo entre todos los miembros del área,
y ese trabajo no lo apunta nadie. Para un **cargo** sí se borra el rol, porque
de él no cuelga ningún canal con historia.

Y no se «archiva el foro», como decía antes esta tabla: en Discord se archivan
los hilos, no los canales de foro. La retirada efectiva es por permisos.

Lo que queda huérfano —foro, categoría y rol— se lista en el log del bot, igual
que hace `scripts/bootstrap-discord-areas.mjs`, para que alguien decida a mano
después de ver lo que contiene.

## Tareas sin área

`tareas.pilar` admite NULL y esas tareas van a un foro general de respaldo,
visible para todos, configurado en `GENERAL_FORUM_CHANNEL_ID`.

Consecuencias que hay que respetar al implementar:

- La RLS de `tareas` necesita el caso `pilar is null` → visible a todos.
- Ambas direcciones de la sincronización tienen dos rutas, no una.
- El foro general vive fuera de las categorías por área, así que el bot no lo
  crea ni lo gestiona: se configura a mano una sola vez.

## Bugs corregidos por el camino

Detectados al verificar contra producción el 2026-09-08. La tabla `tareas` solo
tenía `id`, `titulo`, `etiquetas`, `autor_id`, `estado` e `id_discord_hilo`, así
que **la función de tareas estaba rota en las dos direcciones**:

- La web no podía crear tareas: `crearTarea` inserta `descripcion`, columna
  inexistente. Y consultaba `pilar` al cambiar estado y al borrar.
- El bot no podía crear tareas: `threadCreate.js` insertaba `canal_id` y
  `creador_id`, también inexistentes, y el error se tragaba en el `catch`.
- El bot escribía `estado: 'PENDIENTE'`, fuera del vocabulario de la web.

La migración `0008` añade `descripcion`, `pilar`, `created_at` y `updated_at`,
fija el `check` de estado y activa `REPLICA IDENTITY FULL`.

## El borrado no pasa por Realtime

Medido en producción el 2026-09-11: **Supabase Realtime recorta el registro
anterior de los eventos `DELETE` cuando la tabla tiene RLS activo.** Manda solo
la clave primaria, porque no puede evaluar la política sobre una fila que ya no
existe. Da igual `relreplident`: con la identidad en `full`, los `UPDATE`
llegan completos y los `DELETE` siguen llegando pelados.

El log lo enseña en dos líneas del mismo evento: `payload.old.id` vale 15 y
`payload.old.id_discord_hilo` es `undefined`.

Eso deja al bot sin saber qué hilo cerrar, y fallaba en silencio: el hilo se
quedaba abierto dando a entender que la tarea seguía viva. No hay migración que
lo arregle; desactivar RLS en `tareas` sería volver al incidente P0.

Así que el borrado es la única parte del circuito que **no** viaja por
Realtime:

```text
web: eliminarTarea()
  1. lee id_discord_hilo          ← el bot no puede conseguirlo después
  2. borra la fila
  3. POST /api/tarea-cerrada al bot con ese id
```

El aviso va **después** del borrado: si el borrado fallara, habríamos cerrado
el hilo de una tarea viva. El id ya está en memoria, así que perderlo de la
base no importa.

Es de mejor esfuerzo. Si el bot está dormido en Render, la tarea queda borrada
igual y la web lo dice: «su hilo de Discord sigue abierto». Un borrado no se
deshace porque un servicio secundario no conteste.

## Estado y fecha de entrega

El estado viaja en las dos direcciones:

| Origen | Camino |
|---|---|
| Panel web | `UPDATE tareas.estado` → Realtime → `supabaseListener` pone la etiqueta y avisa en el hilo |
| Foro | cambio de etiqueta → `events/threadUpdate.js` → `UPDATE tareas.estado` |

El rebote se corta mirando el mundo, no una marca en memoria: si el hilo ya
lleva puesta la etiqueta del estado nuevo, el cambio vino del foro y no se
reenvía. Así sigue funcionando aunque el bot se reinicie entre ambos pasos.
La decisión vive en `decidirAccion()` y está cubierta por pruebas.

`fecha_vencimiento` aparece en el mensaje inicial del hilo y se anuncia con una
línea corta cuando cambia. Va en texto plano y no como `<t:unix:D>`: ese
formato es un instante y Discord lo traduce a la zona de cada quien, que
desplazaría el día justo como se quiere evitar. Y no va en el nombre del hilo
porque el nombre es el título de la tarea y viaja en las dos direcciones: un
sufijo acabaría dentro del título en la base.

## Estado de la implementación

- **Hecho** — estructura en Discord (6 categorías con su foro), mapeo en
  `pilares`, contrato de `tareas`, y el bot resolviendo el foro por área en
  ambas direcciones vía `services/foros.js`.
- **Hecho** — RLS de `tareas` por área (migración `0010`): la Directiva ve
  todo, el resto su propia área, y las tareas sin área las ve todo el mundo.
  Solo SELECT; las escrituras siguen pasando por Server Actions. Es lo que
  devuelve la vida al Kanban en tiempo real, porque Supabase Realtime comprueba
  RLS con el JWT del suscriptor y antes no entregaba nada al navegador.
- **Fase 3** — la web filtra y muestra por área, y añade el modelo temporal.
