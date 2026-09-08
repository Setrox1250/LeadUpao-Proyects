'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFounder } from '@/lib/auth'
import { getMiembroActual } from './shared'
import { registrarAuditoria } from './auditoria'
import type { Rol } from '@/types'

// Catálogo de roles (cargos) — lectura disponible para cualquier usuario
// autenticado (RLS lo permite); se usa en los selects de Miembros, Tareas y
// el panel de Configuración.
export async function obtenerRoles(): Promise<{ data?: Rol[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('orden', { ascending: true })

  if (error) return { error: 'No se pudo cargar el catálogo de roles.' }
  return { data: data as Rol[] }
}

// ─── Crear rol (solo President / Vice-President) ──────────────────────────
export async function crearRol(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar roles.' }

  const nombre         = (formData.get('nombre') as string ?? '').trim()
  const nivel_permiso  = formData.get('nivel_permiso') as string
  const requiere_pilar = formData.get('requiere_pilar') === 'on'
  const orden          = Number(formData.get('orden') ?? 0)

  if (!nombre) return { error: 'El nombre del rol es obligatorio.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('roles')
    .insert({ nombre, nivel_permiso, requiere_pilar, orden })
    .select('*')
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'Ya existe un rol con ese nombre.' : 'No se pudo crear el rol.' }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'CREAR_ROL',
    entidad:     'rol',
    entidadId:   data.id,
    detalles:    { nombre, nivel_permiso, requiere_pilar },
  })

  revalidatePath('/admin')
  return { data: data as Rol }
}

// ─── Actualizar rol (solo President / Vice-President) ─────────────────────
export async function actualizarRol(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar roles.' }

  const id              = formData.get('id') as string
  const nombre          = (formData.get('nombre') as string ?? '').trim()
  const nivel_permiso   = formData.get('nivel_permiso') as string
  const requiere_pilar  = formData.get('requiere_pilar') === 'on'
  const orden           = Number(formData.get('orden') ?? 0)

  if (!nombre) return { error: 'El nombre del rol es obligatorio.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('roles')
    .update({ nombre, nivel_permiso, requiere_pilar, orden })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'Ya existe un rol con ese nombre.' : 'No se pudo actualizar el rol.' }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ACTUALIZAR_ROL',
    entidad:     'rol',
    entidadId:   id,
    detalles:    { nombre, nivel_permiso, requiere_pilar },
  })

  revalidatePath('/admin')
  return { data: data as Rol }
}

// ─── Eliminar rol (solo President / Vice-President) ───────────────────────
export async function eliminarRol(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isFounder(perfil)) return { error: 'No tienes permisos para gestionar roles.' }

  const id = formData.get('id') as string

  const admin = createAdminClient()
  const { data: rol } = await admin.from('roles').select('nombre').eq('id', id).maybeSingle()
  const { error } = await admin.from('roles').delete().eq('id', id)

  if (error) {
    return {
      error: error.code === '23503'
        ? 'No se puede eliminar: hay miembros con este cargo.'
        : 'No se pudo eliminar el rol.',
    }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ELIMINAR_ROL',
    entidad:     'rol',
    entidadId:   id,
    detalles:    { nombre: rol?.nombre },
  })

  revalidatePath('/admin')
  return { success: true }
}
