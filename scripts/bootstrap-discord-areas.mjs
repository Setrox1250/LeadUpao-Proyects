#!/usr/bin/env node
/**
 * Crea en Discord la estructura de tareas por área descrita en
 * docs/discord-tareas.md:
 *
 *   📁 <Pilar>                  categoría con permisos del área
 *      └── 📋 backlog-tareas    foro, con las etiquetas de estado ya creadas
 *
 * Y escribe los IDs generados de vuelta en `pilares` (discord_role_id,
 * discord_category_id, discord_forum_id).
 *
 * PROPIEDADES
 *   - Idempotente: si un objeto ya existe y sigue vivo en Discord, lo reutiliza.
 *   - Solo crea. Nunca borra ni renombra nada (ver docs/discord-tareas.md).
 *   - Simulación por defecto: sin --apply no toca Discord ni Supabase.
 *
 * REQUISITOS
 *   - apps/bot/.env con DISCORD_TOKEN, GUILD_ID, SUPABASE_URL y SUPABASE_KEY.
 *   - Migración supabase/migrations/0005_pilares_canales_discord.sql aplicada.
 *   - El bot en el servidor con "Gestionar canales" y "Gestionar roles", y su
 *     rol por encima de los roles de pilar que va a crear.
 *
 * USO
 *   node scripts/bootstrap-discord-areas.mjs            # simulación
 *   node scripts/bootstrap-discord-areas.mjs --apply    # ejecuta
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
} from 'discord.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APLICAR = process.argv.includes('--apply');

/**
 * Vinculación inicial de áreas: la migración 0007 pasó los nombres al español
 * del organigrama, así que ya no coinciden con los roles que existen hoy en
 * Discord. Mapa de un solo uso: en cuanto se guarda `discord_role_id`, deja
 * de consultarse.
 *
 *   clave = pilares.nombre en Supabase   valor = nombre EXACTO hoy en Discord
 */
const VINCULACION_INICIAL = {
  'Área de Innovación Tecnológica': 'Technological Innovation',
};

/**
 * Adopción de canales que el equipo ya usaba.
 *
 * Algunas áreas tienen su espacio en Discord desde antes, con canales de
 * trabajo y sus propias convenciones de nombre. En esos casos el script los
 * ADOPTA por id en vez de crear una estructura paralela, y **no los renombra**:
 * el nombre canónico de la BD manda para los roles, pero un canal con historia
 * conserva el nombre que su equipo le puso.
 *
 * Los permisos sí se sincronizan, para que la Directiva tenga acceso.
 */
const ADOPCION = {
  'Área de Innovación Tecnológica': {
    categoria: '1510878279995883601',  // 🚀 INNOVACIÓN TECNOLÓGICA
    foro:      '1510879369931915416',  // ├─🚀-backlog-tareas
  },
};

const FORO = 'backlog-tareas';
// Deben coincidir con ESTADO_TAG de apps/bot/services/supabaseListener.js.
// Cada tarea lleva siempre exactamente una: es lo que permite sincronizar con
// foros configurados con «etiqueta obligatoria».
const ETIQUETAS_ESTADO = ['Backlog', 'En Progreso', 'Completado'];

