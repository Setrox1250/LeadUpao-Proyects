const { ChannelType, ChannelFlags } = require('discord.js');
const supabase = require('../database');
const { foroDeTarea, invalidar: invalidarForos } = require('./foros');
const { formatearFecha } = require('./fechas');

// ──────────────────────────────────────────────────────────────────────────────
// Configuración de etiquetas
//
// ESTADO_TAG: etiquetas que representan el estado de una tarea en el foro.
// Sus nombres deben coincidir EXACTAMENTE con los del panel de Discord.
// ──────────────────────────────────────────────────────────────────────────────
const ESTADO_TAG = {
    BACKLOG:     'Backlog',
    EN_PROGRESO: 'En Progreso',
    COMPLETADO:  'Completado',
};

/**
 * Qué hay que contarle a Discord sobre un UPDATE de `tareas`.
 *
 * Pura y exportada para poder probarla: es donde vive el riesgo de rebote, y
 * un bucle entre el foro y la base no es algo que se quiera descubrir en vivo.
 *
 * @param payload            evento de Realtime, con `old` y `new`
 * @param etiquetasDelHilo   nombres de las etiquetas que el hilo tiene puestas
 */
function decidirAccion(payload, etiquetasDelHilo = []) {
    const antes   = payload.old;
    const despues = payload.new;

    // `old.estado` es undefined si no hay REPLICA IDENTITY FULL. En ese caso
    // se deja pasar: mejor un mensaje de más que perder una sincronización.
    const cambioEstado = antes?.estado === undefined || antes.estado !== despues.estado;
    const cambioFecha  = antes?.fecha_vencimiento !== undefined
        && (antes.fecha_vencimiento ?? null) !== (despues.fecha_vencimiento ?? null);

    if (!cambioEstado && !cambioFecha) {
        return { actuar: false, avisarFecha: false, reenviarEstado: false };
    }

    // Si el hilo YA lleva la etiqueta del estado nuevo, el cambio vino de allí:
    // alguien movió la etiqueta en Discord y threadUpdate lo escribió en la
    // base. Anunciarlo "desde el panel web" sería mentir, y volver a aplicar la
    // etiqueta dispararía otro threadUpdate.
    //
    // Se mira el estado del mundo y no una marca en memoria, así que sigue
    // funcionando si el bot se reinicia entre un paso y el otro.
    const yaEtiquetado = etiquetasDelHilo.some(nombre => estadoDeTag(nombre) === despues.estado);

    return {
        actuar:         true,
        avisarFecha:    cambioFecha,
        reenviarEstado: cambioEstado && Boolean(ESTADO_TAG[despues.estado]) && !yaEtiquetado,
        yaEtiquetado:   cambioEstado && yaEtiquetado,
    };
}

/** Estado que representa una etiqueta del foro, o null si no es de estado. */
function estadoDeTag(nombreTag) {
    const buscado = nombreTag.toLowerCase();
    return Object.keys(ESTADO_TAG).find(
        estado => ESTADO_TAG[estado].toLowerCase() === buscado,
    ) ?? null;
}

