#!/usr/bin/env node
/**
 * Estandariza los roles de cargo en Discord a partir de la tabla `roles`:
 * los vincula, los renombra para que coincidan con la BD y les aplica el
 * preset de permisos de su `nivel_permiso` (apps/bot/config/discordPermisos.cjs).
 *
 * La tabla `roles` es la fuente de verdad del nombre (decidido el 2026-09-08).
 *
 * PROPIEDADES
 *   - Idempotente y no destructivo: nunca borra un rol.
 *   - Los roles de Discord que no estén en la tabla se dejan intactos.
 *   - Simulación por defecto: sin --apply no toca Discord ni Supabase.
 *   - La jerarquía solo se reordena con --jerarquia (ver abajo).
 *
 * USO
 *   node scripts/bootstrap-discord-roles.mjs              # simulación
 *   node scripts/bootstrap-discord-roles.mjs --apply
 *   node scripts/bootstrap-discord-roles.mjs --apply --jerarquia
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, PermissionsBitField, PermissionFlagsBits } from 'discord.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { PRESETS } = require(path.join(RAIZ, 'apps/bot/config/discordPermisos.cjs'));

const APLICAR   = process.argv.includes('--apply');
const JERARQUIA = process.argv.includes('--jerarquia');

/**
 * Vinculación inicial: los nombres divergieron entre Discord y la BD, y ninguna
 * heurística los empareja con seguridad ("Treasurer 💰" vs "Treasure /
 * Fundraising"). Este mapa es explícito y de un solo uso: en cuanto el script
 * guarda `discord_role_id`, deja de consultarse.
 *
 *   clave  = roles.nombre en Supabase
 *   valor  = nombre EXACTO del rol hoy en Discord
 */
const VINCULACION_INICIAL = {
  'President':              'President',
  'Vice-President':         'Vice-Presidente👑',
  'Chief of Staff':         'Chief of Staff 👥',
  'Treasure / Fundraising': 'Treasurer 💰',
  'Member':                 'Member',
  'Marketing':              'Marketing 🎨',
  // 'Leader' no existe todavía en Discord: el script lo creará.
};

