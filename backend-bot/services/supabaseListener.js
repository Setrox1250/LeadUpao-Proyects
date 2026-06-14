const { ChannelType } = require('discord.js');
const supabase = require('../database');

// ──────────────────────────────────────────────────────────────────────────────
// Configuración de etiquetas
//
// ESTADO_TAG: etiquetas que representan el estado de una tarea en el foro.
// Sus nombres deben coincidir EXACTAMENTE con los del panel de Discord.
// ──────────────────────────────────────────────────────────────────────────────
const ESTADO_TAG = {
    EN_PROGRESO: 'En Progreso',
    COMPLETADO:  'Completado',
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Busca un tag por nombre en el canal foro (case-insensitive). Retorna null si no existe. */
function findTag(forumChannel, tagName) {
    return forumChannel.availableTags.find(
        t => t.name.toLowerCase() === tagName.toLowerCase()
    ) ?? null;
}

/** Convierte un array de nombres de etiquetas a sus IDs del foro de Discord. */
function resolveTagIds(forumChannel, tagNames) {
    if (!Array.isArray(tagNames) || tagNames.length === 0) return [];
    return tagNames
        .map(name => findTag(forumChannel, name)?.id)
        .filter(Boolean);
}

/**
 * Devuelve los IDs de etiquetas del hilo excluyendo las de "estado"
 * (EN_PROGRESO, COMPLETADO) para evitar acumularlas al cambiar de estado.
 */
function sinEtiquetasDeEstado(thread, forumChannel) {
    const nombresDeEstado = Object.values(ESTADO_TAG).map(n => n.toLowerCase());
    return thread.appliedTags.filter(id => {
        const tag = forumChannel.availableTags.find(t => t.id === id);
        return tag && !nombresDeEstado.includes(tag.name.toLowerCase());
    });
}

/** Obtiene un hilo de Discord con manejo de errores. Retorna null si falla. */
async function fetchThread(client, threadId, contexto) {
    try {
        const channel = await client.channels.fetch(threadId);
        if (!channel?.isThread()) {
            console.warn(`[SupabaseListener] ${contexto}: ${threadId} no es un hilo válido.`);
            return null;
        }
        return channel;
    } catch (err) {
        console.error(`[SupabaseListener] ${contexto}: no se pudo obtener el hilo ${threadId}: ${err.message}`);
        return null;
    }
}

/** Desarchiva un hilo si está archivado. Necesario para poder modificarlo. */
async function asegurarDesarchivado(thread) {
    if (thread.archived) await thread.setArchived(false);
}

// ──────────────────────────────────────────────────────────────────────────────
// Handler: INSERT — Tarea creada desde la web
//
// Crea un hilo nuevo en el foro de Discord y actualiza la fila con el
// id_discord_hilo generado para mantener la sincronización bidireccional.
//
// GUARD: Si la tarea ya tiene id_discord_hilo, fue creada desde Discord
// (evento threadCreate) y no debemos duplicar el hilo.
// ──────────────────────────────────────────────────────────────────────────────
async function handleTareaInsert(client, payload) {
    const tarea = payload.new;

    // Guard: hilo ya existente (INSERT vino de threadCreate.js, no de la web)
    if (tarea.id_discord_hilo) {
        console.log(`[SupabaseListener] INSERT ignorado: tarea ID=${tarea.id} ya tiene hilo Discord.`);
        return;
    }

    const { id, titulo, descripcion, etiquetas } = tarea;
    const forumChannelId = process.env.FORUM_CHANNEL_ID;

    if (!forumChannelId) {
        console.error('[SupabaseListener] FORUM_CHANNEL_ID no está definido en .env');
        return;
    }

    // Obtener el canal foro
    let forumChannel;
    try {
        forumChannel = await client.channels.fetch(forumChannelId);
    } catch (err) {
        console.error(`[SupabaseListener] No se pudo obtener el foro ${forumChannelId}: ${err.message}`);
        return;
    }

    if (forumChannel?.type !== ChannelType.GuildForum) {
        console.warn('[SupabaseListener] El canal configurado en FORUM_CHANNEL_ID no es un ForumChannel.');
        return;
    }

    // Resolver IDs de etiquetas por nombre (máx. 5 tags soportados por Discord)
    const tagIds = resolveTagIds(forumChannel, etiquetas).slice(0, 5);

    // Crear el hilo en el foro
    let thread;
    try {
        thread = await forumChannel.threads.create({
            name:         titulo || 'Nueva Tarea',
            message:      { content: descripcion || 'Tarea creada desde el panel web de LEAD UPAO.' },
            appliedTags:  tagIds,
        });
    } catch (err) {
        console.error(`[SupabaseListener] Error al crear hilo en Discord para tarea ID=${id}: ${err.message}`);
        return;
    }

    // Guardar el id del hilo recién creado en Supabase
    // Este UPDATE dispara otro evento Realtime, pero el handler de UPDATE
    // lo ignora porque el estado 'BACKLOG' no tiene acción Discord definida.
    const { error: updateError } = await supabase
        .from('tareas')
        .update({ id_discord_hilo: thread.id })
        .eq('id', id);

    if (updateError) {
        console.error(
            `[SupabaseListener] Hilo creado (${thread.id}) pero falló el UPDATE en Supabase:`,
            updateError.message
        );
    } else {
        console.log(`[SupabaseListener] INSERT → Hilo creado para "${titulo}" (Discord ID: ${thread.id})`);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Handler: UPDATE — Tarea editada desde la web (cambio de estado)
// ──────────────────────────────────────────────────────────────────────────────
async function handleTareaUpdate(client, payload) {
    const tarea    = payload.new;
    const threadId = tarea.id_discord_hilo;
    const estado   = tarea.estado;

    // Sin hilo asociado: tarea creada manualmente en la BD o aún sin sincronizar
    if (!threadId) {
        console.warn(
            `[SupabaseListener] UPDATE ignorado en tarea ID=${tarea.id}: no tiene id_discord_hilo.`
        );
        return;
    }

    // Solo reaccionar a estados con lógica Discord definida
    if (!ESTADO_TAG[estado]) {
        console.log(`[SupabaseListener] Estado "${estado}" en tarea ID=${tarea.id}: sin acción Discord.`);
        return;
    }

    const thread = await fetchThread(client, threadId, `UPDATE tarea ID=${tarea.id}`);
    if (!thread) return;

    const forumChannel = thread.parent;
    if (!forumChannel) {
        console.warn(`[SupabaseListener] Hilo ${threadId} sin canal padre accesible.`);
        return;
    }

    await asegurarDesarchivado(thread);

    if (estado === 'EN_PROGRESO') {
        await aplicarEstadoEnProgreso(thread, forumChannel);
    } else if (estado === 'COMPLETADO') {
        await aplicarEstadoCompletado(thread, forumChannel);
    }
}

async function aplicarEstadoEnProgreso(thread, forumChannel) {
    const tag            = findTag(forumChannel, ESTADO_TAG.EN_PROGRESO);
    const baseEtiquetas  = sinEtiquetasDeEstado(thread, forumChannel);
    const nuevasEtiquetas = tag ? [...baseEtiquetas, tag.id] : baseEtiquetas;

    await thread.setAppliedTags(nuevasEtiquetas);
    await thread.send("🔄 El estado de esta tarea ha sido cambiado a 'En Progreso' desde el panel web.");
    console.log(`[SupabaseListener] Hilo "${thread.name}" → EN_PROGRESO.`);
}

async function aplicarEstadoCompletado(thread, forumChannel) {
    const tag             = findTag(forumChannel, ESTADO_TAG.COMPLETADO);
    const baseEtiquetas   = sinEtiquetasDeEstado(thread, forumChannel);
    const nuevasEtiquetas = tag ? [...baseEtiquetas, tag.id] : baseEtiquetas;

    await thread.setAppliedTags(nuevasEtiquetas);
    await thread.send(
        "✅ Esta tarea ha sido marcada como 'Completada' desde el panel web. " +
        'Sincronización finalizada.'
    );
    await thread.setArchived(true);
    console.log(`[SupabaseListener] Hilo "${thread.name}" → COMPLETADO y archivado.`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Handler: DELETE — Tarea eliminada desde la web
//
// PREREQUISITO DE BASE DE DATOS:
// Para que payload.old contenga el id_discord_hilo (y no solo el id primario),
// la tabla 'tareas' debe tener REPLICA IDENTITY FULL. Ejecuta en Supabase SQL:
//
//   ALTER TABLE tareas REPLICA IDENTITY FULL;
//
// Sin esto, payload.old solo contiene el campo 'id' y no se puede encontrar el hilo.
// ──────────────────────────────────────────────────────────────────────────────
async function handleTareaDelete(client, payload) {
    const tareaEliminada = payload.old;
    const threadId       = tareaEliminada?.id_discord_hilo;

    if (!threadId) {
        console.log(
            `[SupabaseListener] DELETE: tarea ID=${tareaEliminada?.id} no tenía hilo Discord ` +
            '(o REPLICA IDENTITY FULL no está activo en la tabla tareas).'
        );
        return;
    }

    const thread = await fetchThread(client, threadId, `DELETE tarea ID=${tareaEliminada?.id}`);
    if (!thread) return;

    await asegurarDesarchivado(thread);
    await thread.send('🚫 Esta tarea fue eliminada desde el panel de control web.');
    await thread.setLocked(true);
    await thread.setArchived(true);

    console.log(`[SupabaseListener] Hilo "${thread.name}" bloqueado y archivado por DELETE en BD.`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Suscripción Realtime — escucha todos los eventos ('*') de la tabla 'tareas'
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Inicia la escucha de cambios en tiempo real de la tabla 'tareas'.
 * Debe llamarse UNA SOLA VEZ, cuando el bot esté listo (evento ClientReady).
 * @param {import('discord.js').Client} client
 * @returns {import('@supabase/supabase-js').RealtimeChannel}
 */
function startSupabaseListener(client) {
    const channel = supabase
        .channel('db-tareas-crud')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tareas' },
            async (payload) => {
                const tipo = payload.eventType;
                console.log(
                    `[SupabaseListener] Evento ${tipo} recibido → tarea ID=${
                        (payload.new ?? payload.old)?.id
                    }`
                );

                try {
                    if (tipo === 'INSERT') {
                        await handleTareaInsert(client, payload);
                    } else if (tipo === 'UPDATE') {
                        await handleTareaUpdate(client, payload);
                    } else if (tipo === 'DELETE') {
                        await handleTareaDelete(client, payload);
                    }
                } catch (err) {
                    console.error(`[SupabaseListener] Error no controlado en evento ${tipo}:`, err);
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('[SupabaseListener] ✅ Escuchando INSERT/UPDATE/DELETE en tabla "tareas".');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('[SupabaseListener] ❌ Error en canal Realtime:', err?.message ?? err);
            } else if (status === 'TIMED_OUT') {
                console.warn('[SupabaseListener] ⚠️  Tiempo de espera agotado. Supabase intentará reconectar.');
            } else if (status === 'CLOSED') {
                console.warn('[SupabaseListener] ⚠️  Canal Realtime cerrado.');
            }
        });

    return channel;
}

module.exports = { startSupabaseListener };
