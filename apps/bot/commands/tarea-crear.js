const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database');
const { esFechaValida, hoyEnLima, formatearFecha } = require('../services/fechas');
const { areasDisponibles, SIN_AREA } = require('../services/foros');

/**
 * Registra una tarea desde Discord sin pasar por el foro.
 *
 * El comando anterior no funcionaba en ninguna invocación: insertaba
 * `creador_id`, `canal_id` y `thread_id`, tres columnas que no existen en
 * `tareas`, y `estado: 'PENDIENTE'`, prohibido por el `check` de la migración
 * 0008. Postgres rechazaba la fila, el catch lo mandaba a console.error y la
 * persona veía un "no se pudo registrar" sin causa. Tampoco aceptaba área ni
 * fecha, así que la tarea no podía acabar en el foro correcto.
 *
 * No se escribe `id_discord_hilo`: el hilo lo abre supabaseListener al recibir
 * el INSERT por Realtime, igual que con las tareas creadas desde la web. Así
 * hay un solo camino de creación de hilos.
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('tarea-crear')
        .setDescription('Registra una tarea nueva y abre su hilo en el foro del área.')
        .addStringOption(option =>
            option
                .setName('titulo')
                .setDescription('Título corto y descriptivo de la tarea.')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption(option =>
            option
                .setName('area')
                .setDescription('Área a la que pertenece. Si la omites, va al backlog general.')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('fecha')
                .setDescription('Fecha de entrega en formato AAAA-MM-DD. Opcional.')
                .setRequired(false)
                .setMinLength(10)
                .setMaxLength(10)
        )
        .addStringOption(option =>
            option
                .setName('descripcion')
                .setDescription('Detalle de la tarea. Se publica como primer mensaje del hilo.')
                .setRequired(false)
                .setMaxLength(500)
        ),

    // Las áreas viven en `pilares`, así que no pueden ser `choices` estáticas:
    // habría que volver a registrar el comando cada vez que se crea un área.
    async autocomplete(interaction) {
        const escrito = interaction.options.getFocused().toLowerCase();
        const areas = await areasDisponibles();

        const opciones = [SIN_AREA, ...areas]
            .filter(nombre => nombre.toLowerCase().includes(escrito))
            .slice(0, 25)                       // Discord no admite más de 25
            .map(nombre => ({ name: nombre, value: nombre }));

        return interaction.respond(opciones);
    },

    async execute(interaction) {
        const titulo      = interaction.options.getString('titulo').trim();
        const areaElegida = interaction.options.getString('area');
        const fecha       = interaction.options.getString('fecha')?.trim() || null;
        const descripcion = interaction.options.getString('descripcion')?.trim() || null;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!titulo) {
            return interaction.editReply({ content: '❌ El título no puede estar vacío.' });
        }

        if (fecha && !esFechaValida(fecha)) {
            return interaction.editReply({
                content:
                    `❌ **${fecha}** no es una fecha válida. Usa el formato \`AAAA-MM-DD\`, ` +
                    `por ejemplo \`${hoyEnLima()}\`.`,
            });
        }

        // `pilar` NULL significa tarea general: va al foro general y la ve todo
        // el mundo (docs/discord-tareas.md).
        let pilar = null;
        if (areaElegida && areaElegida !== SIN_AREA) {
            const areas = await areasDisponibles();
            // El autocompletado sugiere, no obliga: se puede escribir a mano.
            pilar = areas.find(a => a.toLowerCase() === areaElegida.toLowerCase()) ?? null;

            if (!pilar) {
                return interaction.editReply({
                    content:
                        `❌ No existe el área **${areaElegida}**. Las áreas registradas son:\n` +
                        areas.map(a => `• ${a}`).join('\n'),
                });
            }
        }

        const { error } = await supabase
            .from('tareas')
            .insert({
                titulo,
                descripcion,
                pilar,
                etiquetas: [],
                estado: 'BACKLOG',
                fecha_vencimiento: fecha,
                // Mismo criterio que threadCreate: el id de Discord de quien la crea.
                autor_id: interaction.user.id,
            });

        if (error) {
            // El error real al log; a la persona, algo accionable. Antes ambos
            // eran el mismo mensaje genérico y no se podía diagnosticar nada.
            console.error('[tarea-crear] Error al insertar tarea:', error);
            return interaction.editReply({
                content: `❌ No se pudo registrar la tarea: ${error.message}`,
            });
        }

        const donde = pilar ?? 'el backlog general';
        const cuando = fecha ? ` · entrega el **${formatearFecha(fecha)}**` : '';

        return interaction.editReply({
            content:
                `✅ Tarea **${titulo}** registrada en **${donde}**${cuando}.\n` +
                'Su hilo aparecerá en el foro en unos segundos.',
        });
    },
};
