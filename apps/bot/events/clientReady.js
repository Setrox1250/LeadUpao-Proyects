const { Events, REST, Routes } = require('discord.js');
const { startSupabaseListener } = require('../services/supabaseListener');
const { startSupabaseKeepAlive } = require('../services/supabaseKeepAlive');

module.exports = {
    name: Events.ClientReady, // 'clientReady' en Discord.js v14
    once: true,               // Solo se ejecuta una vez al iniciar

    async execute(client) {
        console.log(`\n✅ Bot conectado como: ${client.user.tag}`);
        console.log(`📋 Comandos en memoria: ${client.commands.size}`);

        // Serializar los comandos cargados en memoria para enviararlos a la API de Discord
        const commandsJson = client.commands.map(cmd => cmd.data.toJSON());
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);

        try {
            console.log('[DISCORD] Registrando comandos de barra (/)...');

            await rest.put(
                // Usa applicationGuildCommands para registro instantáneo en un servidor específico.
                // Cambia a applicationCommands(CLIENT_ID) para despliegue global (puede tardar hasta 1 hora).
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commandsJson },
            );

            console.log(`[DISCORD] ${commandsJson.length} comando(s) registrado(s) con éxito.\n`);

        } catch (error) {
            console.error('[clientReady] Error al registrar comandos en Discord:', error);
        }

        // Iniciar escucha de cambios en Supabase → Discord
        startSupabaseListener(client);

        // Iniciar la función para mantener vivo el servidor de Supabase
        startSupabaseKeepAlive();
    },
};
