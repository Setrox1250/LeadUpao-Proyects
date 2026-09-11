const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate, // 'interactionCreate'
    once: false,

    async execute(interaction) {
        // Autocompletado: Discord lo pide mientras la persona escribe, y espera
        // respuesta en menos de 3 segundos. Va antes que nada y nunca contesta
        // con un mensaje de error, porque en este tipo de interacción no existe
        // tal cosa: o se responden opciones, o el desplegable se queda vacío.
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command?.autocomplete) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(`[interactionCreate] Error en autocompletado de /${interaction.commandName}:`, error);
                // Lista vacía en vez de dejar la interacción colgada.
                if (!interaction.responded) await interaction.respond([]).catch(() => {});
            }
            return;
        }

        // El resto del handler solo procesa Slash Commands; otros tipos
        // (botones, modales) se ignoran aquí.
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
