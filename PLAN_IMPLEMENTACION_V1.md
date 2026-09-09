# Plan de implementación y delegación — LEAD UPAO V1

## 1. Objetivo

Consolidar los repositorios actuales en un único monorepo y publicar una V1 estable de la plataforma interna de LEAD UPAO.

La V1 tendrá tres módulos web:

1. Registro y administración de miembros.
2. Calendario y administración de tareas.
3. Catálogo temporal de repositorios, fuentes de datos, dashboards, documentos y herramientas utilizadas por LEAD mientras se implementa la plataforma oficial.

El bot de Discord continuará como integración de la plataforma para:

- Dar la bienvenida a nuevos usuarios.
- Vincular miembros mediante `/verificar`.
- Sincronizar roles y pilares.
- Sincronizar tareas e hilos de Discord cuando corresponda.

> En este documento, “centros de datos” se interpreta como un catálogo de fuentes de datos y recursos enlazados. No incluye un explorador SQL ni almacenamiento de credenciales.

## 2. Estado verificado de los repositorios

### 2.1 Referencias actuales

| Repositorio | Referencia | Estado |
|---|---|---|
| `LeadUpao-Proyects` | `main` — `5554211` | Copia integrada antigua y divergente |
| `LeadUpao-Proyects` | `setroxBranch` — `350c6d9` | Integración más completa y base recomendada |
| `LeadUpao-Bot` | `main` — `6a2597b` | No ejecutable; contiene conflictos de Git guardados como código |
| `LeadUpao-Bot` | `setroxBranch` — `c4e4e9c` | Última base sintácticamente válida del bot |
| `LeadUpao-Web` | `main` — `10ceeac` | Base funcional dentro del alcance reducido |
| `LeadUpao-Web` | `setroxBranch` — `7e3890a` | Añade redes sociales y mejoras de registro; es descendiente de `main` |

El árbol del bot en `LeadUpao-Proyects/setroxBranch` coincide con `LeadUpao-Bot/setroxBranch`. El árbol web de esa misma rama coincide con `LeadUpao-Web/setroxBranch`. Por ello, `350c6d9` es la base práctica para formar el monorepo sin perder el trabajo limpio de las ramas individuales.

### 2.2 Hallazgos verificados

Todos los hallazgos de esta sección fueron confirmados contra los repositorios locales.
Se cita la evidencia para que cualquier responsable pueda reproducir la verificación.

- **Conflictos guardados como código.** `6a2597b` contiene marcadores en exactamente 6
  archivos, todos ejecutables o manifiestos: `index.js`, `commands/verificar.js`,
  `events/guildMemberAdd.js`, `services/supabaseListener.js`, `package.json` y
  `package-lock.json`.
  Evidencia: `git grep -l -E '^(<<<<<<< |>>>>>>> )' 6a2597b`.
- **Historias sin ancestro común.** `git merge-base 1ae72a6 c4e4e9c` no devuelve nada.
  El merge `6a2597b` unió dos líneas independientes; por eso los conflictos son totales
  y no vale la pena resolverlos a mano.
- **`node_modules` versionado solo en `LeadUpao-Bot/main`.** Son 6 128 archivos en
  `6a2597b`, pero **0 en `c4e4e9c` y 0 en `350c6d9`**. Como el monorepo parte de
  `350c6d9`, no hay nada que limpiar del índice ni del historial: basta con el
  `.gitignore` y un control de CI que impida la reintroducción.
- **Los árboles coinciden exactamente.** `350c6d9:backend-bot` es el tree
  `3330960322a2b9dc8d0a658b636310d87a013f2f`, idéntico a `c4e4e9c^{tree}`; y
  `350c6d9:web-lead` es `55f7a8afac962c50161de3d3d0d2c41293cb53da`, idéntico a
  `7e3890a^{tree}`. Partir de `350c6d9` no pierde ningún trabajo de las ramas
  individuales.
- **La web no tiene modelo temporal.** `Tarea` en `src/types/index.ts` expone
  `id`, `id_discord_hilo`, `titulo`, `descripcion`, `etiquetas`, `autor_id`, `estado`,
  `pilar` y `created_at`. No hay fechas de inicio ni de vencimiento, ni responsable
  distinto del autor.
