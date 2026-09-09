require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ──────────────────────────────────────────────
// Validación del entorno
//
// Antes de cargar nada más: un DISCORD_TOKEN ausente producía un
// `DiscordjsError [TokenInvalid]` con traza de discord.js, ya arrancado el
// servidor keep-alive, sin decir qué variable faltaba. En Render, donde no hay
// archivo .env y todo viene del dashboard, eso cuesta de diagnosticar.
// ──────────────────────────────────────────────
const REQUERIDAS = {
    DISCORD_TOKEN: 'Token del bot — Discord Developer Portal → Bot → Reset Token',
    CLIENT_ID:     'Application ID — Discord Developer Portal → General Information',
    GUILD_ID:      'ID del servidor — clic derecho en el servidor → Copiar ID',
    SUPABASE_URL:  'URL del proyecto — Supabase → Settings → API',
    SUPABASE_KEY:  'Clave de servicio — Supabase → Settings → API Keys',
};

const ausentes = Object.entries(REQUERIDAS).filter(([clave]) => !process.env[clave]?.trim());
if (ausentes.length) {
    console.error('\n[ENTORNO] Faltan variables obligatorias:\n');
    for (const [clave, ayuda] of ausentes) console.error(`  ${clave.padEnd(14)} ${ayuda}`);
    console.error('\nEn local van en apps/bot/.env; en Render, en Environment.\n');
    process.exit(1);
}

// Un token con espacios o saltos de línea al pegarlo da un TokenInvalid
// indistinguible de un token equivocado.
if (process.env.DISCORD_TOKEN !== process.env.DISCORD_TOKEN.trim()) {
    console.error('\n[ENTORNO] DISCORD_TOKEN tiene espacios o saltos de línea alrededor. Vuelve a pegarlo limpio.\n');
    process.exit(1);
}

// Avisos que no impiden arrancar, pero desactivan funciones concretas.
const OPCIONALES = {
    GENERAL_FORUM_CHANNEL_ID: 'las tareas sin área no se sincronizarán con Discord',
    ROLE_ID:                  '/verificar no podrá asignar el rol base y fallará',
    SYNC_SECRET_TOKEN:        'la web no podrá pedir sincronizaciones al bot',
};
for (const [clave, efecto] of Object.entries(OPCIONALES)) {
    if (!process.env[clave]?.trim()) console.warn(`[ENTORNO] Falta ${clave}: ${efecto}.`);
}

const supabase = require('./database');

// ──────────────────────────────────────────────
// Cliente de Discord con los intents necesarios
// ──────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Necesario para asignar roles
    ],
});

// Colección que almacenará todos los comandos indexados por nombre
client.commands = new Collection();

// ──────────────────────────────────────────────
// Carga dinámica de Comandos (/commands)
// ──────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[CMD] Cargado: /${command.data.name}`);
    } else {
        console.warn(`[CMD] Advertencia: ${file} no exporta 'data' o 'execute'.`);
    }
}

// ──────────────────────────────────────────────
// Carga dinámica de Eventos (/events)
// ──────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`[EVT] Registrado: ${event.name} (once: ${!!event.once})`);
}

// ──────────────────────────────────────────────
// Inicio de sesión
// ──────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);

// ──────────────────────────────────────────────
// Servidor Express Keep-Alive para Render
// ──────────────────────────────────────────────
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🚀 LEAD Bot de Discord está completamente en línea.');
});

// Ruta protegida para sincronización masiva de roles y pilares
app.post('/api/sync-all', async (req, res) => {
    try {
        const token = req.headers['authorization'] || req.headers['x-sync-token'];
        if (!process.env.SYNC_SECRET_TOKEN || token !== process.env.SYNC_SECRET_TOKEN) {
            return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
        }

        const guildId = process.env.GUILD_ID;
        if (!guildId) {
            return res.status(500).json({ error: 'GUILD_ID no configurado en el bot' });
        }

        const guild = await client.guilds.fetch(guildId);
        let rolesEnlazados = 0;
        let rolesCreados = 0;

        const syncTable = async (tableName) => {
            const { data: records, error } = await supabase.from(tableName).select('*');
            if (error) throw error;

            for (const record of records) {
                let role = null;
                
                // Si ya tiene un discord_role_id, verificamos si aún existe en el servidor
                if (record.discord_role_id) {
                    role = guild.roles.cache.get(record.discord_role_id);
                }

                // Si no se encontró (o no tenía ID), buscamos un rol existente por nombre exacto
                if (!role) {
                    role = guild.roles.cache.find(r => r.name === record.nombre);
                }

                if (role) {
                    // El rol existe en Discord. Si en Supabase no estaba registrado su ID (o era distinto), lo actualizamos.
                    if (record.discord_role_id !== role.id) {
                        await supabase.from(tableName).update({ discord_role_id: role.id }).eq('nombre', record.nombre);
                        rolesEnlazados++;
                    }
                } else {
                    // El rol no existe en Discord, así que lo creamos
                    const newRole = await guild.roles.create({
                        name: record.nombre,
                        reason: `Sincronización masiva desde Supabase tabla ${tableName}`
                    });
                    await supabase.from(tableName).update({ discord_role_id: newRole.id }).eq('nombre', record.nombre);
                    rolesCreados++;
                }
            }
        };

        await syncTable('roles');
        await syncTable('pilares');

        return res.json({ 
            success: true, 
            message: 'Sincronización completada exitosamente.',
            estadisticas: { rolesEnlazados, rolesCreados } 
        });

    } catch (err) {
        console.error('[API sync-all] Error interno:', err);
        return res.status(500).json({ error: 'Error interno del servidor', detalles: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🌍 Servidor Keep-Alive escuchando en el puerto ${PORT}`);
});

