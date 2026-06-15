require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');
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