- **Los estados de tarea ya divergen y rompen datos en producción.** La web define
  `EstadoTarea = 'BACKLOG' | 'EN_PROGRESO' | 'COMPLETADO'` y el Kanban solo renderiza
  esas tres columnas (`src/lib/constants.ts`). El bot inserta `estado: 'PENDIENTE'`
  en `commands/tarea-crear.js:41` y en `events/threadCreate.js:25`. **Toda tarea creada
  desde Discord cae en un estado que la web no muestra.** Requiere migración de datos,
  no solo unificación de contratos.
- **Las migraciones no corren desde cero en absoluto.** No es solo `tareas`:
  `supabase/migrations/0002_roles_pilares.sql` hace `update public.tareas` y
  `alter table public.tareas add constraint tareas_pilar_fkey` sobre una tabla que
  ningún `.sql` del repositorio crea, y hace
  `alter table public.miembros alter column pilar drop not null` sobre una columna que
  `migration.sql` tampoco crea. **El esquema real solo existe en la base de datos viva.**
- **El choque `bigint`/`uuid` es un FK imposible, no una simple mezcla.**
  `migration.sql` define `miembros.id bigint`, mientras que
  `0001_logs_auditoria.sql:6` define `actor_id uuid references public.miembros(id)`.
  Ese FK no puede haberse aplicado tal cual. Además `src/types/index.ts` declara
  `Miembro.id: string`. Producción divergió del repositorio; hay que determinar el
  tipo real antes de planear la estandarización a UUID.
- **RLS: `authenticated` puede borrar miembros.** Las políticas de `migration.sql` no
  solo permiten actualizar: la política 4 concede `DELETE` a cualquier usuario
  autenticado sobre toda la tabla.
- **Los nombres de variables de entorno no coinciden entre apps.** El mismo secreto
  compartido se llama `DISCORD_SYNC_TOKEN` en la web
  (`src/lib/actions/discordSync.ts:16`) y `SYNC_SECRET_TOKEN` en el bot
  (`index.js:74`). Lo mismo ocurre con `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_KEY`. Es una fuente silenciosa de fallos de
  despliegue.
- No existen suites automatizadas de pruebas ni CI funcional.
- Ningún repositorio tiene tags; no hay una versión estable identificable.

### 2.3 Hallazgo crítico de seguridad (P0) — CONFIRMADO EN PRODUCCIÓN

Verificado contra la base productiva el 2026-09-08:

```text
pg_class.relrowsecurity  public.miembros  →  FALSE
grants sobre public.miembros:
  anon           → DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  authenticated  → DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
políticas sobre public.miembros → ninguna
```

La revisión del repositorio había señalado una política que exponía `miembros` a
`anon`. La realidad es peor: esa política nunca existió porque **RLS jamás llegó a
activarse en la tabla**, mientras los privilegios amplios que Supabase concede por
defecto en el esquema `public` seguían intactos.

Sin RLS, esos grants se aplican sin ningún filtro. La anon key viaja en el bundle
público de Next.js, de modo que **cualquier visitante del sitio desplegado podía leer,
modificar, borrar o truncar la tabla de miembros**, incluidos `contrasena_hash` y
`codigo_verificacion`, y asignarse `rol = 'admin'`.

Es la única tabla afectada. `roles`, `pilares`, `tareas` y `redes_sociales` tienen RLS
activo, y sus políticas son coherentes con lo que la aplicación necesita.

El hotfix, las consultas de auditoría del incidente y el plan de rotación están en
`supabase/hotfix/`.

### 2.4 Esquema real de producción

Confirmado el 2026-09-08. Resuelve la ambigüedad que bloqueaba la Fase 1.

| Tabla | Existe | RLS | Tipo de `id` |
|---|---|---|---|
| `miembros` | sí | **no** | `bigint` |
| `tareas` | sí | sí | `bigint` |
| `roles` | sí | sí | `uuid` |
| `pilares` | sí | sí | `uuid` |
| `redes_sociales` | sí | sí | `uuid` |
| `logs_auditoria` | **no** | — | — |

Consecuencias:

- **`logs_auditoria` no existe.** La migración `0001` nunca se aplicó: define
  `actor_id uuid references public.miembros(id)` y `miembros.id` es `bigint`, así que
  el FK es imposible y aborta. Como `registrarAuditoria()` traga el error a
  `console.error` para no revertir la acción principal, **todos los registros de
  auditoría se han descartado en silencio desde el principio**, y la tabla del panel
  recibe un error. La auditoría de la V1 se construye desde cero, no se «completa».
- **`tareas.autor_id` es `character varying`, no una clave foránea.** No hay
  integridad referencial con `miembros`; el campo `responsable_id` de la Fase 3 es una
  columna nueva, no un rename.
- La estandarización a UUID de la Fase 1 afecta realmente a `miembros` y `tareas`; el
  resto ya es `uuid`.

## 3. Arquitectura objetivo del monorepo

`LeadUpao-Proyects` será el único repositorio oficial y se renombrará, si se desea, a `LeadUpao` cuando termine la migración.

```text
LeadUpao-Proyects/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   ├── next.config.mjs
│   │   ├── package.json
│   │   └── .env.example
│   └── bot/
│       ├── commands/
│       ├── events/
│       ├── services/
│       ├── templates/
│       ├── package.json
│       └── .env.example
├── packages/
│   ├── contracts/
│   └── database/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── docs/
├── scripts/
├── .github/workflows/
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

### 3.1 Responsabilidades

- `apps/web`: aplicación Next.js y experiencia de usuario.
- `apps/bot`: bot e integración con Discord.
- `packages/contracts`: estados, constantes y validaciones compartidas entre web y bot.
- `packages/database`: tipos generados a partir del esquema de Supabase.
- `supabase`: única fuente de verdad para esquema, migraciones, RLS y datos iniciales.
- `docs`: arquitectura, operación, despliegue y recuperación.
- `scripts`: controles repetibles de repositorio y entorno.
- `.github/workflows`: compilación, pruebas y controles de calidad.

### 3.2 Despliegues

- Vercel utilizará `apps/web` como directorio raíz.
- **Render NO puede usar `apps/bot` como directorio raíz.** Con npm workspaces
  el único `package-lock.json` vive en la raíz y las dependencias se elevan
  allí, así que un `npm ci` dentro de `apps/bot` falla por falta de lockfile.
  La configuración correcta, verificada:

  | Ajuste de Render | Valor |
  |---|---|
  | Root Directory | *(vacío: la raíz del repositorio)* |
  | Build Command | `npm ci` |
  | Start Command | `npm start --workspace @leadupao/bot` |

  npm ejecuta el script del workspace con el directorio de trabajo en
  `apps/bot`, que es lo que espera el bot.
- Supabase utilizará `supabase/migrations`.
- Web y bot se desplegarán por separado, pero quedarán asociados al mismo commit del monorepo.

## 4. Estrategia Git

### 4.1 Preparación y respaldos

- [ ] Crear tags anotados para los estados originales:
  - `archive/projects-main-5554211`
  - `archive/projects-integrated-350c6d9`
  - `archive/bot-broken-main-6a2597b`
  - `archive/bot-clean-c4e4e9c`
  - `archive/web-main-10ceeac`
  - `archive/web-feature-7e3890a`
- [ ] Crear `integration/v1-monorepo` desde `350c6d9`.
- [ ] Documentar los hashes completos en `docs/repository-migration.md`.
- [ ] No borrar ni reescribir los repositorios originales durante la migración.

### 4.2 Ramas de trabajo

- `main`: rama protegida, estable y desplegable.
- `integration/v1-monorepo`: integración inicial y saneamiento.
- `fix/database-v1`: esquema, migraciones y seguridad.
- `fix/bot-welcome-banner`: recuperación del bot y banner.
- `feature/member-lifecycle`: flujo completo de miembros.
- `feature/task-calendar`: calendario de tareas.
- `feature/resources-catalog`: catálogo de recursos.
- `release/v1.0.0`: estabilización y release candidate.

No se mantendrá una rama `develop` permanente. Cada frente se integrará mediante PR sobre la rama de integración; después de estabilizar la V1, el trabajo continuará directamente con ramas cortas desde `main`.

### 4.3 Normas de commits y PR

- Un commit debe representar una sola intención.
- Usar Conventional Commits con scope: `web`, `bot`, `db`, `contracts`, `resources`, `ci` o `docs`.
- No combinar migraciones destructivas con cambios visuales.
- Cada PR debe incluir resumen, riesgos, migraciones, pruebas y pasos de rollback.
- Bloquear merges si existen conflictos, fallan pruebas o se detecta `node_modules` versionado.

Ejemplos:

```text
chore(repo): establish npm workspaces
fix(bot): replace browser-based welcome renderer
fix(db): create reproducible v1 schema
feat(web): add member approval workflow
feat(calendar): add monthly and weekly task views
feat(resources): add internal resource catalog
```

## 5. Plan de ejecución por fases

### Fase P — Prerrequisitos críticos

**Objetivo:** cerrar la fuga de credenciales y capturar el esquema real antes de
construir nada encima.

Esta fase no depende del monorepo y debe ejecutarse de inmediato, en paralelo a la
Fase 0. Requiere acceso al panel de Supabase productivo.

Tareas:

- [x] Diagnosticar el estado real de RLS, grants y políticas (ver 2.3).
- [x] Documentar el esquema real y los tipos de clave (ver 2.4).
- [ ] Ejecutar `supabase/hotfix/2026-09-08_auditoria_exposicion.sql` y guardar el
      resultado antes de tocar nada.
- [ ] Aplicar la **etapa 1** del hotfix: `supabase/hotfix/2026-09-08_miembros_grants.sql`.
      No requiere cambio de código.
- [ ] Desactivar el alta libre en Supabase Auth si el flujo no la necesita
      (mitiga el acceso residual de `authenticated` hasta la etapa 2).
- [ ] Rotar todos los `codigo_verificacion` y forzar restablecimiento de contraseña.
- [ ] Rotar la anon key y la service_role key; actualizar Vercel y Render.
- [ ] Capturar el esquema real: `supabase db dump --schema-only` y guardarlo como
      `supabase/migrations/0000_baseline.sql`.
- [ ] **Etapa 2 (por PR):** activar RLS en `miembros` con políticas por fila, moviendo
      antes a `service_role` las dos lecturas que hoy usan la clave anónima
      (`lib/miembro.ts:22` y `app/admin/(dashboard)/page.tsx:73,130`).
      Ver `supabase/hotfix/README.md`.

Criterios de aceptación:

- `curl` con la anon key contra `/rest/v1/miembros` no devuelve datos.
- `miembros` tiene `relrowsecurity = true` y políticas explícitas.
- Existe un baseline versionado que reproduce el esquema productivo en una base vacía.
- Los códigos de verificación y las claves de API están rotados.

> Sin el baseline, el criterio de la Fase 1 "las migraciones funcionan sobre una copia
> del esquema actual" no es verificable: no hay forma de construir esa copia.

### Fase 0 — Consolidación y saneamiento

**Objetivo:** obtener un único repositorio instalable sin perder referencias históricas.

Tareas:

- [ ] Crear tags de respaldo y rama `integration/v1-monorepo`.
- [ ] Mover `web-lead` a `apps/web`.
- [ ] Mover `backend-bot` a `apps/bot`.
- [ ] Crear el `package.json` raíz con npm workspaces.
- [ ] Generar un único `package-lock.json` y borrar los dos lockfiles por subproyecto.
- [ ] Consolidar `.gitignore`, con excepción explícita `!**/.env.example`
      (el patrón `**/.env.*` heredado ignora los propios ejemplos).
- [ ] Crear `.env.example` para raíz, web y bot, documentando que el secreto compartido
      se llama `DISCORD_SYNC_TOKEN` en la web y `SYNC_SECRET_TOKEN` en el bot.
- [ ] Crear comandos raíz `build`, `lint`, `test` y `check`.
- [ ] Añadir un script que rechace marcadores de conflicto y `node_modules` indexado.
- [ ] Comparar nuevamente los árboles contra los repositorios originales.

No hace falta eliminar `node_modules` del índice: `350c6d9` no lo tiene versionado
(ver 2.2). El control de CI existe para impedir que vuelva a entrar.

Criterios de aceptación:

- `npm ci` funciona desde la raíz.
- Web y bot pueden ejecutarse mediante comandos del workspace.
- `npm run check` pasa en limpio.
- Los árboles `apps/web` y `apps/bot` siguen siendo idénticos a `7e3890a` y `c4e4e9c`.
- Existe un informe de archivos recuperados, omitidos o renombrados.

### Fase 1 — Contratos y base de datos

**Objetivo:** crear una única definición compatible para web, bot y Supabase.

Tareas:

- [ ] Partir del `0000_baseline.sql` producido en la Fase P; no reconstruir el esquema
      desde `migration.sql`, que ya no refleja producción.
- [ ] Definir estados compartidos de miembro y tarea.
- [ ] Migrar los datos existentes: `update tareas set estado = 'BACKLOG'
      where estado = 'PENDIENTE'` (tareas creadas por el bot, invisibles hoy en el Kanban).
- [ ] Estandarizar identificadores como UUID, resolviendo antes el FK imposible entre
      `logs_auditoria.actor_id` (uuid) y `miembros.id` (bigint).
- [ ] Unificar los nombres de variables de entorno compartidas entre web y bot.
- [ ] Crear migraciones ordenadas para `miembros`, `roles`, `pilares`, `tareas`,
      `recursos` y `logs_auditoria`. Esta última **se crea desde cero**: nunca llegó a
      existir en producción (ver 2.4).
- [ ] Crear una migración de transición que preserve los datos existentes.
- [ ] Eliminar scripts productivos que ejecuten `DROP TABLE`.
- [ ] Añadir constraints, índices y claves foráneas.
- [ ] Configurar Realtime y `REPLICA IDENTITY FULL` donde sea necesario.
- [ ] Corregir RLS con políticas por actor, rol y pilar.
- [ ] Generar los tipos de base de datos en `packages/database`.
- [ ] Añadir seed mínimo de roles, pilares y entorno de prueba.

Criterios de aceptación:

- Las migraciones funcionan en una base vacía.
- Las migraciones funcionan sobre una copia anonimizada del esquema actual.
- Un miembro normal no puede modificar roles, otros miembros ni tareas ajenas.
- Bot y web comparten los mismos nombres de campos y estados.

### Fase 2 — Ciclo de vida de miembros

**Objetivo:** terminar el flujo de registro, aprobación y acceso.

Tareas:

- [ ] Validar nombre, correo y contraseña en servidor.
- [ ] Definir si el correo debe pertenecer a un dominio institucional.
- [ ] Añadir rate limiting y protección anti-bot al registro.
- [ ] Crear el miembro en estado pendiente.
- [ ] Permitir aprobación, edición, baja y restablecimiento de contraseña.
- [ ] Mantener roles y pilares como configuración administrativa.
- [ ] Completar login por código y contraseña.
- [ ] Vincular Discord mediante `/verificar`.
- [ ] Registrar acciones críticas en auditoría.
- [ ] Añadir pruebas de permisos y transiciones de estado.

Criterios de aceptación:

- Un usuario puede registrarse, ser aprobado, iniciar sesión y vincular Discord.
- Un código usado por otra cuenta no puede reutilizarse.
- Los formularios no exponen hashes, service keys ni datos administrativos.
- Todos los cambios administrativos relevantes generan auditoría.

### Fase 3 — Calendario de tareas

**Objetivo:** transformar el tablero actual en una gestión temporal de tareas.

Modelo mínimo:

- `fecha_inicio`
- `fecha_vencimiento`
- `todo_el_dia`
- `responsable_id`
- `pilar`
- `estado`
- `prioridad`
- `descripcion`
- `id_discord_hilo`
- `created_at`
- `updated_at`

Tareas:

- [ ] Extender tabla, contratos y Server Actions.
- [ ] Validar estados y fechas en servidor.
- [ ] Implementar vistas mensual, semanal y lista.
- [ ] Añadir filtros por responsable, pilar, estado y fecha.
- [ ] Mostrar tareas vencidas, próximas y completadas.
- [ ] Crear y editar tareas desde el calendario.
- [ ] Conservar el Kanban como vista secundaria si aporta valor.
- [ ] Actualizar mediante Supabase Realtime.
- [ ] Adaptar la sincronización de Discord al contrato nuevo.
- [ ] Añadir pruebas de zonas horarias usando `America/Lima`.

Criterios de aceptación:

- Una tarea conserva fecha, responsable, pilar y estado en todas las vistas.
- Los permisos se aplican en servidor, no solo en la interfaz.
- Una actualización web se refleja una sola vez en Discord y viceversa.
- Las fechas no cambian de día por conversiones UTC/locales.

### Fase 4 — Catálogo de recursos LEAD

**Objetivo:** centralizar temporalmente los recursos utilizados por la organización.

Tipos iniciales:

- Repositorio de código.
- Dataset o fuente de datos.
- Dashboard.
- Documento.
- Herramienta externa.
- Servicio o API.

Campos:

- Nombre.
- Descripción.
- Tipo.
- URL.
- Proveedor.
- Responsable.
- Pilar.
- Estado: `PLANNED`, `ACTIVE` o `ARCHIVED`.
- Nivel de acceso: `PUBLIC`, `INTERNAL` o `RESTRICTED`.
- Fecha de última verificación.
- Notas sin secretos.

Tareas:

- [ ] Generalizar el concepto implementado en el commit web `7e3890a` para redes sociales.
- [ ] Crear tabla, índices, RLS y auditoría de `recursos`.
- [ ] Añadir pestaña `Recursos` para usuarios autenticados.
- [ ] Crear búsqueda y filtros por tipo, pilar y estado.
- [ ] Permitir CRUD únicamente a administradores autorizados.
- [ ] Añadir confirmación antes de archivar.
- [ ] Mostrar advertencia para recursos restringidos.
- [ ] Prohibir credenciales, tokens y secretos en el modelo y formularios.

Criterios de aceptación:

- Los miembros pueden encontrar y abrir recursos autorizados.
- Los administradores pueden crear, editar y archivar registros.
- Ninguna respuesta pública expone notas o enlaces clasificados como restringidos.

### Fase 5 — Recuperación del bot y banner de bienvenida

**Objetivo:** publicar un bot instalable y confiable.

#### Diagnóstico verificado

- La rama `main` es inejecutable por conflictos guardados como código.
- La implementación `1ae72a6` utiliza Satori con HTML crudo y proviene de un historial independiente.
- `c4e4e9c` cambia a `node-html-to-image`, pero depende de Chromium/Puppeteer y es frágil en Render.
- El canal está codificado directamente en `guildMemberAdd.js:15` (`1510689444716347482`).
- `templates/welcomeBanner.html` y el HTML embebido en el evento duplican la misma interfaz.
- La prueba existente genera un archivo manualmente, pero no tiene aserciones ni pertenece a `npm test`.
- **Ya resuelto en `c4e4e9c`, no volver a hacerlo:** `@resvg/resvg-js` y `satori` ya
  figuran en `package.json`; el fallback textual ya existe en el bloque `catch`; y el
  intent `GuildMembers` ya está declarado en `index.js:13`.

#### Implementación propuesta

- [ ] Recuperar los archivos válidos de `c4e4e9c` sin fusionar el código roto de `main`.
- [ ] Extraer `services/welcomeBanner.js`.
- [ ] Generar un SVG controlado y convertirlo a PNG con `@resvg/resvg-js` (ya instalado).
- [ ] Descargar e incrustar el avatar; usar avatar predeterminado si falla.
- [ ] **Desinstalar** `puppeteer` y `node-html-to-image` de `package.json`.
- [ ] Escapar nombres y contenido interpolado.
- [ ] Adaptar tipografía para nombres largos, Unicode y emojis.
- [ ] Mover el canal a `WELCOME_CHANNEL_ID`.
- [ ] Conservar el fallback textual existente y evitar mensajes duplicados.
- [ ] Verificar que el intent privilegiado `Server Members` esté activado en el portal
      de Discord (en el código ya está declarado).
- [ ] Verificar permisos `View Channel`, `Send Messages` y `Attach Files`.
- [ ] Probar el evento en un servidor de staging.

Criterios de aceptación:

- El evento produce un PNG válido para nombres cortos, largos y Unicode.
- Si falla el render o el avatar, se envía un único fallback textual.
- La ausencia de canal o permisos queda registrada con un error accionable.
- El bot inicia en Linux/Render sin instalar un navegador.

### Fase 6 — Integración, CI y documentación

**Objetivo:** prevenir regresiones y preparar operación real.

Tareas:

- [ ] Añadir CI con instalación, lint, typecheck, pruebas y build.
- [ ] Ejecutar controles solo en workspaces afectados cuando sea posible.
- [ ] Añadir pruebas unitarias para contratos, permisos y renderer.
- [ ] Añadir pruebas de integración web/Supabase/bot.
- [ ] Crear README raíz y guías de desarrollo.
- [ ] Documentar variables de Vercel, Render, Discord y Supabase.
- [ ] Documentar backup, migración, rollback y rotación de secretos.
- [ ] Crear entorno de staging independiente.
- [ ] Ejecutar pruebas de aceptación con datos no productivos.

Criterios de aceptación:

- Todos los checks se ejecutan automáticamente en PR.
- Un desarrollador nuevo puede levantar el proyecto siguiendo el README.
- Staging reproduce el flujo de registro, calendario, recursos y Discord.

### Fase 7 — Release V1

- [ ] Congelar cambios funcionales en `release/v1.0.0`.
- [ ] Respaldar la base productiva.
- [ ] Ejecutar migraciones con plan de rollback.
- [ ] Desplegar bot y realizar smoke test.
- [ ] Desplegar web y realizar smoke test.
- [ ] Validar eventos Realtime y sincronización con Discord.
- [ ] Fusionar a `main`.
- [ ] Crear tag anotado `v1.0.0` y GitHub Release.
- [ ] Archivar `LeadUpao-Web` y `LeadUpao-Bot` como repositorios de solo lectura.
- [ ] Actualizar sus README con un enlace al monorepo.

## 6. Plan de delegación

El frente S (Fase P) no depende de nada y arranca de inmediato. Los demás frentes
pueden ejecutarse en paralelo solo después de completar la Fase 0, y la Fase 1 no puede
cerrarse sin el baseline que produce el frente S. La base de datos y los contratos deben estabilizarse antes de integrar miembros, calendario y bot.

| Frente | Responsable sugerido | Alcance | Depende de | Entregable |
|---|---|---|---|---|
| S. Seguridad y baseline | Backend/Supabase | Fase P: RLS, rotación de secretos y dump del esquema | Ninguno | Hotfix + `0000_baseline.sql` |
| A. Monorepo y Git | Integración/DevOps | Fase 0, workspaces, ramas, limpieza e historial | Ninguno | PR `chore(repo)` |
| B. Esquema y seguridad | Backend/Supabase | Migraciones, RLS, seeds y tipos | Frentes S y A | PR `fix(database-v1)` |
| C. Miembros | Full-stack web | Registro, login, aprobación, CRUD y auditoría | Contratos de B | PR `feature/member-lifecycle` |
| D. Calendario | Frontend + backend | Modelo temporal, vistas, filtros y Realtime | Contratos de B | PR `feature/task-calendar` |
| E. Recursos | Full-stack web | Catálogo, permisos, búsqueda y administración | RLS y auditoría de B | PR `feature/resources-catalog` |
| F. Bot y banner | Integración Discord | Recuperación, renderer, verificación y sync | Contratos de B | PR `fix/bot-welcome-banner` |
| G. QA y release | QA/DevOps | CI, staging, regresión, despliegue y rollback | C, D, E y F | PR de release y `v1.0.0` |

### 6.1 Reglas para delegar tareas

- Cada responsable trabaja en archivos de su frente para reducir conflictos.
- Cambios en `packages/contracts` o `supabase` requieren revisión del responsable de base de datos.
- El frontend no define estados nuevos localmente.
- El bot no añade columnas directamente: primero se actualiza el contrato y la migración.
- Ningún frente modifica `main` directamente.
- Los PR deben mantenerse pequeños; dividir una fase en varios PR cuando mezcle modelo, UI e infraestructura.
- Las decisiones de seguridad, migración y permisos requieren al menos una segunda revisión.

### 6.2 Orden de integración

```text
Seguridad (Fase P)  ──┐   ← en paralelo, sin dependencias
Monorepo/Git        ──┘
    ↓
