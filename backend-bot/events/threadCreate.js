const { Events } = require('discord.js');
const supabase = require('../database');

module.exports = {
    name: Events.ThreadCreate, // 'threadCreate'
    once: false,

    // Discord pasa dos argumentos: el hilo creado y si fue recién creado (vs. hilo antiguo que el bot recién ve)
    async execute(thread, newlyCreated) {
        // Ignorar hilos que existían antes de que el bot arrancara
        if (!newlyCreated) return;

        // Filtrar: solo procesar posts del canal de foro configurado en .env
        if (thread.parentId !== process.env.FORUM_CHANNEL_ID) return;

        try {
            const { error } = await supabase
                .from('tareas')
                .insert({
                    titulo:           thread.name,
                    descripcion:      'Tarea creada automáticamente desde el foro.',
                    id_discord_hilo:  thread.id,
                    canal_id:         thread.parentId,
                    creador_id:       thread.ownerId,
                    estado:           'PENDIENTE',
                });

            if (error) throw error;

            console.log(`[threadCreate] Tarea guardada desde foro → "${thread.name}" (ID: ${thread.id})`);

        } catch (err) {
            console.error('[threadCreate] Error al guardar tarea desde hilo de foro:', err);
        }
    },
};
