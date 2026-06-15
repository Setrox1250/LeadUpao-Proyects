'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth'
import { getMiembroActual } from './shared'
import type { LogAuditoria } from '@/types'

type RegistrarAuditoriaInput = {
  actorId:     string
  actorNombre: string
  accion:      string
  entidad:     string
  entidadId?:  string | null
  detalles?:   Record<string, unknown>
}

// Inserta una entrada en el historial de auditoría. No lanza errores hacia
// el llamador: una falla al registrar el log no debe revertir ni bloquear
// la acción principal que ya se ejecutó correctamente.
export async function registrarAuditoria(input: RegistrarAuditoriaInput) {
  const admin = createAdminClient()

  const { error } = await admin.from('logs_auditoria').insert({
    actor_id:     input.actorId,
    actor_nombre: input.actorNombre,
    accion:       input.accion,
    entidad:      input.entidad,
    entidad_id:   input.entidadId ?? null,
    detalles:     input.detalles ?? {},
  })

  if (error) {
    console.error('[registrarAuditoria] No se pudo registrar el log:', error)
  }
}

// Historial de auditoría — solo para administradores.
export async function obtenerLogsAuditoria(): Promise<{ data?: LogAuditoria[]; error?: string }> {
  const perfil = await getMiembroActual()
  if (!isAdmin(perfil)) return { error: 'No tienes permisos de administrador.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('logs_auditoria')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(200)

  if (error) return { error: 'No se pudo cargar el historial de auditoría.' }

  return { data: (data ?? []) as LogAuditoria[] }
}