// ── Entorno ────────────────────────────────────────────────────────────────
function leerEnv(rel) {
  const out = {};
  for (const linea of readFileSync(path.join(RAIZ, rel), 'utf8').split('\n')) {
    const t = linea.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = leerEnv('apps/bot/.env');
const faltan = ['DISCORD_TOKEN', 'GUILD_ID', 'SUPABASE_URL', 'SUPABASE_KEY'].filter((k) => !env[k]);
if (faltan.length) { console.error(`Faltan en apps/bot/.env: ${faltan.join(', ')}`); process.exit(1); }

const log = (...a) => console.log(...a);
const accion = (t) => log(`  ${APLICAR ? '✓' : '·'} ${t}${APLICAR ? '' : '  (simulado)'}`);

// ── Datos ──────────────────────────────────────────────────────────────────
const db = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
const { data: cargos, error } = await db.from('roles')
  .select('nombre, nivel_permiso, orden, discord_role_id').order('orden');
if (error) { console.error('No se pudo leer `roles`:', error.message); process.exit(1); }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(env.DISCORD_TOKEN);
const guild = await client.guilds.fetch(env.GUILD_ID);
await guild.roles.fetch();
const yo = await guild.members.fetchMe();
const techoBot = yo.roles.highest.position;

log(`\n${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (usa --apply para ejecutar)'}`);
log(`Servidor: ${guild.name} · ${cargos.length} cargos · rol del bot en posición ${techoBot}\n`);

const bits = (nombres) => new PermissionsBitField(nombres.map((n) => PermissionFlagsBits[n]));
const resueltos = [];

for (const cargo of cargos) {
  log(`▸ ${cargo.nombre}  [${cargo.nivel_permiso}]`);

  // 1. Resolver el rol: por id guardado, por el mapa inicial, o por nombre exacto.
  let rol = (cargo.discord_role_id && guild.roles.cache.get(cargo.discord_role_id)) || null;
  if (!rol) {
    const nombreDiscord = VINCULACION_INICIAL[cargo.nombre] ?? cargo.nombre;
    rol = guild.roles.cache.find((r) => r.name === nombreDiscord) ?? null;
    if (rol) log(`  · vinculando con el rol existente «${rol.name}» (${rol.id})`);
  }

  if (!rol) {
    accion(`crear rol «${cargo.nombre}»`);
    if (APLICAR) {
      rol = await guild.roles.create({
        name: cargo.nombre,
        permissions: bits(PRESETS[cargo.nivel_permiso] ?? []),
        reason: 'Estandarización de cargos LEAD',
      });
    }
  } else {
    // El rol del bot no puede modificar roles iguales o superiores al suyo.
    if (rol.position >= techoBot) {
      log(`  ✗ posición ${rol.position} ≥ ${techoBot}: el bot no puede modificarlo. Súbelo en Discord.`);
      resueltos.push({ cargo, rol, bloqueado: true });
      log('');
      continue;
    }

    // 2. Nombre: la BD manda.
    if (rol.name !== cargo.nombre) {
      accion(`renombrar «${rol.name}» → «${cargo.nombre}»`);
      if (APLICAR) await rol.setName(cargo.nombre, 'Nombre canónico desde Supabase');
    }

    // 3. Permisos: preset del nivel.
    const deseados = bits(PRESETS[cargo.nivel_permiso] ?? []);
    if (rol.permissions.bitfield !== deseados.bitfield) {
      const tieneAdmin = rol.permissions.has(PermissionFlagsBits.Administrator);
      accion(`aplicar preset «${cargo.nivel_permiso}» (${PRESETS[cargo.nivel_permiso].length} permisos)`
             + (tieneAdmin ? '  ⚠ RETIRA ADMINISTRATOR' : ''));
      if (APLICAR) await rol.setPermissions(deseados, `Preset ${cargo.nivel_permiso}`);
    } else {
      log('  · permisos ya correctos');
    }
  }

  if (rol && rol.id !== cargo.discord_role_id) {
    accion(`guardar discord_role_id en Supabase`);
    if (APLICAR) {
      const { error: e } = await db.from('roles')
        .update({ discord_role_id: rol.id }).eq('nombre', cargo.nombre);
      if (e) log(`  ✗ error al guardar: ${e.message}`);
    }
  }
  resueltos.push({ cargo, rol });
  log('');
}

// ── Jerarquía (opt-in) ─────────────────────────────────────────────────────
// Reordenar posiciones desplaza a los demás roles del servidor, así que va
// detrás de un flag propio y solo ajusta el orden RELATIVO entre cargos.
if (JERARQUIA) {
  const ordenables = resueltos
    .filter((r) => r.rol && !r.bloqueado && r.rol.position < techoBot)
    .sort((a, b) => a.cargo.orden - b.cargo.orden);           // orden 1 = más alto
  const posiciones = ordenables.map((r) => r.rol.position).sort((a, b) => b - a);

  log('Jerarquía (orden relativo entre cargos):');
  const cambios = [];
  ordenables.forEach((r, i) => {
    if (r.rol.position !== posiciones[i]) {
      log(`  ${APLICAR ? '✓' : '·'} ${r.cargo.nombre}: posición ${r.rol.position} → ${posiciones[i]}`);
      cambios.push({ role: r.rol.id, position: posiciones[i] });
    }
  });
  if (!cambios.length) log('  · ya está en el orden correcto');
  else if (APLICAR) {
    try { await guild.roles.setPositions(cambios); }
    catch (e) { log(`  ✗ Discord rechazó el reordenamiento: ${e.message}`); }
  }
  log('');
} else {
  log('Jerarquía sin tocar. Añade --jerarquia para ordenar los cargos por `orden`.\n');
}

// ── Roles de Discord ajenos a la tabla ─────────────────────────────────────
const gestionados = new Set(resueltos.map((r) => r.rol?.id).filter(Boolean));
const ajenos = [...guild.roles.cache.values()].filter(
  (r) => r.id !== guild.roles.everyone.id && !r.managed && !gestionados.has(r.id));
if (ajenos.length) {
  log('Roles en Discord que no están en la tabla `roles` (no se tocan):');
  for (const r of ajenos) log(`  · ${r.name}`);
  log('');
}

log(APLICAR ? 'Listo.' : 'Nada se ha modificado. Repite con --apply para ejecutar.');
await client.destroy();
