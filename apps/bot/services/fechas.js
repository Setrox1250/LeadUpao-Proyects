/**
 * Fechas de entrega en el bot.
 *
 * Gemelo en CommonJS de `apps/web/src/lib/fechas.ts`, que es la fuente de
 * verdad: el mismo razonamiento, el mismo rango de años y el mismo formato.
 * Se duplica porque el bot es CommonJS y la web es TypeScript/ESM; el sitio
 * donde esto dejará de estar repetido es `packages/contracts` cuando exista.
 *
 * REGLA: `tareas.fecha_vencimiento` es un `date` y viaja como 'YYYY-MM-DD'.
 * Nunca `new Date(valor)` con esa cadena: se interpreta como medianoche UTC y
 * en America/Lima (UTC-5) pasa a ser el día anterior.
 */

const ZONA_LEAD = 'America/Lima';
const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Un año de cuatro dígitos no basta: '0002-09-25' cumple el formato y es un
// día real del calendario.
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

function esFechaValida(fecha) {
    if (typeof fecha !== 'string' || !FORMATO_ISO.test(fecha)) return false;
    const [anio, mes, dia] = fecha.split('-').map(Number);
    if (anio < ANIO_MIN || anio > ANIO_MAX) return false;
    const d = new Date(Date.UTC(anio, mes - 1, dia));
    return d.getUTCFullYear() === anio
        && d.getUTCMonth() === mes - 1
        && d.getUTCDate() === dia;
}

/** Hoy en el calendario de Lima, comparable con lo que guarda Postgres. */
function hoyEnLima() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA_LEAD, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '25 sep 2026'. Con el año siempre: en Discord el mensaje se lee meses después. */
function formatearFecha(fecha) {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return `${dia} ${MESES[mes - 1]} ${anio}`;
}

module.exports = { esFechaValida, hoyEnLima, formatearFecha, ZONA_LEAD };
