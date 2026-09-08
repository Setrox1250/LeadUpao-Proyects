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