// Mensaje y archivado por estado. BACKLOG no archiva: es trabajo pendiente.
const ESTADO_EFECTO = {
    BACKLOG: {
        mensaje: '↩️ Esta tarea ha vuelto al backlog desde el panel web.',
        archivar: false,
    },
    EN_PROGRESO: {
        mensaje: "🔄 El estado de esta tarea ha sido cambiado a 'En Progreso' desde el panel web.",
        archivar: false,
    },
    COMPLETADO: {
        mensaje: "✅ Esta tarea ha sido marcada como 'Completada' desde el panel web. Sincronización finalizada.",
        archivar: true,
    },
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

    const { id, titulo, descripcion, etiquetas, pilar } = tarea;

    // Cada área tiene su foro de backlog; las tareas sin área van al general.
    const forumChannelId = await foroDeTarea(pilar);

    if (!forumChannelId) {
        console.error(
            `[SupabaseListener] La tarea ID=${id} no tiene foro destino: ` +
            `el área "${pilar ?? '(ninguna)'}" no tiene discord_forum_id y ` +
            'GENERAL_FORUM_CHANNEL_ID no está configurado.');
        return;
    }

    // Obtener el canal foro
    let forumChannel;
    try {
        forumChannel = await client.channels.fetch(forumChannelId);
    } catch (err) {
        console.error(`[SupabaseListener] No se pudo obtener el foro ${forumChannelId} del área "${pilar ?? 'general'}": ${err.message}`);
        return;
    }

    if (forumChannel?.type !== ChannelType.GuildForum) {
        console.warn(`[SupabaseListener] El canal ${forumChannelId} del área "${pilar ?? 'general'}" no es un ForumChannel.`);
        return;
    }

    // La etiqueta del estado va primero: hay foros configurados con etiqueta
    // obligatoria, donde crear un hilo sin ninguna falla con el error 40067.
    const tagEstado = findTag(forumChannel, ESTADO_TAG[tarea.estado] ?? ESTADO_TAG.BACKLOG);
    const tagIds = [
        ...(tagEstado ? [tagEstado.id] : []),
        ...resolveTagIds(forumChannel, etiquetas),
    ].filter((id, i, todas) => todas.indexOf(id) === i).slice(0, 5);

    if (!tagIds.length && forumChannel.flags?.has(ChannelFlags.RequireTag)) {
        console.error(
            `[SupabaseListener] El foro "${forumChannel.name}" exige etiqueta y no hay ninguna ` +
            'aplicable. Ejecuta scripts/bootstrap-discord-areas.mjs --apply para crear las de estado.'
        );
        return;
    }

    // Crear el hilo en el foro
    let thread;
    try {
        // La fecha va en el mensaje inicial y no en el nombre del hilo: el
        // nombre es el título de la tarea y viaja en las dos direcciones, así
        // que un sufijo acabaría dentro del título en la base. Y en texto
        // plano, no con <t:unix:D>, que Discord traduce a la zona de cada
        // quien y desplazaría el día justo como se quería evitar.
        const cuerpo = [
            descripcion || 'Tarea creada desde el panel web de LEAD UPAO.',
            tarea.fecha_vencimiento
                ? `\n📅 **Entrega:** ${formatearFecha(tarea.fecha_vencimiento)}`
                : null,
        ].filter(Boolean).join('\n');

        thread = await forumChannel.threads.create({
            name:         titulo || 'Nueva Tarea',
            message:      { content: cuerpo },
            appliedTags:  tagIds,
        });
    } catch (err) {
        console.error(`[SupabaseListener] Error al crear hilo en Discord para tarea ID=${id}: ${err.message}`);
        return;
    }

    // Guardar el id del hilo recién creado en Supabase.
    // Este UPDATE dispara otro evento Realtime; handleTareaUpdate lo descarta
    // porque el estado no cambió (ver la guarda de ese handler).
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
//
// Ojo: este handler recibe CUALQUIER update de la fila, no solo los de estado.
// ──────────────────────────────────────────────────────────────────────────────
async function handleTareaUpdate(client, payload) {
    const tarea    = payload.new;
    const threadId = tarea.id_discord_hilo;
    const estado   = tarea.estado;

    // Solo actuar cuando el estado CAMBIA de verdad.
    //
    // Sin esta guarda, cualquier escritura sobre la fila se interpretaba como
    // un cambio de estado y publicaba su mensaje en el hilo. Dos casos reales:
    //
    //   · handleTareaInsert escribe `id_discord_hilo` justo después de crear
    //     el hilo. Ese UPDATE volvía aquí con estado 'BACKLOG' y publicaba
    //     "↩️ Esta tarea ha vuelto al backlog desde el panel web" en un hilo
    //     recién nacido. El comentario de handleTareaInsert afirmaba que el
    //     handler lo ignoraba; no era cierto, porque ESTADO_TAG.BACKLOG existe.
    //
    //   · editar la fecha de entrega desde el panel anunciaría un cambio de
    //     estado que nunca ocurrió, y volvería a archivar una tarea completada.
    //
    // `payload.old` trae la fila anterior completa gracias a REPLICA IDENTITY
    // FULL (migración 0008). Si algún día dejara de estarlo, `old.estado` sería
    // undefined y el evento pasaría igual: ante la duda, mejor un mensaje de
    // más que perder una sincronización real.
    // Decisión preliminar sin mirar el hilo: descarta la mayoría de eventos
    // sin gastar una llamada a la API de Discord.
    if (!decidirAccion(payload).actuar) {
        console.log(
            `[SupabaseListener] UPDATE en tarea ID=${tarea.id} sin cambio de estado ` +
            `ni de fecha (sigue en ${estado}): sin acción en Discord.`
        );
        return;
    }

    // Sin hilo asociado: tarea creada manualmente en la BD o aún sin sincronizar
    if (!threadId) {
        console.warn(
            `[SupabaseListener] UPDATE ignorado en tarea ID=${tarea.id}: no tiene id_discord_hilo.`
        );
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

    // Ahora sí, con las etiquetas que el hilo lleva puestas.
    const etiquetasDelHilo = thread.appliedTags
        .map(id => forumChannel.availableTags.find(t => t.id === id)?.name)
        .filter(Boolean);

    const accion = decidirAccion(payload, etiquetasDelHilo);

    if (accion.avisarFecha) {
        await thread.send(
            tarea.fecha_vencimiento
                ? `📅 La entrega de esta tarea pasó al **${formatearFecha(tarea.fecha_vencimiento)}**.`
                : '📅 Esta tarea se quedó sin fecha de entrega.'
        );
    }

    if (accion.reenviarEstado) {
        await aplicarEstado(thread, forumChannel, estado);
    } else if (accion.yaEtiquetado) {
        console.log(
            `[SupabaseListener] Tarea ID=${tarea.id} ya está etiquetada como ${estado} ` +
            'en Discord: el cambio vino del foro, no se reenvía.'
        );
    }
}

/**
 * Deja el hilo con exactamente una etiqueta de estado, conservando las demás.
 * Los foros pueden exigir etiqueta obligatoria, así que el estado siempre pone
 * una: es lo que permite que la sincronización funcione en esos foros.
 */
async function aplicarEstado(thread, forumChannel, estado) {
    const efecto = ESTADO_EFECTO[estado];
    if (!efecto) return;

    const tag   = findTag(forumChannel, ESTADO_TAG[estado]);
    const otras = sinEtiquetasDeEstado(thread, forumChannel);

    if (!tag) {
        console.warn(
            `[SupabaseListener] El foro "${forumChannel.name}" no tiene la etiqueta ` +
            `"${ESTADO_TAG[estado]}". Ejecuta scripts/bootstrap-discord-areas.mjs --apply.`
        );
    }

    await thread.setAppliedTags(tag ? [...otras, tag.id].slice(0, 5) : otras);
    await thread.send(efecto.mensaje);
    if (efecto.archivar) await thread.setArchived(true);

    console.log(`[SupabaseListener] Hilo "${thread.name}" → ${estado}${efecto.archivar ? ' y archivado' : ''}.`);
}

/**
 * Cierra el hilo de una tarea borrada: avisa, bloquea y archiva.
 *
 * Se invoca desde el endpoint `/api/tarea-cerrada`, no desde Realtime. El
 * motivo está medido, no supuesto:
 *
 *   Supabase Realtime RECORTA el registro anterior de los eventos DELETE
 *   cuando la tabla tiene RLS activo. Manda solo la clave primaria, porque no
 *   puede evaluar la política sobre una fila que ya no existe. Da igual lo que
 *   diga `relreplident`: con la identidad en `full`, los UPDATE llegan
 *   completos y los DELETE siguen llegando pelados.
 *
 *   Verificado en producción el 2026-09-11. El log lo enseña en dos líneas
 *   consecutivas: `payload.old.id` vale 15 y `payload.old.id_discord_hilo` es
 *   undefined, en el mismo evento.
 *
 * No hay migración que lo arregle. Las salidas eran desactivar RLS en `tareas`
 * —volver al incidente P0— o dejar de depender del evento. Esto es lo segundo:
 * la Server Action tiene el `id_discord_hilo` en la mano antes de borrar, así
 * que lo dice ella.
 */
async function cerrarHiloDeTareaEliminada(client, threadId, contexto = 'tarea eliminada') {
    const thread = await fetchThread(client, threadId, contexto);
    if (!thread) return { ok: false, motivo: 'hilo no encontrado' };

    // Si ya está bloqueado, esto ya se hizo: el aviso puede reintentarse y no
    // queremos dos mensajes ni dos archivados.
    if (thread.locked) {
        console.log(`[SupabaseListener] El hilo "${thread.name}" ya estaba cerrado.`);
        return { ok: true, motivo: 'ya estaba cerrado' };
    }

    await asegurarDesarchivado(thread);
    await thread.send('🚫 Esta tarea fue eliminada desde el panel de control web.');
    await thread.setLocked(true);
    await thread.setArchived(true);

    console.log(`[SupabaseListener] Hilo "${thread.name}" bloqueado y archivado (${contexto}).`);
    return { ok: true };
}

async function handleTareaDelete(client, payload) {
    // Aquí ya no se cierra nada: ver cerrarHiloDeTareaEliminada(). Este handler
    // se queda solo para dejar constancia en el log, porque el evento sí llega
    // y su ausencia sería más confusa que su presencia.
    console.log(
        `[SupabaseListener] DELETE de tarea ID=${payload.old?.id}. ` +
        'El cierre del hilo lo pide la web por /api/tarea-cerrada; Realtime no ' +
        'trae el id del hilo en los DELETE de tablas con RLS.'
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Suscripción Realtime — escucha todos los eventos ('*') de la tabla 'tareas'
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// Handlers: Sincronización de Roles y Pilares
// ──────────────────────────────────────────────────────────────────────────────

async function handleRolePilarInsert(client, payload, table) {
    const record = payload.new;
    const guildId = process.env.GUILD_ID;
    if (!guildId) return console.error('[SupabaseListener] GUILD_ID no definido en .env');

    try {
        const guild = await client.guilds.fetch(guildId);
        // Crear rol en Discord
        const newRole = await guild.roles.create({
            name: record.nombre,
            reason: `Sincronización automática desde Supabase tabla ${table}`
        });

        // Guardar el discord_role_id en Supabase
        const { error } = await supabase
            .from(table)
            .update({ discord_role_id: newRole.id })
            .eq('nombre', record.nombre); // La clave primaria es 'nombre'

        if (error) {
            console.error(`[SupabaseListener] Error al actualizar discord_role_id en ${table}:`, error.message);
        } else {
            console.log(`[SupabaseListener] Rol creado en Discord y sincronizado en ${table}: ${record.nombre}`);
        }
    } catch (err) {
        console.error(`[SupabaseListener] Error al crear rol para ${table} (${record.nombre}):`, err);
    }
}

async function handleRolePilarUpdate(client, payload, table) {
    const newRecord = payload.new;
    const oldRecord = payload.old;
    
    // Solo actuar si el nombre cambió y tenemos un discord_role_id
    if (newRecord.nombre === oldRecord.nombre || !newRecord.discord_role_id) return;

    const guildId = process.env.GUILD_ID;
    if (!guildId) return;

    try {
        const guild = await client.guilds.fetch(guildId);
        const role = await guild.roles.fetch(newRecord.discord_role_id);
        
        if (role) {
            await role.edit({
                name: newRecord.nombre,
                reason: `Nombre actualizado desde Supabase tabla ${table}`
            });
            console.log(`[SupabaseListener] Rol editado en Discord: ${oldRecord.nombre} -> ${newRecord.nombre}`);
        } else {
            console.warn(`[SupabaseListener] Rol con ID ${newRecord.discord_role_id} no encontrado en Discord para editar.`);
        }
    } catch (err) {
        console.error(`[SupabaseListener] Error al editar rol para ${table} (${newRecord.nombre}):`, err);
    }
}

async function handleRolePilarDelete(client, payload, table) {
    // Eliminar un ÁREA no borra nada en Discord: archiva su foro y le retira
    // el acceso. Es la regla de docs/discord-tareas.md, que el código nunca
    // llegó a cumplir.
    //
    // Importa porque un foro de área acumula meses de hilos y Discord no tiene
    // papelera. Y borrar el rol es peor de lo que parece: no se "recrea en dos
    // clics", hay que volver a repartirlo entre todos los miembros del área,
    // que es el trabajo que nadie apunta en ningún sitio.
    //
    // Para un CARGO sí se borra el rol: no cuelga de él ningún canal con
    // historia, y el panel puede recrearlo.
    if (table === 'pilares') return archivarAreaEliminada(client, payload.old);

    const oldRecord = payload.old;
    if (!oldRecord.discord_role_id) return;

    const guildId = process.env.GUILD_ID;
    if (!guildId) return;

    try {
        const guild = await client.guilds.fetch(guildId);
        const role = await guild.roles.fetch(oldRecord.discord_role_id);

        if (role) {
            await role.delete(`Eliminado desde Supabase tabla ${table}`);
            console.log(`[SupabaseListener] Rol eliminado en Discord: ID ${oldRecord.discord_role_id}`);
        } else {
            console.warn(`[SupabaseListener] Rol con ID ${oldRecord.discord_role_id} no encontrado en Discord para eliminar.`);
        }
    } catch (err) {
        console.error(`[SupabaseListener] Error al eliminar rol para ${table} (ID ${oldRecord.discord_role_id}):`, err);
    }
}

/**
 * Retira un área de Discord sin destruir nada.
 *
 * Retirar = quitarle al rol del área su permiso de ver la categoría. Eso
 * esconde de golpe el foro de tareas y cualquier otro canal del área, y se
 * revierte volviendo a conceder el permiso.
 *
 * No se "archiva el foro" como decía docs/discord-tareas.md porque en Discord
 * eso no existe: se archivan los hilos, no los canales de foro. La retirada
 * efectiva es por permisos, y así queda escrito en el documento.
 *
 * NO se borra el rol, NI la categoría, NI el foro. Lo que queda huérfano se
 * lista en el log, igual que hace scripts/bootstrap-discord-areas.mjs: el
 * borrado definitivo es una decisión humana que se toma dentro de Discord,
 * mirando lo que hay en los hilos.
 */
async function archivarAreaEliminada(client, area) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) return console.error('[SupabaseListener] GUILD_ID no definido en .env');

    // El mapa área → foro está cacheado y acaba de quedar obsoleto.
    invalidarForos();

    const nombre = area?.nombre ?? '(sin nombre)';
    const pendientes = [];

    if (area?.discord_forum_id) {
        try {
            const foro = await client.channels.fetch(area.discord_forum_id);
            if (foro) pendientes.push(`foro #${foro.name} (${foro.id}), con todos sus hilos`);
        } catch (err) {
            console.warn(`[SupabaseListener] No se pudo leer el foro de "${nombre}": ${err.message}`);
        }
    }

    // Retirar el acceso del rol del área a su categoría.
    if (area?.discord_category_id && area?.discord_role_id) {
        try {
            const categoria = await client.channels.fetch(area.discord_category_id);
            await categoria.permissionOverwrites.delete(
                area.discord_role_id,
                `Área "${nombre}" eliminada desde el panel web`,
            );
            console.log(`[SupabaseListener] Retirado el acceso del rol del área "${nombre}" a su categoría.`);
            pendientes.push(`categoría ${categoria.name} (${categoria.id})`);
        } catch (err) {
            console.warn(`[SupabaseListener] No se pudieron retirar los permisos de "${nombre}": ${err.message}`);
        }
    }

    if (area?.discord_role_id) {
        pendientes.push(`rol ${area.discord_role_id}`);
    }

    if (pendientes.length) {
        console.warn(
            `[SupabaseListener] Área "${nombre}" eliminada de la base. En Discord NO se ha borrado nada.\n` +
            pendientes.map(p => `    · ${p}`).join('\n') + '\n' +
            '    Bórralos a mano si procede, después de revisar lo que contienen.'
        );
    }
}

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
                // En un DELETE, supabase-js pone `new` a {} (no a null), así
                // que `new ?? old` nunca cae al lado bueno y el log decía
                // siempre "ID=undefined".
                const fila = payload.new?.id != null ? payload.new : payload.old;
                console.log(`[SupabaseListener] Evento ${tipo} recibido → tarea ID=${fila?.id}`);

                try {
                    if (tipo === 'INSERT') await handleTareaInsert(client, payload);
                    else if (tipo === 'UPDATE') await handleTareaUpdate(client, payload);
                    else if (tipo === 'DELETE') await handleTareaDelete(client, payload);
                } catch (err) {
                    console.error(`[SupabaseListener] Error no controlado en evento ${tipo}:`, err);
                }
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'roles' },
            async (payload) => {
                const tipo = payload.eventType;
                try {
                    if (tipo === 'INSERT') await handleRolePilarInsert(client, payload, 'roles');
                    else if (tipo === 'UPDATE') await handleRolePilarUpdate(client, payload, 'roles');
                    else if (tipo === 'DELETE') await handleRolePilarDelete(client, payload, 'roles');
                } catch (err) {
                    console.error(`[SupabaseListener] Error en evento ${tipo} de roles:`, err);
                }
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'pilares' },
            async (payload) => {
                const tipo = payload.eventType;
                try {
                    // El mapa área → foro se cachea; cualquier cambio en el
                    // catálogo lo deja obsoleto.
                    invalidarForos();

                    if (tipo === 'INSERT') await handleRolePilarInsert(client, payload, 'pilares');
                    else if (tipo === 'UPDATE') await handleRolePilarUpdate(client, payload, 'pilares');
                    else if (tipo === 'DELETE') await handleRolePilarDelete(client, payload, 'pilares');
                } catch (err) {
                    console.error(`[SupabaseListener] Error en evento ${tipo} de pilares:`, err);
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

module.exports = { startSupabaseListener, ESTADO_TAG, estadoDeTag, decidirAccion, cerrarHiloDeTareaEliminada };
