# Estandarización de roles y permisos en Discord

Decidido el 2026-09-08. Complementa `docs/discord-tareas.md`.

## Fuente de verdad

La tabla `roles` manda: su `nombre` es el nombre canónico y el bot renombra
Discord para que coincida. Los emojis decorativos que había en el servidor
(`Vice-Presidente👑`, `Treasurer 💰`, `Chief of Staff 👥`) se pierden a cambio
de que `/verificar` pueda resolver los roles de forma fiable.

Los permisos salen de `roles.nivel_permiso` mediante presets cerrados.

| Nivel | Cargos | Permisos |
|---|---|---|
| `admin` | President, Vice-President, Admin TI | 23: gestión de servidor, canales y roles, expulsar, banear, moderar, auditoría |
| `staff` | Chief of Staff, Treasure / Fundraising, Leader | 17: moderación de mensajes e hilos, silenciar, mover, aislar |
| `member` | Member | 11: participación básica y voz |

Los roles de **pilar** van sin permisos de servidor a propósito: dan acceso a
su área mediante overwrites en la categoría, no mediante permisos globales.

## Por qué los presets están en código

`apps/bot/config/discordPermisos.cjs`, no en la base de datos.

El panel web escribe en `roles`. Si el nivel de permiso se tradujera a un
bitfield editable desde ahí, comprometer la web sería comprometer el servidor:
bastaría marcar Administrator en un rol propio. Con los presets en el
repositorio, ampliar permisos exige un commit revisable y `nivel_permiso` solo
puede elegir entre tres conjuntos cerrados.

## Sin ADMINISTRATOR

Ningún preset lo incluye. Hoy lo tienen `President`, `Admin TI` y `Bot`; los
dos primeros lo pierden al aplicar el preset `admin`.

Motivos: omite todos los permisos por canal —incluida la privacidad por área—,
una cuenta comprometida puede borrar el servidor, y el registro de auditoría no
distingue qué podía hacer cada rol. El conjunto explícito permite lo mismo en
la práctica. El propietario del servidor conserva control total al margen de
los roles, así que no hay riesgo de quedarse fuera.

`Bot` no está en la tabla `roles`, así que el script no lo toca.

## Orden de ejecución

**Primero roles, después áreas.** El script de áreas concede acceso a las
categorías a los roles con `nivel_permiso = 'admin'` leyendo su
`discord_role_id`. Hoy solo 1 de 7 cargos está vinculado; si se ejecutan al
revés, la Directiva se queda sin acceso transversal.

```bash
node scripts/bootstrap-discord-roles.mjs            # simulación
node scripts/bootstrap-discord-roles.mjs --apply
node scripts/bootstrap-discord-areas.mjs --apply
```

Ambos son idempotentes y no destructivos: nunca borran un rol ni un canal, y
dejan intacto lo que no está en las tablas. Se pueden reejecutar.

La jerarquía va detrás de `--jerarquia` porque reordenar posiciones desplaza a
otros roles del servidor; sin ese flag solo se tocan nombres y permisos.

## Pendiente de decidir

- **`Admin TI`** tiene `orden: 1` colisionando con President y
  `requiere_pilar: true` pese a ser `admin`. Se añadió fuera de la migración.
  El script lo trata como admin y no corrige la configuración.
- **`Marketing 🎨`** existe en Discord pero no en `roles`. Se deja intacto:
  hay que decidir si se da de alta como cargo o se retira.
