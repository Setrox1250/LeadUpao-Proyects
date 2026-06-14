const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate, // 'interactionCreate'
    once: false,

    async execute(interaction) {
        // Este handler solo procesa Slash Commands; otros tipos (botones, modales) se ignoran aquí
        if (!interaction.isChatInputCommand()) return;

        // Buscar el comando en la colección indexada durante el arranque
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`[interactionCreate] Comando no encontrado: /${interaction.commandName}`);
            return interaction.reply({
                content: '❌ Este comando no existe o no está registrado actualmente.',
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`[interactionCreate] Error ejecutando /${interaction.commandName}:`, error);

            const errorPayload = {
                content: '💥 Ocurrió un error inesperado al ejecutar el comando.',
                flags: MessageFlags.Ephemeral,
            };

            // Elegir el método correcto según el estado actual de la interacción
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorPayload);
            } else {
                await interaction.reply(errorPayload);
            }
        }
    },
};
