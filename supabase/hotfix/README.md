# Hotfix P0 — `miembros` sin RLS

**Fecha del hallazgo:** 2026-09-08
**Estado:** Etapa 1 lista para aplicar. Etapa 2 pendiente (requiere cambio de código).

## Qué pasó

`public.miembros` tenía Row Level Security **desactivado** mientras los roles
`anon` y `authenticated` conservaban los privilegios amplios que Supabase
concede por defecto en el esquema `public`:

```
DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
```

Sin RLS, esos grants se aplican sin ningún filtro. La clave anónima viaja en
el bundle público de Next.js, así que **cualquier visitante del sitio
desplegado podía leer, modificar, borrar o truncar la tabla de miembros**,
incluidos `contrasena_hash` y `codigo_verificacion`.

Fue la única tabla afectada: `roles`, `pilares`, `tareas` y `redes_sociales`
tienen RLS activo, y sus políticas son coherentes con lo que la app necesita.

## Cómo se descubrió

La revisión del repositorio encontró en `supabase/legacy/migration.sql` una
política que exponía `miembros` a `anon`. Al verificarla contra producción
resultó que **ninguna** política existía — y que el motivo era peor: RLS nunca
llegó a activarse en esa tabla.

## Aplicación

### Etapa 1 — ahora, sin cambio de código

```
supabase/hotfix/2026-09-08_miembros_grants.sql
```

Retira todos los privilegios de `anon` y deja a `authenticated` con `SELECT`
y `UPDATE (auth_user_id)`, que es exactamente lo que el código ejerce con la
clave anónima. Se auditó cada consulta a `miembros`: todas las escrituras y
todo el flujo de login y registro usan `service_role`, que ignora grants y RLS.
**No rompe nada.**

Antes de aplicarlo, ejecutar `2026-09-08_auditoria_exposicion.sql` para tener
una foto del estado y detectar manipulaciones.

### Etapa 2 — por PR, con cambio de código

Activar RLS en `miembros` con políticas por fila. Requiere resolver dos cosas
que hoy dependen de leer filas ajenas con la clave anónima:

1. **Vínculo heredado por `discord_id`** (`apps/web/src/lib/miembro.ts:22`).
   Busca una fila cuyo `auth_user_id` todavía es `null`, así que ninguna
   política basada en `auth.uid()` la alcanza. Debe pasar a `createAdminClient()`.

2. **Listado de administradores** (`apps/web/src/app/admin/(dashboard)/page.tsx:73,130`).
   Una política que consulte `miembros` para saber si el solicitante es admin
   se llama a sí misma. Necesita una función `security definer`, o mover esas
   dos lecturas a `createAdminClient()` — el código ya comprueba `isAdmin` en
   el servidor antes de usarlas.

La opción de mover ambas a `service_role` es la más simple y es coherente con
el resto de la app, que ya centraliza el control de acceso en Server Actions.
Con eso, la política de `miembros` puede quedar en «solo tu propia fila».

## Rotación de credenciales

La exposición permitía leer credenciales, así que hay que tratarlas como
comprometidas:

- **`codigo_verificacion`** — es un secreto en texto plano que permite
  vincular una cuenta de Discord. **Regenerar todos.**
- **`contrasena_hash`** — scrypt con salt aleatorio de 16 bytes y parámetros
  por defecto de Node. No es descifrable en bloque, pero la política de
  contraseñas actual admite 8 caracteres con una letra y un número, lo que
  deja las débiles al alcance de un ataque por diccionario offline. **Forzar
  restablecimiento.**
- **Rotar la anon key y la service_role key** en Settings → API, y actualizar
  las variables en Vercel y Render.

## Hallazgo colateral: la auditoría nunca funcionó

`logs_auditoria` **no existe en producción**. La migración `0001` nunca llegó
a aplicarse porque define `actor_id uuid references public.miembros(id)` y
`miembros.id` es un `bigint` — el FK es imposible y aborta la migración.

Como `registrarAuditoria()` traga el error a `console.error` para no revertir
la acción principal, **todos los registros de auditoría se han descartado en
silencio desde el principio**, y `obtenerLogsAuditoria()` devuelve error a la
tabla del panel.

Esto se corrige en la Fase 1, con el tipo de clave ya confirmado.
