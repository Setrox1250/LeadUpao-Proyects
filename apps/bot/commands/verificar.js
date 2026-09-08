const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database');

module.exports = {
    // ── Definición del comando ────────────────────────────────────────────
    data: new SlashCommandBuilder()
        .setName('verificar')
        .setDescription('Vincula tu cuenta de Discord con tu registro en la plataforma web.')
        .addStringOption(option =>
            option
                .setName('codigo')
                .setDescription('Código de verificación que te entregó el administrador')
                .setRequired(true)
        ),

    // ── Lógica de ejecución ───────────────────────────────────────────────
    async execute(interaction) {
        const discordUserId = interaction.user.id;
        const codigo = interaction.options.getString('codigo', true).trim().toUpperCase();

        // Diferimos la respuesta para evitar que el comando expire mientras consulta Supabase
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // 1. Buscar el miembro por su código de verificación (generado por el admin en la web)
            const { data: miembro, error } = await supabase
                .from('miembros')
                .select('*')
                .eq('codigo_verificacion', codigo)
                .maybeSingle();

            if (error) throw error;

            // CASO A: Código inválido
            if (!miembro) {
                return interaction.editReply({
                    content: '❌ El código de verificación no es válido. Verifícalo con el administrador y vuelve a intentarlo.',
                });
            }

            // CASO B: Ya verificado
            if (miembro.estado === 'VERIFICADO') {
                if (miembro.discord_id === discordUserId) {
                    return interaction.editReply({
                        content: '⚠️ Ya te encuentras verificado en el sistema.',
                    });
                }
                return interaction.editReply({
                    content: '❌ Este código ya fue utilizado por otra cuenta de Discord. Contacta al administrador si crees que es un error.',
                });
            }

            // CASO C: Pendiente de aprobación (registro heredado, sin aprobación del admin)
            if (miembro.estado === 'PENDIENTE') {
                return interaction.editReply({
                    content: '⏳ Tu perfil aún está pendiente de aprobación por la Directiva o el pilar de Tecnología.',
                });
            }

            // CASO D: Validar que el estado sea estrictamente 'APROBADO_ADMIN'
            if (miembro.estado !== 'APROBADO_ADMIN') {
                return interaction.editReply({
                    content: '❌ Tu registro no se encuentra en estado aprobado para su verificación. Comunícate con un administrador.',
                });
            }

            // Obtener el rol base de la comunidad configurado por variable de entorno
            const rolVerificado = interaction.guild.roles.cache.get(process.env.ROLE_ID);
            if (!rolVerificado) {
                return interaction.editReply({
                    content: '⚠️ Código válido, pero el rol de miembro configurado en el bot no existe. Avisa al administrador.',
                });
            }

            // Preparar el conjunto de roles a asignar (iniciando con el rol verificado base)
            const rolesAAsignar = [rolVerificado];
            const warnings = [];

            // 1. Buscar y agregar rol de cargo (jerarquía) consultando la tabla 'roles'
            if (miembro.cargo) {
                const { data: roleData, error: roleError } = await supabase
                    .from('roles')
                    .select('discord_role_id')
                    .eq('nombre', miembro.cargo)
                    .maybeSingle();

                if (roleError) {
                    console.error('[verificar] Error al consultar rol de cargo:', roleError);
                } else if (roleData && roleData.discord_role_id) {
                    const cargoRole = interaction.guild.roles.cache.get(roleData.discord_role_id);
                    if (cargoRole) {
                        rolesAAsignar.push(cargoRole);
                    } else {
                        warnings.push(`Rol de cargo en Discord no encontrado (ID: ${roleData.discord_role_id}).`);
                    }
                } else {
                    warnings.push(`Rol de cargo "${miembro.cargo}" no configurado con un ID de Discord en la BD.`);
                }
            }

            // 2. Buscar y agregar rol de pilar (canales privados) consultando la tabla 'pilares'
            if (miembro.pilar) {
                const { data: pilarData, error: pilarError } = await supabase
                    .from('pilares')
                    .select('discord_role_id')
                    .eq('nombre', miembro.pilar)
                    .maybeSingle();

                if (pilarError) {
                    console.error('[verificar] Error al consultar rol de pilar:', pilarError);
                } else if (pilarData && pilarData.discord_role_id) {
                    const pilarRole = interaction.guild.roles.cache.get(pilarData.discord_role_id);
                    if (pilarRole) {
                        rolesAAsignar.push(pilarRole);
                    } else {
                        warnings.push(`Rol de pilar en Discord no encontrado (ID: ${pilarData.discord_role_id}).`);
                    }
                } else {
                    warnings.push(`Rol de pilar "${miembro.pilar}" no configurado con un ID de Discord en la BD.`);
                }
            }

            // Vincular este Discord ID al miembro y marcarlo como VERIFICADO
            const { error: updateError } = await supabase
                .from('miembros')
                .update({ discord_id: discordUserId, estado: 'VERIFICADO' })
                .eq('id', miembro.id);

            if (updateError) throw updateError;

            // Asignar todos los roles en el servidor
            await interaction.member.roles.add(rolesAAsignar);

            // Construir respuesta de éxito con advertencias si faltase algún rol secundario en Discord
            let mensajeExito = `🎉 ¡Verificación completada con éxito! Bienvenido oficialmente a LEAD UPAO, ${miembro.nombre_completo}.`;
            if (warnings.length > 0) {
                mensajeExito += `\n\n⚠️ **Nota**: Algunos roles específicos no se pudieron asignar automáticamente:\n${warnings.map(w => `- ${w}`).join('\n')}\nPor favor, avisa a un administrador para que los asigne manualmente.`;
            }

            return interaction.editReply({
                content: mensajeExito,
            });

        } catch (err) {
            console.error('[verificar] Error inesperado:', err);
            return interaction.editReply({
                content: '💥 Error interno del servidor. Por favor, inténtalo de nuevo más tarde.',
            });
        }
    },
};
