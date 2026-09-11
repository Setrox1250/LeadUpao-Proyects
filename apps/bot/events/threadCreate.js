const { Events } = require('discord.js');
const supabase = require('../database');
const { pilarDeForo } = require('../services/foros');

// `tareas.descripcion` es texto libre, pero 500 es lo que admite el formulario
// de la web y lo que cabe leer de un vistazo en una tarjeta del tablero.
const MAX_DESCRIPCION = 500;

/**
 * Descripción de una tarea nacida en el foro: el primer mensaje del hilo.
 *
 * Antes se guardaba la constante 'Tarea creada automáticamente desde el foro',
 * así que en la web todas esas tareas salían con el mismo texto y lo que la
 * persona escribió al abrir el hilo no llegaba nunca. En un foro de Discord el
 * mensaje inicial ES la descripción.
 *
 * Devuelve null si no se puede obtener: un hilo sin mensaje inicial es posible
 * (borrado, o el bot sin permiso de leer el historial), y una tarea sin
 * descripción es mejor que una tarea perdida.
 */
async function descripcionDelHilo(thread) {
    try {
        const inicial = await thread.fetchStarterMessage();
        const texto = inicial?.content?.trim();
        if (!texto) return null;
        return texto.length > MAX_DESCRIPCION
            ? `${texto.slice(0, MAX_DESCRIPCION - 1)}…`
            : texto;
    } catch (err) {
        console.warn(`[threadCreate] No se pudo leer el mensaje inicial de "${thread.name}": ${err.message}`);
        return null;
    }
}

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

        const descripcion = await descripcionDelHilo(thread);

        try {
            const { error } = await supabase
                .from('tareas')
                .insert({
                    titulo:          thread.name,
                    descripcion,
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
