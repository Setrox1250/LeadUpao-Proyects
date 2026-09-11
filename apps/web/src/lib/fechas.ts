// ─── Fechas de calendario, no instantes ───────────────────────────────────
//
// `tareas.fecha_vencimiento` es un `date` de Postgres y viaja como la cadena
// 'YYYY-MM-DD'. Representa un DÍA, no un momento.
//
// REGLA: nunca `new Date('2026-09-10')`. Esa forma se interpreta como
// medianoche UTC, y en America/Lima (UTC-5) el navegador la muestra como el 9.
// Todo lo de aquí trabaja sobre la cadena, o sobre un Date construido con
// `Date.UTC()` y formateado fijando `timeZone: 'UTC'`, que es lo mismo que
// decir «no conviertas nada».

// LEAD UPAO opera en Trujillo. Todo «hoy» del producto es hoy en Lima, no el
// hoy del servidor de Vercel (UTC) ni el de la máquina de quien mira.
export const ZONA_LEAD = 'America/Lima'

// Una tarea entra en «próxima» cuando vence dentro de estos días.
export const DIAS_PROXIMA = 3

export type Urgencia = 'vencida' | 'hoy' | 'proxima' | 'futura'

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Milisegundos de la fecha tratada como medianoche UTC. Solo para restar. */
function comoUTC(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return Date.UTC(anio, mes - 1, dia)
}

// Rango con sentido para una fecha de entrega. Existe porque '0002-09-25'
// cumple el formato y es un día real del calendario juliano proléptico: sin
// este acote, un año tecleado a medias entraba en la base como fecha válida.
const ANIO_MIN = 2000
const ANIO_MAX = 2100

/**
 * Valida que la cadena sea una fecha real y plausible, no solo que tenga la
 * forma. '2026-02-31' pasa el regex y no existe; '0002-09-25' existe y no
 * tiene sentido.
 */
export function esFechaValida(fecha: string): boolean {
  if (!FORMATO_ISO.test(fecha)) return false
  const [anio, mes, dia] = fecha.split('-').map(Number)
  if (anio < ANIO_MIN || anio > ANIO_MAX) return false
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

/**
 * Hoy según el calendario de Lima, en el mismo formato que guarda Postgres.
 * 'en-CA' rinde 'YYYY-MM-DD', así que el resultado se compara con `===` y `<`
 * contra cualquier `fecha_vencimiento` sin convertir nada.
 *
 * Devuelve el mismo valor en el servidor y en el navegador porque la zona va
 * explícita: no hay desajuste de hidratación.
 */
export function hoyEnLima(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_LEAD, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** Días completos de `desde` a `hasta`. Negativo si `hasta` ya pasó. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((comoUTC(hasta) - comoUTC(desde)) / 86_400_000)
}

export function urgenciaDe(fecha: string, hoy: string): Urgencia {
  const dias = diasEntre(hoy, fecha)
  if (dias < 0)             return 'vencida'
  if (dias === 0)           return 'hoy'
  if (dias <= DIAS_PROXIMA) return 'proxima'
  return 'futura'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** '10 sep'; añade el año solo cuando no es el año en curso. */
export function formatearFecha(fecha: string, hoy: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const corto = `${dia} ${MESES[mes - 1]}`
  return anio === Number(hoy.slice(0, 4)) ? corto : `${corto} ${anio}`
}

/** Texto para la tarjeta: relativo cuando importa, fecha seca cuando no. */
export function textoVencimiento(fecha: string, hoy: string): string {
  const dias = diasEntre(hoy, fecha)
  if (dias === 0)  return 'Vence hoy'
  if (dias === 1)  return 'Vence mañana'
  if (dias === -1) return 'Venció ayer'
  if (dias < 0)    return `Venció hace ${-dias} días`
  if (dias <= DIAS_PROXIMA) return `Vence en ${dias} días`
  return formatearFecha(fecha, hoy)
}
