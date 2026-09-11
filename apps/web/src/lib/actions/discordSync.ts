'use server'

import { isFounder } from '@/lib/auth'
import { getMiembroActual } from './shared'
import { registrarAuditoria } from './auditoria'

// Dispara la sincronización completa de los catálogos `roles`/`pilares` con
// el bot de Discord. La web no llama a la API de Discord directamente: solo
// notifica al bot, que lee Supabase y crea/enlaza los roles del servidor
// (escribiendo `discord_role_id` de vuelta vía Realtime).
export async function sincronizarCatalogosDiscord(): Promise<{ success?: true; error?: string }> {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para sincronizar con Discord.' }

  const botUrl = process.env.DISCORD_BOT_URL
  const syncToken = process.env.DISCORD_SYNC_TOKEN

  if (!botUrl || !syncToken) {
    return { error: 'La sincronización con Discord no está configurada en el servidor.' }
  }

  let res: Response
  try {
    res = await fetch(`${botUrl}/api/sync-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Token': syncToken,
      },
    })
  } catch {
    return { error: 'No se pudo contactar al bot de Discord.' }
  }

  if (!res.ok) {
    return { error: `El bot respondió con un error (HTTP ${res.status}).` }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'SYNC_DISCORD',
    entidad:     'catalogo',
    detalles:    { origen: 'panel_configuracion' },
  })

  return { success: true }
}

// ─── Cerrar el hilo de una tarea eliminada ──────────────────────────────
//
// Por qué la web se lo pide al bot en vez de que el bot lo deduzca solo:
// Supabase Realtime RECORTA el registro anterior de los eventos DELETE cuando
// la tabla tiene RLS activo. Manda la clave primaria y nada más, porque no
// puede evaluar la política sobre una fila que ya no existe — y da igual lo
// que diga `relreplident`: con la identidad en `full`, los UPDATE llegan
// completos y los DELETE siguen llegando pelados. Medido en producción el
// 2026-09-11.
//
// Sin esto el hilo se quedaba abierto en Discord, dando a entender que la
// tarea seguía viva. Y fallaba en silencio, que es lo peor de todo.
//
// Es "mejor esfuerzo" a propósito: la tarea ya está borrada cuando se llama, y
// que el bot esté dormido en Render no puede deshacer un borrado. Devuelve un
// aviso para poder contarlo, no un error.
export async function cerrarHiloDeTarea(
  idDiscordHilo: string
): Promise<{ ok: true } | { ok: false; aviso: string }> {
  const botUrl = process.env.DISCORD_BOT_URL
  const syncToken = process.env.DISCORD_SYNC_TOKEN

  if (!botUrl || !syncToken) {
    return { ok: false, aviso: 'El enlace con el bot no está configurado en el servidor.' }
  }

  try {
    const res = await fetch(`${botUrl}/api/tarea-cerrada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sync-Token': syncToken },
      body: JSON.stringify({ id_discord_hilo: idDiscordHilo }),
      // Render duerme los servicios gratuitos: despertar tarda. Sin tope, el
      // borrado se quedaría colgado esperando a un bot dormido.
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, aviso: `El bot respondió HTTP ${res.status}.` }
    return { ok: true }
  } catch {
    return { ok: false, aviso: 'No se pudo contactar al bot de Discord.' }
  }
}

// ─── Código de recuperación por mensaje directo ─────────────────────────
//
// El endpoint del bot es estrecho a propósito: recibe un id y un código, y el
// bot compone el mensaje. No acepta texto libre, para que un fallo en la web
// no se convierta en un canal para escribir a cualquiera en nombre de LEAD.
export async function enviarCodigoRecuperacion(
  discordId: string,
  codigo: string,
  nombre: string,
  minutos: number
): Promise<{ ok: boolean; aviso?: string }> {
  const botUrl = process.env.DISCORD_BOT_URL
  const syncToken = process.env.DISCORD_SYNC_TOKEN

  if (!botUrl || !syncToken) {
    return { ok: false, aviso: 'El enlace con el bot no está configurado en el servidor.' }
  }

  try {
    const res = await fetch(`${botUrl}/api/codigo-recuperacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sync-Token': syncToken },
      body: JSON.stringify({ discord_id: discordId, codigo, nombre, minutos }),
      // Render duerme los servicios gratuitos; despertar tarda.
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return { ok: false, aviso: `El bot respondió HTTP ${res.status}.` }
    return { ok: true }
  } catch {
    return { ok: false, aviso: 'No se pudo contactar al bot de Discord.' }
  }
}
