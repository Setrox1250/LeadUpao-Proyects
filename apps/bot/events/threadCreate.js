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

        // No reaccionar a los hilos que abre el propio bot.
        //
        // Cuando la web crea una tarea, el listener de Supabase abre su hilo en
        // el foro del área. Ese hilo dispara este mismo evento, y sin este
        // guard el bot lo interpretaría como una tarea nueva venida de Discord
        // e insertaría un DUPLICADO de la que acaba de sincronizar. El índice
        // único de `id_discord_hilo` solo lo tapa según quién gane la carrera
        // entre este insert y la escritura del id de vuelta.
        if (thread.ownerId === thread.client.user.id) {
            console.log(`[threadCreate] Hilo "${thread.name}" creado por el propio bot: ya tiene tarea.`);
            return;
        }

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
