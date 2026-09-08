# Migración al monorepo — Fase 0

Registro de la consolidación de `LeadUpao-Web`, `LeadUpao-Bot` y `LeadUpao-Proyects`
en un único repositorio. Este documento es la referencia para auditar qué se conservó
y qué se descartó.

## 1. Referencias originales

Todas quedaron respaldadas con tags anotados **en su repositorio de origen**. Ninguna
rama fue borrada ni reescrita.

| Origen | Referencia | Hash completo | Tag de respaldo |
|---|---|---|---|
| `LeadUpao-Proyects` | `main` | `5554211526af90ec7ca00aeba21fa8949758b84a` | `archive/projects-main-5554211` |
| `LeadUpao-Proyects` | `setroxBranch` | `350c6d9e9ce3e6ae84a1ce732b4b5897973c5abe` | `archive/projects-integrated-350c6d9` |
| `LeadUpao-Bot` | `main` | `6a2597b6e1e2232112bc3fe8a17f3adec74b047e` | `archive/bot-broken-main-6a2597b` |
| `LeadUpao-Bot` | `setroxBranch` | `c4e4e9cacbec145f0c23b1a4df973d3ff1773d70` | `archive/bot-clean-c4e4e9c` |
| `LeadUpao-Web` | `main` | `10ceeace529d900569666481e4e33f798e243136` | `archive/web-main-10ceeac` |
| `LeadUpao-Web` | `setroxBranch` | `7e3890a7f41d985e7c7b36fced780b39945754fb` | `archive/web-feature-7e3890a` |

Commit raíz huérfano incorporado por el merge roto, conservado solo como referencia:
`1ae72a6d799387bb97ca996edb56e2528aee5797`.

> Los tags existen **en local**. Deben empujarse antes de archivar los repositorios:
> `git push origin --tags` en cada uno de los tres.

## 2. Base elegida y por qué

El monorepo parte de `350c6d9` (`LeadUpao-Proyects/setroxBranch`), no de `main`.

La razón es verificable por hash: los subárboles de `350c6d9` son **idénticos** a las
ramas limpias de los repositorios individuales.

| Subárbol | Hash del tree | Coincide con |
|---|---|---|
| `350c6d9:backend-bot` | `3330960322a2b9dc8d0a658b636310d87a013f2f` | `c4e4e9c^{tree}` |
| `350c6d9:web-lead` | `55f7a8afac962c50161de3d3d0d2c41293cb53da` | `7e3890a^{tree}` |

Partir de aquí no pierde nada del trabajo limpio y evita por completo el merge roto
`6a2597b`, que unió dos historias sin ancestro común
(`git merge-base 1ae72a6 c4e4e9c` no devuelve nada) y dejó marcadores de conflicto en
6 archivos ejecutables.

## 3. Qué pasó con cada archivo

De los 83 archivos de `350c6d9`, **76 se conservan byte a byte idénticos**.
El resto se detalla a continuación; no hubo pérdidas accidentales.

### Renombrados sin tocar el contenido

| Origen | Destino |
|---|---|
| `web-lead/**` | `apps/web/**` |
| `backend-bot/**` | `apps/bot/**` |
| `web-lead/supabase/migrations/*.sql` | `supabase/migrations/*.sql` |
| `web-lead/migration.sql`, `_v2`, `_v3` | `supabase/legacy/` |

`supabase/` pasa a ser la única fuente de verdad del esquema (sección 3 del plan).
Los tres `migration*.sql` sueltos se movieron a `supabase/legacy/` porque **no son
migraciones aplicables**: `migration.sql` empieza con `DROP TABLE ... CASCADE` y la
cadena numerada no corre desde cero. Se conservan como insumo para reconstruir el
baseline en la Fase P.

### Modificados a propósito (3)

| Archivo | Cambio |
|---|---|
| `.gitignore` | Consolidación de los tres `.gitignore` en uno, con `!**/.env.example` |
| `apps/web/package.json` | `name` a `@leadupao/web`; añadido script `typecheck` |
| `apps/bot/package.json` | `name` a `@leadupao/bot`; añadido `dev`; retirado `test` |

El `test` del bot era `echo "Error: no test specified" && exit 1`, que rompería
`npm test` en la raíz. Se retira hasta que la Fase 6 añada pruebas reales; `--if-present`
lo omite sin fallar.

### Eliminados a propósito (4)

| Archivo | Motivo |
|---|---|
| `web-lead/package-lock.json` | Sustituido por el lockfile único de la raíz |
| `backend-bot/package-lock.json` | Ídem |
| `web-lead/.gitignore` | Consolidado en la raíz |
| `backend-bot/.gitignore` | Consolidado en la raíz |

### Añadidos (7)

`package.json`, `package-lock.json`, `.env.example`, `apps/web/.env.example`,
`apps/bot/.env.example`, `apps/web/.eslintrc.json`, `scripts/check-repo.mjs`.

`apps/web/.eslintrc.json` no existía: `next lint` era interactivo y por tanto
`npm run lint` nunca fue reproducible, pese a que `eslint-config-next` ya figuraba
en devDependencies.

## 4. Cómo reproducir la verificación

```bash
# 1. Los subárboles originales siguen siendo alcanzables
git -C ../LeadUpao-Bot rev-parse c4e4e9c^{tree}
git -C ../LeadUpao-Web rev-parse 7e3890a^{tree}

# 2. Diferencia archivo por archivo contra la base
git diff --stat 350c6d9 HEAD

# 3. Controles de integridad del repositorio
npm run check
```

## 5. Decisiones registradas

- `packages/contracts` y `packages/database` **todavía no existen**. Git no versiona
  directorios vacíos y crear paquetes stub sin contenido solo añadiría ruido. El
  glob `packages/*` se añade a `workspaces` en la Fase 1, cuando tengan contenido real.
- No hay `.github/workflows/` todavía: la CI es entregable de la Fase 6.
  `scripts/check-repo.mjs` ya está listo para que ese workflow lo invoque.
- No se ha renombrado el repositorio a `LeadUpao`. Hacerlo rompe los remotes de todo
  el equipo; conviene dejarlo para el final de la Fase 7.

## 6. Deuda detectada durante la Fase 0

- `npm audit` reporta 11 vulnerabilidades (10 altas, 1 crítica). La crítica es
  `handlebars`, que entra vía `node-html-to-image`. **Retirar `puppeteer` y
  `node-html-to-image` en la Fase 5 elimina 6 de las 11**, incluida la única crítica:
  `handlebars`, `node-html-to-image`, `puppeteer`, `puppeteer-core`,
  `@puppeteer/browsers` y `extract-zip`. Es un argumento para adelantar la Fase 5.
- npm 12 bloquea los scripts de postinstalación por defecto, incluido el de
  `puppeteer` que descarga Chromium. Con la configuración actual el renderer del
  banner **fallaría en tiempo de ejecución** en cualquier instalación limpia. Otra
  razón para la Fase 5.
- El árbol arrastra dos versiones de puppeteer: `25.10.0` (directa) y `23.2.2`
  (transitiva vía `node-html-to-image`).
- `next@14.2.35` tiene avisos de severidad alta pendientes de actualización.
