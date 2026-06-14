const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database');

module.exports = {
    // ── Definición del comando ────────────────────────────────────────────
    data: new SlashCommandBuilder()
        .setName('tarea-crear')
        .setDescription('Registra una nueva tarea pendiente manualmente en el sistema.')
        .addStringOption(option =>
            option
                .setName('titulo')
                .setDescription('Título corto y descriptivo de la tarea.')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption(option =>
            option
                .setName('descripcion')
                .setDescription('Detalle adicional sobre la tarea (opcional).')
                .setRequired(false)
                .setMaxLength(500)
        ),

    // ── Lógica de ejecución ───────────────────────────────────────────────
    async execute(interaction) {
        const titulo      = interaction.options.getString('titulo');
        const descripcion = interaction.options.getString('descripcion') ?? 'Sin descripción.';
        const creadorId   = interaction.user.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const { error } = await supabase
                .from('tareas')
                .insert({
                    titulo,
                    descripcion,
                    creador_id: creadorId,
                    canal_id:   interaction.channelId,
                    thread_id:  null,   // null = creada por comando, no desde el foro
                    estado:     'PENDIENTE',
                });

            if (error) throw error;

            return interaction.editReply({
                content: `✅ Tarea **"${titulo}"** registrada correctamente.`,
            });

        } catch (err) {
            console.error('[tarea-crear] Error al insertar tarea:', err);
            return interaction.editReply({
                content: '❌ No se pudo registrar la tarea. Inténtalo de nuevo más tarde.',
            });
        }
    },
};
