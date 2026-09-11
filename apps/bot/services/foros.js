const supabase = require('../database');

/**
 * Resuelve el foro de Discord de cada área y viceversa.
 *
 * Sustituye al antiguo FORUM_CHANNEL_ID único: ahora cada pilar tiene su
 * categoría y su foro `backlog-tareas` (ver docs/discord-tareas.md), y el
 * canal donde se publica un hilo determina el área de la tarea.
 *
 * Las tareas sin área van al foro general, configurado en
 * GENERAL_FORUM_CHANNEL_ID.
 */

// Etiqueta con la que se ofrece "ninguna área" en los comandos. No es un
// nombre de pilar: representa `pilar = NULL`, el backlog general.
const SIN_AREA = 'General (sin área)';

// El mapa cambia solo cuando se da de alta o se renombra un área, así que se
// cachea y se refresca por TTL. `invalidar()` lo fuerza desde el listener.
const TTL_MS = 5 * 60 * 1000;
let cache = null;
let cargadoEn = 0;

async function mapa() {
    if (cache && Date.now() - cargadoEn < TTL_MS) return cache;

    const { data, error } = await supabase
        .from('pilares')
        .select('nombre, discord_forum_id')
        .order('orden');

    if (error) {
        console.error('[Foros] No se pudo leer `pilares`:', error.message);
        return cache ?? { porPilar: new Map(), porForo: new Map(), nombres: [] };
    }

    const porPilar = new Map();
    const porForo  = new Map();
    // Todas las áreas, tengan foro o no: una recién creada aún no lo tiene,
    // y aun así es un destino válido para una tarea (irá al foro general).
    const nombres  = data.map(p => p.nombre);
    for (const { nombre, discord_forum_id: foro } of data) {
        if (!foro) continue;
        porPilar.set(nombre, foro);
        porForo.set(foro, nombre);
    }

    cache = { porPilar, porForo, nombres };
    cargadoEn = Date.now();
    return cache;
}

function foroGeneral() {
    return process.env.GENERAL_FORUM_CHANNEL_ID || null;
}

/**
 * Foro donde debe vivir una tarea. `null` si el área no tiene foro asignado
 * y tampoco hay foro general configurado.
 */
async function foroDeTarea(pilar) {
    if (!pilar) return foroGeneral();
    const { porPilar } = await mapa();
    const foro = porPilar.get(pilar);
    if (foro) return foro;

    console.warn(`[Foros] El área "${pilar}" no tiene discord_forum_id. Se usa el foro general.`);
    return foroGeneral();
}

/**
 * Área a la que pertenece un foro. Devuelve:
 *   { gestionado: false }               → el canal no es de tareas, ignorar
 *   { gestionado: true, pilar: '...' }  → foro de un área
 *   { gestionado: true, pilar: null }   → foro general (tarea sin área)
 */
async function pilarDeForo(canalId) {
    if (!canalId) return { gestionado: false };
    if (canalId === foroGeneral()) return { gestionado: true, pilar: null };

    const { porForo } = await mapa();
    const pilar = porForo.get(canalId);
    return pilar ? { gestionado: true, pilar } : { gestionado: false };
}

/** Nombres de área del catálogo, en el orden del organigrama. */
async function areasDisponibles() {
    const { nombres } = await mapa();
    return nombres ?? [];
}

function invalidar() {
    cache = null;
    cargadoEn = 0;
}

module.exports = { foroDeTarea, pilarDeForo, foroGeneral, areasDisponibles, invalidar, SIN_AREA };
