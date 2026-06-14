const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database');

module.exports = {
    // ── Definición del comando ────────────────────────────────────────────
    data: new SlashCommandBuilder()
        .setName('verificar')
        .setDescription('Verifícate en el servidor de Discord usando tu registro web.'),

    // ── Lógica de ejecución ───────────────────────────────────────────────
    async execute(interaction) {
        const discordUserId = interaction.user.id;

        // Diferimos la respuesta para evitar que el comando expire mientras consulta Supabase
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // 1. Buscar el miembro en la tabla 'miembros' por su discord_id
            const { data: miembro, error } = await supabase
                .from('miembros')
                .select('*')
                .eq('discord_id', discordUserId)
                .maybeSingle();

            if (error) throw error;

            // CASO A: No existe en la base de datos
            if (!miembro) {
                return interaction.editReply({
                    content: '❌ No has iniciado tu registro en la plataforma web. Por favor ingresa a http://localhost:3000 primero.',
                });
            }

            // CASO B: Estado 'PENDIENTE' (esperando aprobación del admin)
            if (miembro.estado === 'PENDIENTE') {
                return interaction.editReply({
                    content: '⏳ Tu perfil ya está registrado en la web, pero está pendiente de aprobación por el pilar de Tecnología o la Directiva. Te avisaremos cuando seas admitido.',
                });
            }

            // CASO D: Estado 'VERIFICADO' (ya se verificó anteriormente)
            if (miembro.estado === 'VERIFICADO') {
                return interaction.editReply({
                    content: '⚠️ Ya te encuentras verificado en el sistema.',
                });
            }

            // CASO C: Estado 'APROBADO_ADMIN' (aprobado en la web, listo para recibir el rol)
            if (miembro.estado === 'APROBADO_ADMIN') {
                const rolVerificado = interaction.guild.roles.cache.get(process.env.ROLE_ID);

                if (!rolVerificado) {
                    return interaction.editReply({
                        content: '⚠️ Solicitud aprobada en la web, pero el rol de miembro configurado en el bot no existe. Avisa al administrador.',
                    });
                }

                // Asignar el rol de miembro verificado en el servidor
                await interaction.member.roles.add(rolVerificado);

                // Marcar el estado como VERIFICADO en la base de datos
                const { error: updateError } = await supabase
                    .from('miembros')
                    .update({ estado: 'VERIFICADO' })
                    .eq('discord_id', discordUserId);

                if (updateError) throw updateError;

                return interaction.editReply({
                    content: '🎉 ¡Verificación completada con éxito! Bienvenido oficialmente a LEAD UPAO.',
                });
            }

        } catch (err) {
            console.error('[verificar] Error inesperado:', err);
            return interaction.editReply({
                content: '💥 Error interno del servidor. Por favor, inténtalo de nuevo más tarde.',
            });
        }
    },
};
