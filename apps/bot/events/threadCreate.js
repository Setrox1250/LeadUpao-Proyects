const { Events } = require('discord.js');
const supabase = require('../database');
const { pilarDeForo } = require('../services/foros');

module.exports = {
    name: Events.ThreadCreate, // 'threadCreate'
    once: false,

    // Discord pasa dos argumentos: el hilo creado y si fue recién creado (vs. hilo antiguo que el bot recién ve)
    async execute(thread, newlyCreated) {
        // Ignorar hilos que existían antes de que el bot arrancara
        if (!newlyCreated) return;

        // El canal determina el área: cada pilar tiene su foro de backlog y las
        // tareas sin área viven en el foro general (ver docs/discord-tareas.md).
        const { gestionado, pilar } = await pilarDeForo(thread.parentId);
        if (!gestionado) return;

        try {
            const { error } = await supabase
                .from('tareas')
                .insert({
                    titulo:          thread.name,
                    descripcion:     'Tarea creada automáticamente desde el foro.',
                    id_discord_hilo: thread.id,
                    autor_id:        thread.ownerId,
                    pilar,
                    estado:          'BACKLOG',
                });

            if (error) throw error;

            console.log(`[threadCreate] Tarea guardada desde el foro de "${pilar ?? 'general'}" → "${thread.name}" (ID: ${thread.id})`);

        } catch (err) {
            console.error('[threadCreate] Error al guardar tarea desde hilo de foro:', err);
        }
    },
};