// ── Entorno ────────────────────────────────────────────────────────────────
function leerEnv(rel) {
  const out = {};
  let texto;
  try { texto = readFileSync(path.join(RAIZ, rel), 'utf8'); }
  catch { throw new Error(`No se encontró ${rel}. Copia apps/bot/.env.example y rellénalo.`); }
  for (const linea of texto.split('\n')) {
    const t = linea.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = leerEnv('apps/bot/.env');
const faltan = ['DISCORD_TOKEN', 'GUILD_ID', 'SUPABASE_URL', 'SUPABASE_KEY']
  .filter((k) => !env[k]);
if (faltan.length) {
  console.error(`Faltan variables en apps/bot/.env: ${faltan.join(', ')}`);
  process.exit(1);
}

const log = (...a) => console.log(...a);
const accion = (txt) => log(`  ${APLICAR ? '✓' : '·'} ${txt}${APLICAR ? '' : '  (simulado)'}`);

// ── Supabase ───────────────────────────────────────────────────────────────
const db = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

const { data: pilares, error: errPilares } = await db
  .from('pilares')
  .select('nombre, orden, discord_role_id, discord_category_id, discord_forum_id')
  .order('orden');

if (errPilares) {
  console.error('No se pudo leer `pilares`:', errPilares.message);
  if (errPilares.message.includes('discord_category_id')) {
    console.error('→ Falta aplicar supabase/migrations/0005_pilares_canales_discord.sql');
  }
  process.exit(1);
}

// Roles de administración que deben ver TODAS las áreas.
const { data: rolesAdmin } = await db
  .from('roles').select('nombre, discord_role_id').eq('nivel_permiso', 'admin');
const idsAdmin = (rolesAdmin ?? []).map((r) => r.discord_role_id).filter(Boolean);

log(`\n${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (usa --apply para ejecutar)'}`);
log(`${pilares.length} pilares · ${idsAdmin.length} rol(es) admin con acceso transversal\n`);
if (!idsAdmin.length) {
  log('  Aviso: ningún rol con nivel_permiso=admin tiene discord_role_id.');
  log('  La Directiva no quedará con acceso transversal; se puede reejecutar luego.\n');
}

// ── Discord ────────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(env.DISCORD_TOKEN);
const guild = await client.guilds.fetch(env.GUILD_ID);
await guild.roles.fetch();
await guild.channels.fetch();
const yo = await guild.members.fetchMe();
log(`Servidor: ${guild.name}\n`);

/** Devuelve el objeto si el id sigue existiendo en el servidor, si no null. */
const vivo = (coleccion, id) => (id ? coleccion.cache.get(id) ?? null : null);

/**
 * Garantiza que un foro tenga las etiquetas de estado, conservando las que ya
 * tuviera: setAvailableTags reemplaza la lista entera.
 */
async function asegurarEtiquetas(foro, sangria = '  ') {
  const faltan = ETIQUETAS_ESTADO.filter(
    (n) => !foro.availableTags.some((t) => t.name.toLowerCase() === n.toLowerCase()));
  if (!faltan.length) return;
  log(`${sangria}${APLICAR ? '✓' : '·'} añadir etiquetas de estado: ${faltan.join(', ')}${APLICAR ? '' : '  (simulado)'}`);
  if (!APLICAR) return;
  await foro.setAvailableTags([
    ...foro.availableTags.map((t) => ({ id: t.id, name: t.name, moderated: t.moderated, emoji: t.emoji })),
    ...faltan.map((name) => ({ name, moderated: false })),
  ]);
}

let creados = 0;
for (const pilar of pilares) {
  log(`▸ ${pilar.nombre}`);
  const cambios = {};

  // 1. Rol del área
  const nombreEnDiscord = VINCULACION_INICIAL[pilar.nombre] ?? pilar.nombre;
  let rol = vivo(guild.roles, pilar.discord_role_id)
        ?? guild.roles.cache.find((r) => r.name === nombreEnDiscord);
  if (rol) {
    log(`  · rol ya existe (${rol.id})`);
    if (rol.name !== pilar.nombre) {
      if (rol.position >= yo.roles.highest.position) {
        log(`  ✗ el rol está por encima del bot: renómbralo a mano a «${pilar.nombre}»`);
      } else {
        accion(`renombrar rol «${rol.name}» → «${pilar.nombre}»`);
        if (APLICAR) await rol.setName(pilar.nombre, 'Nombre canónico desde Supabase');
      }
    }
  } else {
    accion(`crear rol «${pilar.nombre}»`);
    if (APLICAR) {
      rol = await guild.roles.create({ name: pilar.nombre, reason: 'Bootstrap de áreas LEAD' });
      creados++;
    }
  }
  if (rol && rol.id !== pilar.discord_role_id) cambios.discord_role_id = rol.id;

  // Permisos: nadie ve el área salvo su rol y la Directiva.
  const permisos = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...(rol ? [{ id: rol.id, allow: [PermissionFlagsBits.ViewChannel] }] : []),
    ...idsAdmin.filter((id) => vivo(guild.roles, id))
               .map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel] })),
  ];

  // 2. Categoría del área
  const adoptada = ADOPCION[pilar.nombre] ?? null;
  let categoria = (adoptada && guild.channels.cache.get(adoptada.categoria))
    ?? vivo(guild.channels, pilar.discord_category_id)
    ?? guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === pilar.nombre);
  if (categoria) {
    log(`  · categoría ${adoptada ? `adoptada «${categoria.name}»` : 'ya existe'} (${categoria.id})`);
    if (!adoptada && categoria.name !== pilar.nombre) {
      accion(`renombrar categoría «${categoria.name}» → «${pilar.nombre}»`);
      if (APLICAR) await categoria.setName(pilar.nombre, 'Nombre canónico desde Supabase');
    }
    // Re-aplicar permisos: reejecutar el script debe dar acceso a los roles
    // que se hayan vinculado desde la última vez (p. ej. la Directiva).
    accion('sincronizar permisos de la categoría');
    if (APLICAR) await categoria.permissionOverwrites.set(permisos, 'Permisos del área');
  } else {
    accion(`crear categoría «${pilar.nombre}»`);
    if (APLICAR) {
      categoria = await guild.channels.create({
        name: pilar.nombre,
        type: ChannelType.GuildCategory,
        permissionOverwrites: permisos,
        reason: 'Bootstrap de áreas LEAD',
      });
      creados++;
    }
  }
  if (categoria && categoria.id !== pilar.discord_category_id) {
    cambios.discord_category_id = categoria.id;
  }

  // 3. Foro de backlog dentro de la categoría
  let foro = (adoptada && guild.channels.cache.get(adoptada.foro))
    ?? vivo(guild.channels, pilar.discord_forum_id)
    ?? (categoria && guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildForum &&
             c.name === FORO && c.parentId === categoria.id));
  if (foro) {
    log(`  · foro ${adoptada ? `adoptado «${foro.name}»` : 'ya existe'} (${foro.id})`);
    if (!adoptada && foro.name !== FORO) {
      accion(`renombrar foro «${foro.name}» → «${FORO}»`);
      if (APLICAR) await foro.setName(FORO, 'Nombre canónico');
    }
    await asegurarEtiquetas(foro);
  } else {
    accion(`crear foro «${FORO}» dentro de la categoría`);
    if (APLICAR && categoria) {
      foro = await guild.channels.create({
        name: FORO,
        type: ChannelType.GuildForum,
        parent: categoria.id,
        topic: `Backlog de tareas de ${pilar.nombre}. Sincronizado con el panel web de LEAD UPAO.`,
        availableTags: ETIQUETAS_ESTADO.map((name) => ({ name, moderated: false })),
        reason: 'Bootstrap de áreas LEAD',
      });
      creados++;
    }
  }
  if (foro && foro.id !== pilar.discord_forum_id) cambios.discord_forum_id = foro.id;

  // 4. Guardar los IDs en Supabase
  if (Object.keys(cambios).length) {
    accion(`guardar en Supabase: ${Object.keys(cambios).join(', ')}`);
    if (APLICAR) {
      const { error } = await db.from('pilares').update(cambios).eq('nombre', pilar.nombre);
      if (error) log(`  ✗ error al guardar: ${error.message}`);
    }
  }
  log('');
}

