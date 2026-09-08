# LEAD UPAO

Monorepo de la plataforma interna de LEAD UPAO: aplicación web y bot de Discord
sobre una única base de datos Supabase.

## Estructura

```text
apps/web/      Next.js 14 (App Router) — panel de administración y registro
apps/bot/      Bot de Discord (discord.js 14) + servidor keep-alive
supabase/
  migrations/  Migraciones versionadas (fuente de verdad del esquema)
  legacy/      Scripts SQL manuales previos — NO ejecutar, ver docs/
docs/          Arquitectura, migración y operación
scripts/       Controles repetibles de repositorio
```

## Requisitos

- Node.js >= 20 (probado con 26.8.1)
- npm >= 10 (probado con 12.0.2)
- Una cuenta de Supabase y una aplicación de Discord

## Puesta en marcha

```bash
npm ci

cp apps/web/.env.example apps/web/.env.local
cp apps/bot/.env.example apps/bot/.env
# Rellenar ambos archivos. Ver la nota sobre secretos compartidos más abajo.

npm run dev:web    # http://localhost:3000
npm run dev:bot
```

## Comandos de la raíz

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila todos los workspaces |
| `npm run lint` | ESLint en los workspaces que lo definen |
| `npm run typecheck` | `tsc --noEmit` en la web |
| `npm test` | Pruebas de los workspaces que las definan (aún ninguna) |
| `npm run check` | `check-repo` + lint + typecheck + test |

`npm run check` es el control que debe pasar antes de cualquier PR. Rechaza
marcadores de conflicto de Git, `node_modules` versionado, archivos de entorno
indexados y lockfiles duplicados.

Para actuar sobre un solo workspace: `npm run <script> --workspace @leadupao/web`.

## Secretos compartidos

El mismo valor se llama distinto en cada app. Si no coinciden, la sincronización
con Discord falla en silencio:

| Web (Vercel) | Bot (Render) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_KEY` |
| `DISCORD_SYNC_TOKEN` | `SYNC_SECRET_TOKEN` |

La unificación de estos nombres está planificada en la Fase 1.

## Despliegue

- **Vercel** → directorio raíz `apps/web`
- **Render** → directorio raíz `apps/bot`, comando `npm start`
- **Supabase** → `supabase/migrations`

Ambos despliegues deben quedar asociados al mismo commit del monorepo.

## Estado

V1 en construcción. Ver `PLAN_IMPLEMENTACION_V1.md` para el plan por fases y
`docs/repository-migration.md` para el registro de la consolidación.

> **Antes de tocar nada en producción**, ejecutar la Fase P del plan: hay una
> política RLS que expone datos sensibles de `miembros` a usuarios anónimos.
