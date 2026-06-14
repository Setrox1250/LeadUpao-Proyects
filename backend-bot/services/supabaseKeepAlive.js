const supabase = require('../database');

/**
 * Realiza una consulta rápida e inofensiva a la base de datos de Supabase
 * para mantener la base de datos activa y prevenir que se auto-suspenda.
 */
async function pingSupabase() {
    const timestamp = new Date().toISOString();
    try {
        console.log(`[KeepAlive] [${timestamp}] Realizando ping a Supabase para evitar suspensión...`);
        
        // Hacemos una consulta ligera seleccionando un solo id de la tabla 'tareas'
        const { error } = await supabase
            .from('tareas')
            .select('id')
            .limit(1);

        if (error) {
            console.error(`[KeepAlive] [${timestamp}] Error al hacer ping a Supabase:`, error.message);
        } else {
            console.log(`[KeepAlive] [${timestamp}] Ping a Supabase exitoso. Servidor activo.`);
        }
    } catch (err) {
        console.error(`[KeepAlive] [${timestamp}] Error inesperado en el ping a Supabase:`, err);
    }
}

/**
 * Inicia el temporizador para los pings periódicos a Supabase.
 */
function startSupabaseKeepAlive() {
    // Frecuencia en horas (por defecto 24 horas)
    const intervalHours = parseFloat(process.env.SUPABASE_PING_INTERVAL_HOURS || '24');
    
    if (isNaN(intervalHours) || intervalHours <= 0) {
        console.error('[KeepAlive] Frecuencia de ping no válida. Se usará el valor por defecto de 24 horas.');
        startInterval(24);
    } else {
        console.log(`[KeepAlive] Servicio iniciado. Frecuencia de ping: cada ${intervalHours} hora(s).`);
        startInterval(intervalHours);
    }
}

function startInterval(hours) {
    const intervalMs = hours * 60 * 60 * 1000;
    
    // Ejecutar ping inicial inmediatamente para comprobar conexión
    pingSupabase();
    
    // Programar pings periódicos
    setInterval(pingSupabase, intervalMs);
}

module.exports = { startSupabaseKeepAlive };