// ── Foro general ───────────────────────────────────────────────────────────
// Vive fuera de las categorías por área y se crea a mano, pero necesita las
// mismas etiquetas de estado que los demás: el listener las busca por nombre.
const idGeneral = env.GENERAL_FORUM_CHANNEL_ID;
log('▸ Foro general (tareas sin área)');
if (!idGeneral) {
  log('  · GENERAL_FORUM_CHANNEL_ID no está configurado en apps/bot/.env');
} else {
  const general = guild.channels.cache.get(idGeneral);
  if (!general) {
    log(`  ✗ el canal ${idGeneral} no existe en este servidor`);
  } else if (general.type !== ChannelType.GuildForum) {
    log(`  ✗ «${general.name}» no es un canal de foro`);
  } else {
    log(`  · «${general.name}»`);
    await asegurarEtiquetas(general, '      ');
  }
}
log('');

// ── Canales que el script creó y ya nadie referencia ───────────────────────
// Pasa cuando un área adopta canales preexistentes: los que se crearon antes
// quedan sueltos. No se borran (regla de docs/discord-tareas.md); se listan
// para que alguien decida a mano.
const { data: pilActual } = await db.from('pilares')
  .select('discord_category_id, discord_forum_id');
const enUso = new Set(
  (pilActual ?? []).flatMap((p) => [p.discord_category_id, p.discord_forum_id]).filter(Boolean));

const sueltos = [...guild.channels.cache.values()].filter(
  (c) => !enUso.has(c.id)
      && ((c.type === ChannelType.GuildCategory && c.name.startsWith('Área'))
       || (c.type === ChannelType.GuildForum && c.name === FORO)));

if (sueltos.length) {
  log('Creados por el script pero ya sin uso (bórralos a mano si quieres):');
  for (const c of sueltos) {
    const vacia = c.type === ChannelType.GuildCategory
      && ![...guild.channels.cache.values()].some((x) => x.parentId === c.id);
    log(`  · ${c.name}${vacia ? '  (categoría vacía)' : ''}`);
  }
  log('');
}

log(APLICAR
  ? `Listo. ${creados} objeto(s) creados en Discord.`
  : 'Nada se ha modificado. Repite con --apply para ejecutar.');

await client.destroy();
