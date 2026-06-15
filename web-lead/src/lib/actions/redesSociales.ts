'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFounder } from '@/lib/auth'
import { getMiembroActual } from './shared'
import { registrarAuditoria } from './auditoria'
import type { RedSocial } from '@/types'

// Catálogo de redes sociales / enlaces de invitación — lectura pública
// (RLS lo permite también para 'anon'), usado en el panel de Configuración
// y en la página de registro para mostrar el enlace de Discord.
export async function obtenerRedesSociales(): Promise<{ data?: RedSocial[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('redes_sociales')
    .select('*')
    .order('orden', { ascending: true })

  if (error) return { error: 'No se pudo cargar el catálogo de redes sociales.' }
  return { data: data as RedSocial[] }
}

// ─── Crear red social (solo President / Vice-President) ───────────────────
export async function crearRedSocial(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar redes sociales.' }

  const plataforma = (formData.get('plataforma') as string ?? '').trim()
  const url        = (formData.get('url') as string ?? '').trim()
  const orden      = Number(formData.get('orden') ?? 0)

  if (!plataforma) return { error: 'El nombre de la plataforma es obligatorio.' }
  if (!/^https?:\/\//i.test(url)) return { error: 'El enlace debe ser una URL válida (http:// o https://).' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('redes_sociales')
    .insert({ plataforma, url, orden })
    .select('*')
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'Ya existe una red social con ese nombre.' : 'No se pudo crear la red social.' }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'CREAR_RED_SOCIAL',
    entidad:     'red_social',
    entidadId:   data.id,
    detalles:    { plataforma, url },
  })

  revalidatePath('/admin')
  revalidatePath('/registro')
  return { data: data as RedSocial }
}

// ─── Actualizar red social (solo President / Vice-President) ──────────────
export async function actualizarRedSocial(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar redes sociales.' }

  const id          = formData.get('id') as string
  const plataforma  = (formData.get('plataforma') as string ?? '').trim()
  const url         = (formData.get('url') as string ?? '').trim()
  const orden       = Number(formData.get('orden') ?? 0)

  if (!plataforma) return { error: 'El nombre de la plataforma es obligatorio.' }
  if (!/^https?:\/\//i.test(url)) return { error: 'El enlace debe ser una URL válida (http:// o https://).' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('redes_sociales')
    .update({ plataforma, url, orden })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'Ya existe una red social con ese nombre.' : 'No se pudo actualizar la red social.' }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ACTUALIZAR_RED_SOCIAL',
    entidad:     'red_social',
    entidadId:   id,
    detalles:    { plataforma, url },
  })

  revalidatePath('/admin')
  revalidatePath('/registro')
  return { data: data as RedSocial }
}

// ─── Eliminar red social (solo President / Vice-President) ────────────────
export async function eliminarRedSocial(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar redes sociales.' }

  const id = formData.get('id') as string

  const admin = createAdminClient()
  const { data: red } = await admin.from('redes_sociales').select('plataforma').eq('id', id).maybeSingle()
  const { error } = await admin.from('redes_sociales').delete().eq('id', id)

  if (error) return { error: 'No se pudo eliminar la red social.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ELIMINAR_RED_SOCIAL',
    entidad:     'red_social',
    entidadId:   id,
    detalles:    { plataforma: red?.plataforma },
  })

  revalidatePath('/admin')
  revalidatePath('/registro')
  return { success: true }
}
