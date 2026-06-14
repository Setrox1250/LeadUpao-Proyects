require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');

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
