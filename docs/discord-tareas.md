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
| DELETE | **Archiva** el foro y retira los overwrites. No borra nada |

La asimetría en DELETE es deliberada. El código actual sí borra el rol de
Discord al eliminar un pilar, y para un rol eso es aceptable: se recrea en dos
clics. Un foro con meses de hilos, no — Discord no tiene papelera. El borrado
de canales queda como acción manual y deliberada dentro de Discord.

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

## Estado de la implementación

- **Hecho** — estructura en Discord (6 categorías con su foro), mapeo en
  `pilares`, contrato de `tareas`, y el bot resolviendo el foro por área en
  ambas direcciones vía `services/foros.js`.
- **Fase 1** — RLS de `tareas` por pilar, con el caso `pilar is null` visible
  para todos. Hoy la tabla tiene RLS activo y **cero políticas**, así que solo
  `service_role` accede: el Realtime del Kanban no llega al navegador.
- **Fase 3** — la web filtra y muestra por área, y añade el modelo temporal.
