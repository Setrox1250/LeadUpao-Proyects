'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin, isStaff } from '@/lib/auth'
import { getMiembroActual } from './shared'
import { registrarAuditoria } from './auditoria'
import type { Tarea, EstadoTarea } from '@/types'

// ─── Crear tarea ────────────────────────────────────────────────────────
// Solo administradores (President/Vice-President) o staff (ej. Leaders)
// pueden crear tareas. El staff solo puede crearlas en su propio pilar: el
// pilar recibido del cliente se ignora para ellos y se reemplaza por su
// pilar real, evitando que manipulen el valor enviado al servidor.
export async function crearTarea(input: {
  titulo:      string
  descripcion: string | null
  pilar:       string
  etiquetas:   string[]
}): Promise<{ data?: Tarea; error?: string }> {
  const perfil = await getMiembroActual()
  const directiva = isAdmin(perfil)
  const staff = isStaff(perfil)

  if (!directiva && !staff) {
    return { error: 'No tienes permisos para crear tareas.' }
  }

  const titulo = input.titulo.trim()
  if (!titulo) {
    return { error: 'El título es obligatorio.' }
  }

  const pilar = directiva ? input.pilar : (perfil.pilar ?? input.pilar)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tareas')
    .insert({
      titulo,
      descripcion: input.descripcion?.trim() || null,
      pilar,
      etiquetas:   input.etiquetas,
      estado:      'BACKLOG',
      // Queda null si quien la crea aún no ha vinculado su Discord.
      autor_id:    perfil.discord_id ?? null,
    })
    .select('*')
    .single()

  if (error) return { error: 'No se pudo crear la tarea.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'CREAR_TAREA',
    entidad:     'tarea',
    entidadId:   data.id,
    detalles:    { titulo: data.titulo, pilar: data.pilar },
  })

  return { data: data as Tarea }
}

// ─── Cambiar estado de una tarea (Kanban) ──────────────────────────────
// Directiva puede mover tareas de cualquier pilar; el resto de miembros
// solo puede mover tareas de su propio pilar.
export async function actualizarEstadoTarea(
  taskId: string,
  nuevoEstado: EstadoTarea
): Promise<{ success?: true; error?: string }> {
  const perfil = await getMiembroActual()
  const admin = createAdminClient()

  const { data: tarea } = await admin.from('tareas').select('pilar').eq('id', taskId).maybeSingle()
  if (!tarea) return { error: 'La tarea no existe.' }

  const directiva = isAdmin(perfil)
  const mismoPilar = perfil.pilar === tarea.pilar

  if (!directiva && !mismoPilar) {
    return { error: 'No tienes permisos para modificar esta tarea.' }
  }

  const { error } = await admin.from('tareas').update({ estado: nuevoEstado }).eq('id', taskId)
  if (error) return { error: 'No se pudo actualizar la tarea.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ACTUALIZAR_ESTADO_TAREA',
    entidad:     'tarea',
    entidadId:   taskId,
    detalles:    { nuevoEstado },
  })

  return { success: true }
}

// ─── Eliminar tarea ─────────────────────────────────────────────────────
// Directiva puede eliminar cualquier tarea; los Leaders solo las de su
// propio pilar (igual que la regla canDelete() que existía en el cliente).
export async function eliminarTarea(taskId: string): Promise<{ success?: true; error?: string }> {
  const perfil = await getMiembroActual()
  const admin = createAdminClient()

  const { data: tarea } = await admin.from('tareas').select('pilar, titulo').eq('id', taskId).maybeSingle()
  if (!tarea) return { error: 'La tarea no existe.' }

  const directiva = isAdmin(perfil)
  const staff = isStaff(perfil)
  const puedeEliminar = directiva || (staff && perfil.pilar === tarea.pilar)

  if (!puedeEliminar) {
    return { error: 'No tienes permisos para eliminar esta tarea.' }
  }

  const { error } = await admin.from('tareas').delete().eq('id', taskId)
  if (error) return { error: 'No se pudo eliminar la tarea.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ELIMINAR_TAREA',
    entidad:     'tarea',
    entidadId:   taskId,
    detalles:    { titulo: tarea.titulo, pilar: tarea.pilar },
  })

  return { success: true }
}