Base de datos + contratos
    ├── Miembros
    ├── Calendario
    ├── Recursos
    └── Bot/banner
          ↓
Integración completa
          ↓
QA + staging
          ↓
Release v1.0.0
```

## 7. Backlog sugerido para issues

### Épica: Seguridad (P0, bloquea todo lo demás)

- `SEC-01` Auditar el alcance de la exposición de `miembros`.
- `SEC-02` Etapa 1: retirar grants de `anon` y reducir los de `authenticated`.
- `SEC-03` Rotar códigos de verificación, contraseñas y claves de API.
- `SEC-04` Capturar `0000_baseline.sql` del esquema productivo.
- `SEC-05` Etapa 2: activar RLS en `miembros` con políticas por fila.

### Épica: Monorepo

- `MONO-01` Respaldar referencias y crear rama de integración.
- `MONO-02` Mover web y bot a `apps/`.
- `MONO-03` Configurar npm workspaces.
- `MONO-04` Limpiar dependencias versionadas y conflictos.
- `MONO-05` Configurar despliegues por directorio.

### Épica: Base de datos

- `DB-00` Reconciliar el baseline con las migraciones del repositorio.
- `DB-01` Diseñar esquema V1.
- `DB-02` Crear migración de transición.
- `DB-03` Corregir RLS y RBAC.
- `DB-04` Generar tipos y contratos.
- `DB-05` Probar migración y rollback.

### Épica: Miembros

- `MEM-01` Endurecer registro público.
- `MEM-02` Terminar aprobación y administración.
- `MEM-03` Asegurar login y códigos.
- `MEM-04` Integrar `/verificar`.
- `MEM-05` Añadir auditoría y pruebas.

### Épica: Calendario

- `CAL-01` Extender el modelo de tareas.
- `CAL-02` Implementar Server Actions seguras.
- `CAL-03` Crear vista mensual.
- `CAL-04` Crear vista semanal y lista.
- `CAL-05` Añadir filtros y responsables.
- `CAL-06` Integrar Realtime y Discord.
- `CAL-07` Probar zona horaria y vencimientos.

### Épica: Recursos

- `RES-01` Crear esquema y permisos.
- `RES-02` Crear listado y filtros.
- `RES-03` Crear administración.
- `RES-04` Proteger recursos restringidos.
- `RES-05` Añadir auditoría y pruebas.

### Épica: Bot

- `BOT-01` Recuperar rama limpia.
- `BOT-02` Eliminar dependencias y binarios versionados.
- `BOT-03` Implementar renderer SVG/Resvg y desinstalar Puppeteer.
- `BOT-04` Parametrizar canal y permisos.
- `BOT-05` Unificar contrato de tareas.
- `BOT-06` Probar bienvenida y sincronización en staging.

### Épica: Release

- `REL-01` Configurar CI.
- `REL-02` Crear documentación operativa.
- `REL-03` Desplegar staging.
- `REL-04` Ejecutar aceptación y regresión.
- `REL-05` Publicar `v1.0.0`.
- `REL-06` Archivar repositorios individuales.

## 8. Definición de terminado de la V1

La V1 estará terminada cuando:

- [ ] La política `anon` sobre `miembros` esté cerrada y los secretos rotados.
- [ ] Exista un solo repositorio oficial.
- [ ] `main` esté protegido y sea desplegable.
- [ ] `npm ci`, lint, typecheck, pruebas y build sean reproducibles.
- [ ] Las migraciones funcionen sin borrar información existente.
- [ ] Registro, aprobación, login y vinculación con Discord funcionen de extremo a extremo.
- [ ] El calendario gestione fechas, responsables, permisos y zonas horarias correctamente.
- [ ] El catálogo de recursos respete niveles de acceso y no almacene secretos.
- [ ] El banner de bienvenida funcione en el entorno real del bot y tenga fallback.
- [ ] Bot y web compartan estados y contratos.
- [ ] CI y staging estén operativos.
- [ ] Existan documentación, backup y rollback.
- [ ] Se publique el tag y release `v1.0.0`.

