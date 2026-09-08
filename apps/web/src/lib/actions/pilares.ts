'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFounder } from '@/lib/auth'
import { getMiembroActual } from './shared'
import { registrarAuditoria } from './auditoria'
import type { Pilar } from '@/types'

// Catálogo de pilares — lectura disponible para cualquier usuario
// autenticado (RLS lo permite); se usa en los selects de Miembros, Tareas y
// el panel de Configuración.
export async function obtenerPilares(): Promise<{ data?: Pilar[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pilares')
    .select('*')
    .order('orden', { ascending: true })

  if (error) return { error: 'No se pudo cargar el catálogo de pilares.' }
  return { data: data as Pilar[] }
}

// ─── Crear pilar (solo President / Vice-President) ────────────────────────
export async function crearPilar(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar pilares.' }

  const nombre = (formData.get('nombre') as string ?? '').trim()
  const orden  = Number(formData.get('orden') ?? 0)

  if (!nombre) return { error: 'El nombre del pilar es obligatorio.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pilares')
    .insert({ nombre, orden })
    .select('*')
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'Ya existe un pilar con ese nombre.' : 'No se pudo crear el pilar.' }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'CREAR_PILAR',
    entidad:     'pilar',
    entidadId:   data.id,
    detalles:    { nombre },
  })

  revalidatePath('/admin')
  return { data: data as Pilar }
}

// ─── Actualizar pilar (solo President / Vice-President) ───────────────────
export async function actualizarPilar(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar pilares.' }

  const id     = formData.get('id') as string
  const nombre = (formData.get('nombre') as string ?? '').trim()
  const orden  = Number(formData.get('orden') ?? 0)

  if (!nombre) return { error: 'El nombre del pilar es obligatorio.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pilares')
    .update({ nombre, orden })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'Ya existe un pilar con ese nombre.' : 'No se pudo actualizar el pilar.' }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ACTUALIZAR_PILAR',
    entidad:     'pilar',
    entidadId:   id,
    detalles:    { nombre },
  })

  revalidatePath('/admin')
  return { data: data as Pilar }
}

// ─── Eliminar pilar (solo President / Vice-President) ─────────────────────
export async function eliminarPilar(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar pilares.' }

  const id = formData.get('id') as string

  const admin = createAdminClient()
  const { data: pilar } = await admin.from('pilares').select('nombre').eq('id', id).maybeSingle()
  const { error } = await admin.from('pilares').delete().eq('id', id)

  if (error) {
    return {
      error: error.code === '23503'
        ? 'No se puede eliminar: está en uso por miembros o tareas.'
        : 'No se pudo eliminar el pilar.',
    }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ELIMINAR_PILAR',
    entidad:     'pilar',
    entidadId:   id,
    detalles:    { nombre: pilar?.nombre },
  })

  revalidatePath('/admin')
  return { success: true }
}
