const { Events } = require('discord.js');
const supabase = require('../database');
const { pilarDeForo } = require('../services/foros');
const { estadoDeTag } = require('../services/supabaseListener');

/**
 * Estado de vuelta: Discord → web.
 *
 * Hasta ahora el circuito solo era bidireccional para la CREACIÓN. El estado
 * viajaba del panel al foro y nunca al revés, así que quien arrastraba su
 * tarea a «Completado» desde el móvil, en el foro, no movía nada en el
 * tablero y el Presidente seguía viéndola pendiente. La documentación decía
 * que estaba probado en ambas direcciones; lo estaba a medias.
 *
 * El foro es donde la gente trabaja de verdad. Que la etiqueta sea editable y
 * no signifique nada es peor que no tenerla.
 */
module.exports = {
    name: Events.ThreadUpdate, // 'threadUpdate'
    once: false,

    async execute(hiloAntes, hiloAhora) {
        // Solo hilos de un foro de tareas: el resto del servidor no nos incumbe.
        const { gestionado } = await pilarDeForo(hiloAhora.parentId);
        if (!gestionado) return;

        // threadUpdate salta por cualquier cosa: renombrar, archivar, cambiar
        // la lentitud del canal. Solo interesa que cambien las etiquetas.
        const antes = [...(hiloAntes.appliedTags ?? [])].sort().join(',');
        const ahora = [...(hiloAhora.appliedTags ?? [])].sort().join(',');
        if (antes === ahora) return;

        const foro = hiloAhora.parent;
        if (!foro) return;

        // De las etiquetas aplicadas, quedarse con la de estado. Si hay más de
        // una —posible si alguien las pone a mano— no se adivina: se avisa y
        // no se toca la base, porque elegir mal deja al tablero mintiendo.
        const estados = hiloAhora.appliedTags
            .map(id => foro.availableTags.find(t => t.id === id))
            .filter(Boolean)
            .map(tag => estadoDeTag(tag.name))
            .filter(Boolean);

        const unicos = [...new Set(estados)];
        if (unicos.length === 0) return;
        if (unicos.length > 1) {
            return console.warn(
                `[threadUpdate] El hilo "${hiloAhora.name}" tiene ${unicos.length} etiquetas de ` +
                `estado a la vez (${unicos.join(', ')}). No se sincroniza hasta que quede una.`
            );
        }

        const estado = unicos[0];

        // Escribir solo si de verdad cambia. Un UPDATE que no cambia nada
        // gasta una vuelta de Realtime para acabar descartado en el listener.
        const { data: tarea, error: errorLectura } = await supabase
            .from('tareas')
            .select('id, estado')
            .eq('id_discord_hilo', hiloAhora.id)
            .maybeSingle();

        if (errorLectura) {
            return console.error('[threadUpdate] No se pudo leer la tarea del hilo:', errorLectura.message);
        }
        if (!tarea) {
            // Un hilo del foro sin tarea asociada: creado antes de que el bot
            // existiera, o su INSERT falló en su día.
            return console.warn(
                `[threadUpdate] El hilo "${hiloAhora.name}" (${hiloAhora.id}) no tiene tarea en la base.`
            );
        }
        if (tarea.estado === estado) return;

        const { error } = await supabase
            .from('tareas')
            .update({ estado })
            .eq('id', tarea.id);

        if (error) {
            return console.error(
                `[threadUpdate] No se pudo pasar la tarea ID=${tarea.id} a ${estado}:`, error.message
            );
        }

        // El UPDATE vuelve por Realtime al listener, que verá el hilo ya
        // etiquetado con ese estado y no lo reenviará a Discord.
        console.log(
            `[threadUpdate] "${hiloAhora.name}" → ${estado} (era ${tarea.estado}), desde el foro.`
        );
    },
};
